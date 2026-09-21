const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const imports = ['ImportBatch', 'ImportRow', 'ImportFile', 'ImportMapping', 'CollegeAlias', 'CatalogLock'];
imports.forEach((name) => require(`../../models/${name}`));
require('../../models/College');
require('../../models/HostelFee');
require('../../models/BondDetail');
// Additive migration only: never syncIndexes/drop indexes or rewrite college records.
async function prepareStorage() {
  for (const name of [...imports, 'HostelFee', 'BondDetail']) {
    const model = mongoose.model(name);
    await model.createCollection(); await model.createIndexes();
  }
  await mongoose.model('College').collection.createIndex({ collegeCode: 1 }, { unique: true, sparse: true });
  await mongoose.model('CatalogLock').updateOne({ _id: 'catalog' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
}
let ready;
async function assertStorage() {
  if (!ready) ready = (async () => {
    try {
      for (const [name, keys] of [['College', ['collegeCode']], ['CollegeAlias', ['key']], ['ImportRow', ['batchId', 'row']], ['ImportMapping', ['ownerId', 'entity', 'name']]]) {
        const indexes = await mongoose.model(name).collection.indexes();
        if (!indexes.some((i) => i.unique && JSON.stringify(Object.keys(i.key)) === JSON.stringify(keys))) throw new Error('Missing import index');
      }
      if (!await mongoose.model('CatalogLock').exists({ _id: 'catalog' })) throw new Error('Missing catalog lock');
    } catch (_e) { throw ApiError.conflict('Import storage is not initialized. Run npm run prepare:imports on the backend before accepting drafts.'); }
  })().catch((e) => { ready = undefined; throw e; });
  return ready;
}
module.exports = { prepareStorage, assertStorage };
