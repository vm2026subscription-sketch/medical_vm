const router = require('express').Router();
const { z } = require('zod');
const { requirePermission } = require('../../middlewares/rbac');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const service = require('./catalogDelete.service');
const schema = z.object({ entity: z.enum(Object.keys(require('./importDefinitions').definitions)), ids: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).min(1).max(100) });
const parse = (definition, value) => { const result = definition.safeParse(value); if (!result.success) throw ApiError.badRequest('Choose 1–100 records and supply the deletion confirmation and reason.'); return result.data; };
router.use('/catalog-deletion', requirePermission('imports:review'));
router.post('/catalog-deletion/preview', catchAsync(async (req, res) => {
  const data = parse(schema.strict(), req.body);
  const result = await service.preview(data.entity, data.ids);
  const model = require('./importDefinitions').definitions[data.entity].model;
  if (data.entity === 'hostel-fees') await model.populate(result.records, { path: 'collegeId', select: 'name' });
  else if (data.entity === 'college-courses') await model.populate(result.records, [{ path: 'collegeId', select: 'name' }, { path: 'courseId', select: 'name' }]);
  else if (!['colleges', 'courses'].includes(data.entity)) await model.populate(result.records, { path: 'collegeCourseId', populate: [{ path: 'collegeId', select: 'name' }, { path: 'courseId', select: 'name' }] });
  res.json({ success: true, data: { ...result, records: result.records.map((record) => ({ _id: record._id, label: [record.name || record.collegeId?.name || record.collegeCourseId?.collegeId?.name, record.courseId?.name || record.collegeCourseId?.courseId?.name, record.year, record.category, record.quota, record.round].filter(Boolean).join(' · ') || String(record._id) })) } });
}));
router.post('/catalog-deletion/confirm', catchAsync(async (req, res) => {
  const data = parse(schema.extend({ fingerprint: z.string().length(64), reason: z.string().trim().min(3).max(500) }).strict(), req.body);
  res.json({ success: true, data: await service.remove({ ...data, userId: req.user.id }) });
}));
module.exports = router;
