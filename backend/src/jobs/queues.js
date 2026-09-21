const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

let queues;
function getQueues() {
  if (!queues) {
    const connection = getRedisConnection();
    queues = {
      slotReleaseQueue: new Queue('slot-release', { connection }),
      subscriptionExpiryQueue: new Queue('subscription-expiry', { connection }),
      notificationQueue: new Queue('notifications', { connection }),
    };
  }
  return queues;
}

/**
 * scheduleSlotRelease — enqueues a delayed job that force-releases a held slot if it's
 * still 'held' by the time the job runs. Belt-and-braces alongside the lazy expiry check
 * in counselling.service.listSlotsForDate().
 */
async function scheduleSlotRelease(slotId, delayMs) {
  await getQueues().slotReleaseQueue.add('release', { slotId }, { delay: delayMs, removeOnComplete: true, removeOnFail: true });
}

async function scheduleNotification(payload, delayMs = 0) {
  await getQueues().notificationQueue.add('send', payload, { delay: delayMs, removeOnComplete: true });
}

/**
 * scheduleRecurringJobs — sets up the repeatable subscription-expiry sweep (every hour).
 * Call this once from the worker process on startup. A stable scheduler ID keeps
 * repeated worker starts from creating duplicate schedules.
 */
async function scheduleRecurringJobs() {
  await getQueues().subscriptionExpiryQueue.upsertJobScheduler(
    'subscription-expiry-sweep',
    { every: 60 * 60 * 1000 },
    { name: 'sweep', data: {}, opts: { removeOnComplete: true, removeOnFail: true } }
  );
}

module.exports = {
  async closeQueues() {
    if (queues) { const current = queues; queues = undefined; await Promise.all(Object.values(current).map((queue) => queue.close())); }
  },
  get slotReleaseQueue() { return getQueues().slotReleaseQueue; },
  get subscriptionExpiryQueue() { return getQueues().subscriptionExpiryQueue; },
  get notificationQueue() { return getQueues().notificationQueue; },
  scheduleSlotRelease,
  scheduleNotification,
  scheduleRecurringJobs,
};
