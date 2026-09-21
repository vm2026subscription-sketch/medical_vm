const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { requirePermission } = require('../../middlewares/rbac');
const Batch = require('../../models/ImportBatch');
const Row = require('../../models/ImportRow');
const File = require('../../models/ImportFile');
const Mapping = require('../../models/ImportMapping');
const College = require('../../models/College');
const { definitions, metadata, nullableNumbers } = require('./importDefinitions');
const { readSheet, template } = require('./spreadsheet');
const workflow = require('./importWorkflow.service');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 } });
const expensive = rateLimit({ windowMs: 60000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false });
const parse = (schema, value) => { const r = schema.safeParse(value); if (!r.success) throw ApiError.badRequest(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')); return r.data; };
const entity = z.enum(Object.keys(definitions));
const strings = z.record(z.string().max(10000));
const revision = z.number().int().nonnegative();
const sourceSchema = z.object({ entity, source: z.string().trim().min(2).max(150), sourceUrl: z.string().url().regex(/^https:\/\//).max(1000).optional(), sheet: z.string().max(150).optional() });
const ok = (res, data) => res.json({ success: true, data });
router.use('/imports', requirePermission('imports:write'));
router.get('/imports/meta', (req, res) => ok(res, metadata()));
router.get('/imports/categories', catchAsync(async (_req, res) => {
  ok(res, await require('../../utils/categoryCodes').listCategoryCodes({ includeSeats: true, includeInactive: true }));
}));
router.post('/imports/images', expensive, require('../../middlewares/upload').uploadImage.single('file'), catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a photo');
  const result = await require('./media.service').uploadImageBuffer(req.file.buffer, 'medpath/import-drafts');
  ok(res, { url: result.secure_url });
}));
router.post('/imports/from-record', expensive, catchAsync(async (req, res) => {
  const data = parse(z.object({ entity, id: z.string().regex(/^[a-f0-9]{24}$/i) }), req.body);
  const record = await definitions[data.entity].model.findById(data.id).lean();
  if (!record) throw ApiError.notFound('Record not found');
  const input = {};
  for (const key of Object.keys(definitions[data.entity].schema.shape)) if (record[key] !== undefined) input[key] = Array.isArray(record[key]) ? record[key].join('|') : typeof record[key] === 'object' ? JSON.stringify(record[key]) : String(record[key]);
  if (data.entity === 'colleges') input.collegeCode = record.collegeCode || String(record._id);
  if (data.entity === 'college-courses' && record.totalSeats == null) input.totalSeats = 'N/A';
  for (const key of nullableNumbers) if (key in definitions[data.entity].schema.shape && record[key] === null) input[key] = 'N/A';
  if (data.entity === 'hostel-fees') {
    const college = await College.findById(record.collegeId).lean();
    if (!college) throw ApiError.conflict('Linked college is missing');
    input.collegeCode = college.collegeCode || String(college._id);
  }
  else if (!['courses', 'colleges'].includes(data.entity)) {
    const link = data.entity === 'college-courses' ? record : await require('../../models/CollegeCourse').findById(record.collegeCourseId).lean();
    if (!link) throw ApiError.conflict('Linked college-course record is missing');
    const college = await College.findById(link.collegeId).lean();
    const course = await require('../../models/Course').findById(link.courseId).lean();
    if (!college || !course) throw ApiError.conflict('Linked master record is missing');
    Object.assign(input, { collegeCode: college.collegeCode || String(college._id), courseSlug: course.slug });
    if (data.entity === 'fees') {
      const hostel = await require('../../models/HostelFee').findOne({ collegeId: college._id, year: record.year }).lean();
      if (hostel) input.hostelMess = hostel.amount == null ? 'N/A' : String(hostel.amount);
    }
  }
  ok(res, await workflow.create({ entity: data.entity, source: 'Catalog correction - verify source before submission', input, userId: req.user.id }));
}));
router.get('/imports/templates/:entity', catchAsync(async (req, res) => { const name = parse(entity, req.params.entity); ok(res, await template(name, definitions[name])); }));
router.get('/imports/colleges', catchAsync(async (req, res) => {
  const search = parse(z.string().max(150), req.query.search || '');
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const page = parse(z.coerce.number().int().min(1).max(100000), req.query.page || 1);
  const filter = search ? { $or: [{ name: regex }, { city: regex }, { collegeCode: regex }] } : {};
  const data = await College.find(filter).select('name city state collegeCode isActive').sort({ name: 1, _id: 1 }).skip((page - 1) * 100).limit(100).lean();
  ok(res, { colleges: data.map((c) => ({ ...c, importCode: c.collegeCode || String(c._id) })), page, total: await College.countDocuments(filter) });
}));
router.post('/imports/inspect', expensive, upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a spreadsheet');
  const result = await readSheet(req.file.buffer, req.file.originalname, req.body.sheet);
  ok(res, { sheets: result.sheets, sheet: result.sheet, headers: result.headers, total: result.rows.length, preview: result.rows.slice(0, 5) });
}));
router.post('/imports/upload', expensive, upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a spreadsheet');
  const data = parse(sourceSchema, req.body);
  ok(res, await workflow.create({ ...data, file: req.file, userId: req.user.id }));
}));
router.post('/imports/manual', expensive, catchAsync(async (req, res) => {
  const data = parse(sourceSchema.extend({ input: strings }), req.body);
  if (Object.keys(data.input).some((key) => !Object.hasOwn(definitions[data.entity].schema.shape, key))) throw ApiError.badRequest('Unknown field');
  ok(res, await workflow.create({ ...data, userId: req.user.id }));
}));
router.get('/imports/presets', catchAsync(async (req, res) => ok(res, await Mapping.find({ ownerId: req.user.id }).sort({ name: 1 }).limit(100).lean())));
router.post('/imports/presets', catchAsync(async (req, res) => {
  const data = parse(z.object({ name: z.string().trim().min(1).max(100), entity, mapping: strings, defaults: strings }), req.body);
  if (await Mapping.countDocuments({ ownerId: req.user.id }) >= 100 && !await Mapping.exists({ ownerId: req.user.id, entity: data.entity, name: data.name })) throw ApiError.badRequest('Maximum 100 saved mappings');
  ok(res, await Mapping.findOneAndUpdate({ ownerId: req.user.id, entity: data.entity, name: data.name }, { $set: data }, { upsert: true, new: true }));
}));
router.get('/imports', catchAsync(async (req, res) => {
  const page = parse(z.coerce.number().int().min(1).max(100000), req.query.page || 1);
  const filter = workflow.canReview(req.adminRole) ? {} : { createdBy: req.user.id };
  if (req.query.status) filter.status = parse(z.enum(['draft', 'needs_correction', 'ready', 'submitted', 'rejected', 'published']), req.query.status);
  ok(res, { batches: await Batch.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(), total: await Batch.countDocuments(filter), page });
}));
router.get('/imports/:id', catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  const page = parse(z.coerce.number().int().min(1).max(100000), req.query.page || 1);
  ok(res, { batch, rows: await Row.find({ batchId: batch._id }).sort({ row: 1 }).skip((page - 1) * 25).limit(25).lean().then((rows) => rows.map((r) => ({ ...r, errors: r.rowErrors }))), page });
}));
router.get('/imports/:id/file', catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  const file = await File.findById(batch.fileId).select('+content').lean();
  if (!file) throw ApiError.notFound('No original file for this manual entry');
  ok(res, { filename: file.filename, base64: file.content.toString('base64'), mime: 'application/octet-stream' });
}));
router.get('/imports/:id/errors', catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  ok(res, await Row.find({ batchId: batch._id, 'rowErrors.0': { $exists: true } }).select('row rowErrors mapped').sort({ row: 1 }).lean().then((rows) => rows.map((r) => ({ ...r, errors: r.rowErrors }))));
}));
router.post('/imports/:id/validate', expensive, catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  const data = parse(z.object({ revision, mapping: strings, defaults: strings.optional(), overrides: z.record(strings).optional(), source: z.string().trim().min(2).max(150).optional(), sourceUrl: z.union([z.literal(''), z.string().url().regex(/^https:\/\//).max(1000)]).optional() }), req.body);
  ok(res, await workflow.validate(batch, data));
}));
router.post('/imports/:id/submit', catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  const data = parse(z.object({ revision }), req.body);
  if (batch.status !== 'ready' || batch.totals.errors) throw ApiError.conflict('Validate and resolve every row before submitting');
  const updated = await Batch.findOneAndUpdate({ _id: batch._id, revision: data.revision, status: 'ready' }, { $set: { status: 'submitted' }, $inc: { revision: 1 } }, { new: true });
  if (!updated) throw ApiError.conflict('Batch changed. Reload it.'); ok(res, updated);
}));
router.post('/imports/:id/reject', requirePermission('imports:review'), catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  const data = parse(z.object({ revision, note: z.string().trim().min(3).max(2000) }), req.body);
  const updated = await Batch.findOneAndUpdate({ _id: batch._id, revision: data.revision, status: 'submitted' }, { $set: { status: 'rejected', reviewNote: data.note, reviewedBy: req.user.id }, $inc: { revision: 1 } }, { new: true });
  if (!updated) throw ApiError.conflict('Only the current submitted revision can be returned'); ok(res, updated);
}));
router.post('/imports/:id/publish', requirePermission('imports:review'), expensive, catchAsync(async (req, res) => {
  const batch = await workflow.access(req.params.id, req.user.id, req.adminRole);
  ok(res, await workflow.publish(batch, req.user.id, parse(revision, req.body.revision)));
}));
module.exports = router;
