/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const env = require('../config/env');
const { prepareStorage } = require('../modules/admin/importStorage');
async function main() {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Use MongoDB Atlas or a replica set for production publishing');
    for (const file of fs.readdirSync(path.join(__dirname, '../models')).filter((name) => name.endsWith('.js'))) require(path.join(__dirname, '../models', file));
    for (const model of Object.values(mongoose.models)) {
      await model.createCollection();
      // Add declared indexes. Never drop indexes or rewrite existing records.
      await model.createIndexes();
    }
    await prepareStorage();
    console.log('Production collections and indexes ready. Existing records were preserved.');
  } finally { await mongoose.disconnect(); }
}
main().catch((error) => { console.error(error.code === 11000 ? 'Existing duplicate values block a unique index. Resolve duplicates through the admin workflow before retrying.' : 'Production preparation failed. Check database connectivity and replica-set configuration.'); process.exitCode = 1; });
