/* eslint-disable no-console */
// Read-only connectivity checks. No seed data, OTPs, payments or uploads are created.
const mongoose = require('mongoose');
const Redis = require('ioredis');
const env = require('../config/env');
const cloudinary = require('../config/cloudinary');

async function check(name, run) {
  try {
    await run();
    console.log(`${name}: connected`);
  } catch (error) {
    // Do not print URIs, credentials, provider payloads or complete error objects.
    console.error(`${name}: failed (${error.code || error.http_code || error.name || 'connection error'})`);
    process.exitCode = 1;
  }
}

async function main() {
  await check('MongoDB', async () => {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
      await mongoose.connection.db.command({ ping: 1 });
    } finally {
      await mongoose.disconnect();
    }
  });
  await check('Redis', async () => {
    const redis = new Redis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 10000, maxRetriesPerRequest: 0, retryStrategy: () => null });
    let connectionError;
    redis.on('error', (error) => { connectionError = error; });
    try {
      await redis.connect();
      await redis.ping();
    } catch (error) {
      throw connectionError || error;
    } finally {
      redis.disconnect();
    }
  });
  await check('Cloudinary', () => cloudinary.api.ping({ timeout: 10000 }));
}

main().catch(() => { console.error('Service verification could not complete'); process.exitCode = 1; });
