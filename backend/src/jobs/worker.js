/* eslint-disable no-console */
const { Worker } = require('bullmq');
const connectDB = require('../config/db');
const { getRedisConnection } = require('../config/redis');
const logger = require('../utils/logger');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Subscription = require('../models/Subscription');
const { scheduleRecurringJobs } = require('./queues');

async function start() {
  await connectDB();
  const connection = getRedisConnection();
  await scheduleRecurringJobs();

  const slotReleaseWorker = new Worker(
    'slot-release',
    async (job) => {
      const { slotId } = job.data;
      const result = await AvailabilitySlot.updateOne(
        { _id: slotId, status: 'held', heldUntil: { $lt: new Date() } },
        { $set: { status: 'open' }, $unset: { heldUntil: '', heldByUserId: '', holdToken: '', checkoutBookingId: '' } }
      );
      if (result.modifiedCount) {
        logger.info({ slotId }, 'Released expired held slot');
      } else {
        const slot = await AvailabilitySlot.findOne({ _id: slotId, status: 'held' }).select('heldUntil').lean();
        if (slot?.heldUntil > new Date()) await require('./queues').scheduleSlotRelease(slotId, slot.heldUntil.getTime() - Date.now() + 1000);
      }
    },
    { connection }
  );

  const subscriptionExpiryWorker = new Worker(
    'subscription-expiry',
    async () => {
      const result = await Subscription.updateMany(
        { status: 'active', expiryDate: { $lt: new Date() } },
        { $set: { status: 'expired' } }
      );
      if (result.modifiedCount) {
        logger.info({ count: result.modifiedCount }, 'Expired subscriptions marked');
      }
    },
    { connection }
  );

  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      // TODO: wire up actual push/SMS/email delivery. For now, persist as an in-app notification.
      const NewsNotification = require('../models/NewsNotification');
      await NewsNotification.create(job.data);
    },
    { connection }
  );

  [slotReleaseWorker, subscriptionExpiryWorker, notificationWorker].forEach((w) => {
    w.on('error', (err) => logger.error({ err }, `Worker error on queue ${w.name}`));
    w.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, `Job failed on queue ${w.name}`));
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => process.exit(1), 15000); timer.unref();
    try {
      await Promise.all([slotReleaseWorker, subscriptionExpiryWorker, notificationWorker].map((worker) => worker.close()));
      await require('./queues').closeQueues();
      await require('../config/redis').closeRedisConnection();
      await require('mongoose').disconnect();
      clearTimeout(timer); process.exit(0);
    } catch (err) { logger.error({ err }, 'Worker shutdown failed'); process.exit(1); }
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

  logger.info('Workers started: slot-release, subscription-expiry, notifications');
}

start().catch((err) => {
  console.error('Worker process failed to start', err);
  process.exit(1);
});
