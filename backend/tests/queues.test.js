jest.mock('bullmq', () => ({ Queue: jest.fn() }));
jest.mock('../src/config/redis', () => ({ getRedisConnection: jest.fn() }));

test('reading the API does not connect to Redis; scheduling still queues jobs and reuses the connection', async () => {
  const { Queue } = require('bullmq');
  const { getRedisConnection } = require('../src/config/redis');
  const connection = {};
  const add = jest.fn().mockResolvedValue({});
  const upsertJobScheduler = jest.fn().mockResolvedValue({});
  getRedisConnection.mockReturnValue(connection);
  Queue.mockImplementation(function () { return { add, upsertJobScheduler }; });
  const jobs = require('../src/jobs/queues');
  expect(getRedisConnection).not.toHaveBeenCalled();
  await jobs.scheduleSlotRelease('demo-slot', 30000);
  await jobs.scheduleNotification({ userId: 'demo-user' });
  await jobs.scheduleRecurringJobs();
  expect(getRedisConnection).toHaveBeenCalledTimes(1);
  expect(Queue).toHaveBeenCalledTimes(3);
  expect(add).toHaveBeenCalledWith('release', { slotId: 'demo-slot' }, { delay: 30000, removeOnComplete: true, removeOnFail: true });
  expect(add).toHaveBeenCalledWith('send', { userId: 'demo-user' }, { delay: 0, removeOnComplete: true });
  expect(upsertJobScheduler).toHaveBeenCalledWith('subscription-expiry-sweep', { every: 3600000 }, expect.any(Object));
  expect(jobs.slotReleaseQueue.add).toBe(add);
});
