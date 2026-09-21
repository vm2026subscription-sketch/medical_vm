/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const { prepareStorage } = require('../modules/admin/importStorage');
async function main() {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false, autoCreate: false });
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('A MongoDB replica set or Atlas cluster is required for atomic publishing');
    await prepareStorage();
    console.log('Import collections and indexes are ready. Existing catalog records were not changed.');
  } finally { await mongoose.disconnect(); }
}
main().catch((e) => { console.error('Import setup failed:', e.code === 11000 ? 'Duplicate college codes must be resolved before creating the unique index.' : e.message); process.exitCode = 1; });
