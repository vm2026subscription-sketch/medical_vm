const IORedis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let connection;

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
    });
    connection.on('error', (err) => logger.error({ err }, 'Redis connection error'));
    connection.on('connect', () => logger.info('Redis connected'));
  }
  return connection;
}

async function closeRedisConnection() {
  if (connection) { const client = connection; connection = undefined; await client.quit(); }
}
module.exports = { getRedisConnection, closeRedisConnection };
