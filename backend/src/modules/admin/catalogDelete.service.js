const ApiError = require('../../utils/ApiError');
const { definitions } = require('./importDefinitions');
const { transaction, hash } = require('./importWorkflow.service');
const Lock = require('../../models/CatalogLock');
const Audit = require('../../models/AuditLog');
const Alias = require('../../models/CollegeAlias');
const Saved = require('../../models/SavedCollege');

const dependents = {
  colleges: [['college-courses', 'collegeId'], ['hostel-fees', 'collegeId']],
  courses: [['college-courses', 'courseId']],
  'college-courses': [['fees', 'collegeCourseId'], ['cutoffs', 'collegeCourseId'], ['seat-matrix', 'collegeCourseId'], ['bonds', 'collegeCourseId']],
};
async function preview(entity, ids, session) {
  const definition = definitions[entity];
  if (!definition) throw ApiError.badRequest('Unknown catalog section');
  const records = await definition.model.find({ _id: { $in: ids } }).sort({ _id: 1 }).session(session || null).lean();
  if (records.length !== new Set(ids.map((id) => id.toLowerCase())).size) throw ApiError.conflict('Some selected records no longer exist. Refresh the list.');
  const dependencies = [];
  for (const [section, field] of dependents[entity] || []) {
    const count = await definitions[section].model.countDocuments({ [field]: { $in: ids } }).session(session || null);
    if (count) dependencies.push({ section, count });
  }
  return { entity, records, dependencies, count: records.length, fingerprint: hash(records) };
}
async function remove({ entity, ids, fingerprint, reason, userId }) {
  return transaction(async (session) => {
    // Use the same lock as publishing, so a link cannot be published during deletion.
    await Lock.updateOne({ _id: 'catalog' }, { $inc: { revision: 1 } }, { upsert: true, session });
    const current = await preview(entity, ids, session);
    if (current.fingerprint !== fingerprint) throw ApiError.conflict('Selected records changed. Review the deletion again.');
    if (current.dependencies.length) throw ApiError.conflict(`Delete linked records first: ${current.dependencies.map((d) => `${d.section} (${d.count})`).join(', ')}. Nothing was deleted.`);
    const result = await definitions[entity].model.deleteMany({ _id: { $in: ids } }, { session });
    if (entity === 'colleges') {
      await Alias.deleteMany({ collegeId: { $in: ids } }, { session });
      await Saved.deleteMany({ collegeId: { $in: ids } }, { session });
    }
    await Audit.insertMany(current.records.map((record) => ({ adminUserId: userId, action: 'delete', entity: definitions[entity].model.modelName, entityId: record._id, before: record, after: { reason, bulkCount: current.count } })), { session });
    return { deletedCount: result.deletedCount };
  });
}
module.exports = { preview, remove };
