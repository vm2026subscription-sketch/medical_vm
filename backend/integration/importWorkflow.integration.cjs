const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const workflow = require('../src/modules/admin/importWorkflow.service');
const { definitions } = require('../src/modules/admin/importDefinitions');
const { prepareStorage } = require('../src/modules/admin/importStorage');
const Batch = require('../src/models/ImportBatch');
const Row = require('../src/models/ImportRow');
const Audit = require('../src/models/AuditLog');
const College = require('../src/models/College');
const Course = require('../src/models/Course');
const Link = require('../src/models/CollegeCourse');
const Fee = require('../src/models/Fee');
const HostelFee = require('../src/models/HostelFee');
const CutOff = require('../src/models/CutOff');
const Subscription = require('../src/models/Subscription');
const express = require('express');
const request = require('supertest');
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: String(owner), role: 'admin' };
  req.adminRole = req.headers['x-editor'] ? { name: 'data_editor', permissions: ['imports:write', 'imports:review'] } : { name: 'super_admin', permissions: ['*'] };
  next();
});
app.use(require('../src/modules/admin/importWorkflow.routes'));
app.use(require('../src/modules/admin/catalogDelete.routes'));
app.use(require('../src/modules/admin/console.routes'));
app.use('/public-colleges', require('../src/modules/colleges/colleges.routes'));
app.use('/public-cutoffs', require('../src/modules/cutoffs/cutoffs.routes'));
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
let server;
const owner = new mongoose.Types.ObjectId();
before(async () => {
  // Always an isolated loopback replica set. Never connect to the configured application database.
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('import-workflow-test'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await prepareStorage();
});
after(async () => { await mongoose.disconnect(); if (server) await server.stop(); });
beforeEach(async () => { for (const m of Object.values(mongoose.models)) if (m.modelName !== 'CatalogLock') await m.deleteMany({}); });
async function draft(entity, input) {
  let b = await workflow.create({ entity, source: 'Official test source', input, userId: owner });
  b = await workflow.validate(b, { mapping: b.mapping, revision: b.revision }); return b;
}
async function submit(b) { return Batch.findByIdAndUpdate(b._id, { $set: { status: 'submitted' }, $inc: { revision: 1 } }, { new: true }).lean(); }
async function masters() {
  const c = await College.create({ collegeCode: 'COL-001', name: 'Test College', city: 'Pune', state: 'Maharashtra', ownership: 'govt' });
  const course = await Course.create({ name: 'MBBS', slug: 'mbbs' });
  return Link.create({ collegeId: c._id, courseId: course._id, totalSeats: 100 });
}

test('dashboard attention lists match counts, paginate missing course data and exclude published fixes', async () => {
  const first = await masters();
  const [completeCollege, inactiveCollege] = await College.create([
    { collegeCode: 'COL-DONE', name: 'Complete College', city: 'Pune', state: 'Maharashtra', ownership: 'govt', images: ['https://example.com/photo.jpg'] },
    { collegeCode: 'COL-INACTIVE', name: 'Inactive College', city: 'Delhi', state: 'Delhi', ownership: 'govt', isActive: false },
  ]);
  const [complete, inactive] = await Link.create([{ collegeId: completeCollege._id, courseId: first.courseId }, { collegeId: inactiveCollege._id, courseId: first.courseId }]);
  await Fee.create({ collegeCourseId: complete._id, year: 2025, tier: 'merit', tuition: null });
  await CutOff.create({ collegeCourseId: complete._id, category: 'DEF1', quota: 'State', authority: 'Test', year: 2025, round: 'Round1', closingRank: 1000 });
  const stats = (await request(app).get('/analytics/dashboard').expect(200)).body.data.catalog;
  const photos = (await request(app).get('/catalog/colleges?missingImages=true&active=true').expect(200)).body;
  assert.equal(stats.missingImages, 1); assert.equal(photos.pagination.total, stats.missingImages);
  assert.equal(photos.data[0].collegeCode, 'COL-001');
  for (const missing of ['fees', 'cutoffs']) {
    const page1 = (await request(app).get(`/catalog/college-courses?missingData=${missing}&limit=1&page=1`).expect(200)).body;
    const page2 = (await request(app).get(`/catalog/college-courses?missingData=${missing}&limit=1&page=2`).expect(200)).body;
    assert.equal(page1.pagination.total, stats[missing === 'fees' ? 'missingFees' : 'missingCutoffs']);
    assert.equal(page1.pagination.total, 2); assert.equal(page1.pagination.totalPages, 2);
    assert.notEqual(page1.data[0]._id, page2.data[0]._id);
    assert.equal(page1.data[0].courseId.slug, 'mbbs'); assert.ok(page1.data[0].collegeId.name);
    const searched = (await request(app).get(`/catalog/college-courses?missingData=${missing}&search=COL-001`).expect(200)).body;
    assert.equal(searched.pagination.total, 1); assert.equal(searched.data[0]._id, String(first._id));
    const empty = (await request(app).get(`/catalog/college-courses?missingData=${missing}&search=does-not-exist`).expect(200)).body;
    assert.equal(empty.pagination.total, 0); assert.deepEqual(empty.data, []);
    await request(app).get(`/catalog/college-courses?missingData=${missing}`).set('x-editor', 'true').expect(403);
  }
  await request(app).get('/catalog/college-courses?missingData=unknown').expect(400);
  let batch = await draft('cutoffs', { collegeCode: 'COL-001', courseSlug: 'mbbs', category: 'DEF1', quota: 'State', authority: 'Test', year: '2026', round: 'Round1', closingRank: '12345' });
  assert.equal((await request(app).get('/catalog/college-courses?missingData=cutoffs').expect(200)).body.pagination.total, 2);
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  await Fee.create({ collegeCourseId: first._id, year: 2025, tier: 'merit', tuition: 0 });
  await College.findByIdAndUpdate(first.collegeId, { images: ['https://example.com/added.jpg'] });
  for (const missing of ['fees', 'cutoffs']) {
    const fixed = (await request(app).get(`/catalog/college-courses?missingData=${missing}`).expect(200)).body;
    assert.equal(fixed.pagination.total, 1); assert.equal(fixed.data[0]._id, String(inactive._id));
  }
  assert.equal((await request(app).get('/catalog/colleges?missingImages=true&active=true').expect(200)).body.pagination.total, 0);
  const refreshed = (await request(app).get('/analytics/dashboard').expect(200)).body.data.catalog;
  assert.equal(refreshed.missingImages, 0); assert.equal(refreshed.missingFees, 1); assert.equal(refreshed.missingCutoffs, 1);
});

test('source categories publish independently, filter exactly and expose only published active category names', async () => {
  const link = await masters();
  const categories = ['DEF1', 'DEF2 W', 'OBC', 'OBC(W)', 'OBC-NCL', 'OPEN', 'Open', 'HOPEN', 'NTB(W)', 'SOURCE-CUSTOM / W'];
  const csv = 'collegeCode,courseSlug,category,quota,authority,year,round,closingRank\n' + categories.map((category, i) => `COL-001,mbbs,${category},State,Test authority,2026,Round1,${1000 + i}`).join('\n');
  let batch = await workflow.create({ entity: 'cutoffs', source: 'Official category sheet', file: { originalname: 'cutoffs.csv', buffer: Buffer.from(csv) }, userId: owner });
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'ready');
  assert.deepEqual((await request(app).get('/public-cutoffs/categories').expect(200)).body.data, []);
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  const labels = (await request(app).get('/public-cutoffs/categories').expect(200)).body.data;
  assert.deepEqual(new Set(labels), new Set(categories));
  assert.ok(labels.every((value) => typeof value === 'string'));
  const { listCutoffs } = require('../src/modules/cutoffs/cutoffs.service');
  const { listColleges } = require('../src/modules/colleges/colleges.service');
  for (const [i, category] of categories.entries()) {
    const result = await listCutoffs({ category }, true);
    assert.equal(result.totalCount, 1); assert.equal(result.data[0].closingRank, 1000 + i);
    assert.equal((await listColleges({ category })).pagination.total, 1);
    await request(app).get('/public-colleges').query({ category }).expect(200);
  }
  let update = await draft('cutoffs', { collegeCode: 'COL-001', courseSlug: 'mbbs', category: 'OBC(W)', quota: 'State', authority: 'Test authority', year: '2026', round: 'Round1', closingRank: '2222' });
  update = await submit(update); await workflow.publish(update, owner, update.revision);
  assert.equal(await CutOff.countDocuments(), categories.length);
  assert.equal((await CutOff.findOne({ category: 'OBC' })).closingRank, 1002);
  assert.equal((await CutOff.findOne({ category: 'OBC(W)' })).closingRank, 2222);
  await definitions['seat-matrix'].model.create({ collegeCourseId: link._id, category: 'SEATS ONLY', quota: 'State', authority: 'Test', year: 2026, round: 'Round1', seats: 10 });
  assert.ok((await request(app).get('/public-colleges/categories').expect(200)).body.data.includes('SEATS ONLY'));
  assert.ok(!(await request(app).get('/public-cutoffs/categories').expect(200)).body.data.includes('SEATS ONLY'));
  await College.findByIdAndUpdate(link.collegeId, { isActive: false });
  assert.deepEqual((await request(app).get('/public-cutoffs/categories').expect(200)).body.data, []);
  assert.deepEqual((await request(app).get('/public-colleges/categories').expect(200)).body.data, []);
  assert.ok((await request(app).get('/imports/categories').expect(200)).body.data.includes('SOURCE-CUSTOM / W'));
});

test('bond blanks and N/A publish as unknown, preserve saved values on blank updates and support independent fields', async () => {
  const link = await masters();
  const Bond = definitions.bonds.model;
  const csv = 'collegeCode,courseSlug,years,penaltyAmount\nCOL-001,mbbs,,';
  let batch = await workflow.create({ entity: 'bonds', source: 'Official bond notice', file: { originalname: 'bonds.csv', buffer: Buffer.from(csv) }, userId: owner });
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'ready');
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  const original = await Bond.findOne({ collegeCourseId: link._id });
  assert.equal(original.years, null); assert.equal(original.penaltyAmount, null);
  const collegeService = require('../src/modules/colleges/colleges.service');
  const unavailable = await collegeService.getCollegeDetail(link.collegeId, false);
  assert.equal(unavailable.college.bondYears, null); assert.equal(unavailable.college.bondPenalty, null);
  assert.equal(unavailable.college.bondPublished, false);
  for (const [years, penaltyAmount, expectedYears, expectedPenalty] of [
    ['1', '1000000', 1, 1000000], ['', '', 1, 1000000], ['N/A', 'N/A', null, null],
    ['2', 'N/A', 2, null], ['N/A', '500000', null, 500000], ['0', '0', 0, 0],
  ]) {
    let update = await draft('bonds', { collegeCode: 'COL-001', courseSlug: 'mbbs', years, penaltyAmount });
    assert.equal(update.status, 'ready');
    update = await submit(update); await workflow.publish(update, owner, update.revision);
    const saved = await Bond.findById(original._id);
    assert.equal(saved.years, expectedYears); assert.equal(saved.penaltyAmount, expectedPenalty);
    const detail = await collegeService.getCollegeDetail(link.collegeId, false);
    assert.equal(detail.college.bondYears, expectedYears); assert.equal(detail.college.bondPenalty, expectedPenalty);
    assert.equal(detail.college.bondPublished, expectedYears !== null || expectedPenalty !== null);
    assert.equal(await Bond.countDocuments(), 1);
    if (years === 'N/A' && penaltyAmount === 'N/A') {
      const correction = await request(app).post('/imports/from-record').send({ entity: 'bonds', id: String(saved._id) }).expect(200);
      const row = await Row.findOne({ batchId: correction.body.data._id });
      assert.equal(row.input.years, 'N/A'); assert.equal(row.input.penaltyAmount, 'N/A');
      const checked = await workflow.validate(correction.body.data, { mapping: correction.body.data.mapping, revision: correction.body.data.revision });
      assert.equal(checked.totals.unchanged, 1);
    }
  }
});

test('blank fee spreadsheet cells publish as unknown; N/A and zero survive correction and preserve identity', async () => {
  const link = await masters();
  await HostelFee.create({ collegeId: link.collegeId, year: 2025, amount: 80000 });
  const input = { collegeCode: 'COL-001', courseSlug: 'mbbs', year: '2026', tier: 'merit' };
  const csv = 'collegeCode,courseSlug,year,tier,tuition,otherCharges,hostelMess\nCOL-001,mbbs,2026,merit,,,';
  let batch = await workflow.create({ entity: 'fees', source: 'Official fee source', file: { originalname: 'fees.csv', buffer: Buffer.from(csv) }, userId: owner });
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'ready');
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  const original = await Fee.findOne({ collegeCourseId: link._id });
  assert.equal(original.tuition, null); assert.equal(original.otherCharges, null);
  const summary = await require('../src/modules/colleges/colleges.service').attachSummary(await College.findById(link.collegeId).lean());
  assert.equal(summary.feeMerit, null); assert.equal(summary.feeFrom, null); assert.equal(summary.hostelMess, null);
  for (const [value, expected] of [['100000', 100000], ['', 100000], ['N/A', null], ['0', 0]]) {
    let update = await draft('fees', { ...input, tuition: value, otherCharges: value, hostelMess: value });
    assert.equal(update.status, 'ready');
    update = await submit(update); await workflow.publish(update, owner, update.revision);
    const fee = await Fee.findById(original._id);
    assert.equal(fee.tuition, expected); assert.equal(fee.otherCharges, expected);
    assert.equal((await HostelFee.findOne({ collegeId: link.collegeId, year: 2026 })).amount, expected);
    const table = await request(app).get('/catalog/fees?year=2026').expect(200);
    assert.equal(table.body.data[0].hostelMess, expected);
    const corrected = await request(app).post('/imports/from-record').send({ entity: 'fees', id: String(original._id) }).expect(200);
    const row = await Row.findOne({ batchId: corrected.body.data._id });
    assert.equal(row.input.tuition, expected === null ? 'N/A' : String(expected));
    assert.equal(row.input.hostelMess, expected === null ? 'N/A' : String(expected));
    const check = await workflow.validate(corrected.body.data, { mapping: corrected.body.data.mapping, revision: 0 });
    assert.equal(check.status, 'ready'); assert.equal(check.totals.unchanged, 1);
    assert.equal(await Fee.countDocuments(), 1);
  }
});

test('blank hostel cells share a supplied college-year amount regardless of row order', async () => {
  const link = await masters();
  const csv = 'collegeCode,courseSlug,year,tier,tuition,hostelMess\nCOL-001,mbbs,2026,merit,,\nCOL-001,mbbs,2026,management,100000,85000';
  let batch = await workflow.create({ entity: 'fees', source: 'Official source', file: { originalname: 'fees.csv', buffer: Buffer.from(csv) }, userId: owner });
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'ready');
  const preview = await Row.findOne({ batchId: batch._id, row: 2 });
  assert.equal(preview.prepared.hostel.document.amount, 85000);
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  assert.equal(await HostelFee.countDocuments(), 1);
  assert.equal((await HostelFee.findOne({ collegeId: link.collegeId, year: 2026 })).amount, 85000);
  assert.equal(await Fee.countDocuments(), 2);
});

test('unknown latest fees stay out of fee ranges and budget matches; confirmed zero remains valid', async () => {
  const link = await masters();
  const collegeService = require('../src/modules/colleges/colleges.service');
  const courseService = require('../src/modules/courses/courses.service');
  const predictor = require('../src/modules/predict/predict.service');
  await Fee.create({ collegeCourseId: link._id, year: 2025, tier: 'merit', tuition: 10000 });
  const fee = await Fee.create({ collegeCourseId: link._id, year: 2026, tier: 'merit', tuition: null });
  await CutOff.create({ collegeCourseId: link._id, year: 2026, round: 'Round1', authority: 'MCC', quota: 'AIQ', category: 'General', closingRank: 10000 });
  const predictionInput = { userId: owner, rank: 1000, category: 'General', state: 'Maharashtra', budget: 20000, courseSlugs: ['mbbs'], isPremium: true };
  assert.equal((await collegeService.listColleges({ maxFee: 20000 })).pagination.total, 0);
  assert.equal((await courseService.getCourseBySlug('mbbs')).feeRangeByOwnership.government, null);
  assert.equal((await predictor.generateSeatMatch(predictionInput)).best.length, 0);
  await Fee.updateOne({ _id: fee._id }, { $set: { tuition: 0 } });
  const results = await collegeService.listColleges({ maxFee: 20000 });
  assert.equal(results.pagination.total, 1); assert.equal(results.data[0].feeFrom, 0);
  assert.deepEqual((await courseService.getCourseBySlug('mbbs')).feeRangeByOwnership.government, { min: 0, max: 0 });
  assert.equal((await predictor.generateSeatMatch(predictionInput)).best.length, 1);
});

test('combined fees publish both amounts, display existing hostel fees, and prefill corrections', async () => {
  const link = await masters();
  const hostel = await HostelFee.create({ collegeId: link.collegeId, year: 2026, amount: 80000 });
  await HostelFee.create({ collegeId: link.collegeId, year: 2025, amount: 70000 });
  const input = { ...definitions.fees.sample, collegeCode: 'COL-001' };
  let batch = await draft('fees', input);
  assert.equal(batch.status, 'ready');
  assert.equal(await Fee.countDocuments(), 0);
  assert.equal((await HostelFee.findById(hostel._id)).amount, 80000);
  const prepared = (await Row.findOne({ batchId: batch._id })).prepared;
  assert.equal(prepared.document.hostelMess, undefined);
  assert.equal(prepared.hostel.before.amount, 80000);
  assert.ok(prepared.changedFields.includes('hostelMess'));
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  const fee = await Fee.findOne({ collegeCourseId: link._id, year: 2026 });
  assert.equal(fee.tuition, 100000);
  assert.equal((await HostelFee.findById(hostel._id)).amount, 85000);
  assert.equal(await HostelFee.countDocuments(), 2);
  const table = await request(app).get('/catalog/fees?year=2026').expect(200);
  assert.equal(table.body.data[0].hostelMess, 85000);
  const publicDetail = await require('../src/modules/colleges/colleges.service').getCollegeDetail(link.collegeId, false);
  assert.equal(publicDetail.college.hostelMess, 85000);
  const correction = await request(app).post('/imports/from-record').send({ entity: 'fees', id: String(fee._id) }).expect(200);
  const correctedRow = await Row.findOne({ batchId: correction.body.data._id });
  assert.equal(correctedRow.input.hostelMess, '85000');
  for (const [value, expected] of [['', 85000], ['0', 0]]) {
    let update = await draft('fees', { ...input, tuition: '110000', hostelMess: value });
    assert.equal(update.status, 'ready');
    update = await submit(update); await workflow.publish(update, owner, update.revision);
    assert.equal((await HostelFee.findById(hostel._id)).amount, expected);
    assert.equal(await Fee.countDocuments(), 1);
  }
  assert.equal((await HostelFee.findOne({ year: 2025 })).amount, 70000);
});

test('repeated college/year hostel values deduplicate across courses and conflicting values block the batch', async () => {
  const link = await masters();
  const course = await Course.create({ slug: 'bsc-nursing', name: 'Nursing' });
  await Link.create({ collegeId: link.collegeId, courseId: course._id, totalSeats: 60 });
  const csv = 'collegeCode,courseSlug,year,tier,tuition,hostelMess\nCOL-001,mbbs,2026,merit,100000,85000\nCOL-001,bsc-nursing,2026,merit,50000,90000';
  let batch = await workflow.create({ entity: 'fees', source: 'Official source', file: { originalname: 'fees.csv', buffer: Buffer.from(csv) }, userId: owner });
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'needs_correction');
  assert.match((await Row.findOne({ batchId: batch._id, row: 3 })).rowErrors[0], /conflicting amounts/);
  assert.equal(await HostelFee.countDocuments(), 0);
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision, overrides: { 3: { hostelMess: '85000' } } });
  assert.equal(batch.status, 'ready');
  batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
  assert.equal(await Fee.countDocuments(), 2);
  assert.equal(await HostelFee.countDocuments(), 1);
});

test('changed or newly-created hostel records block stale combined approvals', async () => {
  const link = await masters();
  const input = { ...definitions.fees.sample, collegeCode: 'COL-001' };
  let batch = await submit(await draft('fees', input));
  const hostel = await HostelFee.create({ collegeId: link.collegeId, year: 2026, amount: 70000 });
  await assert.rejects(workflow.publish(batch, owner, batch.revision), /hostel fees changed/);
  assert.equal(await Fee.countDocuments(), 0);
  batch = await submit(await draft('fees', input));
  await HostelFee.updateOne({ _id: hostel._id }, { $set: { amount: 75000 } });
  await assert.rejects(workflow.publish(batch, owner, batch.revision), /hostel fees changed/);
  assert.equal(await Fee.countDocuments(), 0);
  assert.equal((await HostelFee.findById(hostel._id)).amount, 75000);
});

test('hostel storage failure rolls back tuition and publication status together', async () => {
  await masters();
  const batch = await submit(await draft('fees', { ...definitions.fees.sample, collegeCode: 'COL-001' }));
  const original = HostelFee.bulkWrite;
  HostelFee.bulkWrite = async () => { throw new Error('Hostel write failed'); };
  try { await assert.rejects(workflow.publish(batch, owner, batch.revision), /Hostel write failed/); }
  finally { HostelFee.bulkWrite = original; }
  assert.equal(await Fee.countDocuments(), 0);
  assert.equal(await HostelFee.countDocuments(), 0);
  assert.equal((await Batch.findById(batch._id)).status, 'submitted');
});

test('N/A intake publishes as unknown, survives correction drafts, and updates the same link without losing fees', async () => {
  const link = await masters();
  const fee = await Fee.create({ collegeCourseId: link._id, year: 2026, tier: 'merit', tuition: 100000 });
  const college = await College.findById(link.collegeId).lean();
  const { attachSummary } = require('../src/modules/colleges/colleges.service');
  for (const value of ['N/A', '150', 'n/a']) {
    let batch = await draft('college-courses', { collegeCode: college.collegeCode, courseSlug: 'mbbs', totalSeats: value });
    assert.equal(batch.status, 'ready');
    batch = await submit(batch); await workflow.publish(batch, owner, batch.revision);
    assert.equal((await Link.findById(link._id)).totalSeats, value === '150' ? 150 : null);
    assert.equal((await attachSummary(college)).seats, value === '150' ? 150 : null);
    assert.equal(await Link.countDocuments(), 1);
    assert.equal(String((await Fee.findById(fee._id)).collegeCourseId), String(link._id));
  }
  const corrected = await request(app).post('/imports/from-record').send({ entity: 'college-courses', id: String(link._id) }).expect(200);
  let batch = await Batch.findById(corrected.body.data._id).lean();
  batch = await workflow.validate(batch, { mapping: batch.mapping, revision: batch.revision });
  assert.equal(batch.status, 'ready');
  const nursing = await Course.create({ name: 'Nursing', slug: 'bsc-nursing' });
  await Link.create({ collegeId: college._id, courseId: nursing._id, totalSeats: 60 });
  assert.equal((await attachSummary(college)).seats, null);
  assert.equal((await attachSummary(college, { courseId: nursing._id })).seats, 60);
});
test('a draft and submitted batch do not enter the live catalog; publishing is idempotent', async () => {
  let b = await draft('colleges', { ...definitions.colleges.sample, collegeCode: 'COL-001' });
  assert.equal(b.status, 'ready'); assert.equal(await College.countDocuments(), 0);
  b = await submit(b); assert.equal(await College.countDocuments(), 0);
  const published = await workflow.publish(b, owner, b.revision);
  assert.equal(published.status, 'published'); assert.equal(await College.countDocuments(), 1);
  await workflow.publish(published, owner, published.revision);
  assert.equal(await College.countDocuments(), 1); assert.equal(await Audit.countDocuments({ action: 'publish_import' }), 1);
});
test('missing college references block validation; unrelated users cannot read a draft', async () => {
  const b = await draft('cutoffs', definitions.cutoffs.sample);
  assert.equal(b.status, 'needs_correction'); assert.equal(b.totals.errors, 1);
  await assert.rejects(workflow.access(b._id, new mongoose.Types.ObjectId(), { name: 'data_editor', permissions: ['imports:write'] }), { statusCode: 404 });
  assert.equal(await CutOff.countDocuments(), 0);
});
test('codes link fee sheets and new years preserve previous years', async () => {
  const link = await masters();
  await Fee.create({ collegeCourseId: link._id, year: 2025, tier: 'merit', tuition: 90000 });
  let b = await draft('fees', { ...definitions.fees.sample, collegeCode: 'COL-001' });
  assert.equal(b.status, 'ready'); b = await submit(b); await workflow.publish(b, owner, b.revision);
  assert.equal((await Fee.findOne({ year: 2025 })).tuition, 90000);
  assert.equal((await Fee.findOne({ year: 2026 })).collegeCourseId.toString(), link.id);
});
test('changed live data blocks stale approval without applying any update', async () => {
  const link = await masters();
  const fee = await Fee.create({ collegeCourseId: link._id, year: 2026, tier: 'merit', tuition: 90000 });
  let b = await draft('fees', { ...definitions.fees.sample, collegeCode: 'COL-001' }); b = await submit(b);
  await Fee.updateOne({ _id: fee._id }, { $set: { tuition: 95000 } });
  await assert.rejects(workflow.publish(b, owner, b.revision), { statusCode: 409 });
  assert.equal((await Fee.findById(fee._id)).tuition, 95000);
  assert.equal((await Batch.findById(b._id)).status, 'submitted');
});
test('a failure after catalog writes rolls back records and batch status together', async () => {
  let b = await draft('colleges', { ...definitions.colleges.sample, collegeCode: 'COL-001' }); b = await submit(b);
  const original = Audit.create; Audit.create = async () => { throw new Error('Audit storage unavailable'); };
  try { await assert.rejects(workflow.publish(b, owner, b.revision), /Audit storage unavailable/); } finally { Audit.create = original; }
  assert.equal(await College.countDocuments(), 0); assert.equal((await Batch.findById(b._id)).status, 'submitted');
});
test('duplicate keys block the whole file and row corrections survive revalidation', async () => {
  const file = { originalname: 'courses.csv', buffer: Buffer.from('name,slug\nMBBS,mbbs\nBDS,mbbs') };
  let b = await workflow.create({ entity: 'courses', source: 'Official source', file, userId: owner });
  b = await workflow.validate(b, { mapping: b.mapping, revision: b.revision }); assert.equal(b.totals.errors, 1);
  b = await workflow.validate(b, { mapping: b.mapping, revision: b.revision, overrides: { 3: { slug: 'bds' } } }); assert.equal(b.status, 'ready');
  b = await workflow.validate(b, { mapping: b.mapping, revision: b.revision }); assert.equal(b.status, 'ready');
  assert.equal((await Row.findOne({ batchId: b._id, row: 3 })).mapped.slug, 'bds');
});
test('two concurrent approvals of the same new seat key cannot create duplicates', async () => {
  await masters();
  const input = { ...definitions['seat-matrix'].sample, collegeCode: 'COL-001' };
  const a = await submit(await draft('seat-matrix', input)); const b = await submit(await draft('seat-matrix', input));
  const results = await Promise.allSettled([workflow.publish(a, owner, a.revision), workflow.publish(b, owner, b.revision)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await definitions['seat-matrix'].model.countDocuments(), 1);
});
test('existing legacy college IDs resolve regardless of hexadecimal letter case', async () => {
  const link = await masters(); const college = await College.findById(link.collegeId);
  await College.updateOne({ _id: college._id }, { $unset: { collegeCode: 1 } });
  const b = await draft('fees', { ...definitions.fees.sample, collegeCode: college.id.toUpperCase() });
  assert.equal(b.status, 'ready');
});
test('same college name cannot be created under two codes, including concurrent batches', async () => {
  const a = await submit(await draft('colleges', { ...definitions.colleges.sample, collegeCode: 'COL-A' }));
  const b = await submit(await draft('colleges', { ...definitions.colleges.sample, collegeCode: 'COL-B' }));
  await workflow.publish(a, owner, a.revision);
  await assert.rejects(workflow.publish(b, owner, b.revision), { statusCode: 409 });
  assert.equal(await College.countDocuments(), 1);
});
test('a 2,000-row sheet validates and publishes as one batch', async () => {
  const csv = 'name,slug\n' + Array.from({ length: 2000 }, (_, n) => `Test Course ${n},course-${n}`).join('\n');
  let b = await workflow.create({ entity: 'courses', source: 'Load test fixture', file: { originalname: 'courses.csv', buffer: Buffer.from(csv) }, userId: owner });
  b = await workflow.validate(b, { mapping: b.mapping, revision: b.revision });
  assert.equal(b.totals.valid, 2000); b = await submit(b); await workflow.publish(b, owner, b.revision);
  assert.equal(await Course.countDocuments(), 2000);
});
test('real upload API preserves the original file, validates rows and denies editor publication', async () => {
  const csv = Buffer.from('name,slug\nMBBS,mbbs');
  let response = await request(app).post('/imports/upload').field('entity', 'courses').field('source', 'Official source').attach('file', csv, 'source.csv');
  assert.equal(response.status, 200); const b = response.body.data;
  response = await request(app).get(`/imports/${b._id}/file`);
  assert.equal(Buffer.from(response.body.data.base64, 'base64').toString(), csv.toString());
  response = await request(app).post(`/imports/${b._id}/validate`).send({ revision: b.revision, mapping: b.mapping });
  assert.equal(response.status, 200); assert.equal(response.body.data.status, 'ready');
  response = await request(app).post(`/imports/${b._id}/submit`).send({ revision: response.body.data.revision });
  assert.equal(response.status, 200);
  const denied = await request(app).post(`/imports/${b._id}/publish`).set('x-editor', 'true').send({ revision: response.body.data.revision });
  assert.equal(denied.status, 403); assert.equal(await Course.countDocuments(), 0);
  const published = await request(app).post(`/imports/${b._id}/publish`).send({ revision: response.body.data.revision });
  assert.equal(published.status, 200); assert.equal(await Course.countDocuments(), 1);
});
test('approved source aliases resolve later sheets; a draft alias never changes a master', async () => {
  await masters();
  let b = await draft('fees', { ...definitions.fees.sample, collegeCode: 'COL-001', collegeName: 'Alternate College Name', city: 'Pune' });
  assert.equal(b.status, 'ready'); assert.equal(await mongoose.model('CollegeAlias').countDocuments(), 0);
  b = await submit(b); await workflow.publish(b, owner, b.revision);
  const cutoff = await draft('cutoffs', { ...definitions.cutoffs.sample, collegeCode: '', collegeName: 'Alternate College Name', city: 'Pune' });
  assert.equal(cutoff.status, 'ready'); assert.equal(await CutOff.countDocuments(), 0);
});
test('public cutoff results exclude drafts; free rows are masked and only active subscriptions unlock access', async () => {
  const link = await masters();
  const env = require('../src/config/env');
  const { listCutoffs } = require('../src/modules/cutoffs/cutoffs.service');
  const { attachEntitlement } = require('../src/middlewares/checkEntitlement');
  const freeLimit = env.FREE_CUTOFF_ROWS;
  for (let n = 0; n < freeLimit + 2; n++) await CutOff.create({ collegeCourseId: link._id, category: 'General', quota: 'AIQ', authority: `Authority ${n}`, year: 2026, round: 'Round1', closingRank: n + 1000 });
  await draft('cutoffs', { ...definitions.cutoffs.sample, collegeCode: 'COL-001' });
  const free = await listCutoffs({ year: 2026 }, false);
  assert.equal(free.totalCount, freeLimit + 2); assert.equal(free.data.length, freeLimit); assert.equal(free.maskedPreview[0].closingRank, null);
  const guest = { isPremium: true }; await attachEntitlement()(guest, {}, (err) => { if (err) throw err; }); assert.equal(guest.isPremium, false);
  const account = { user: { id: String(owner), role: 'admin' }, isPremium: true };
  await attachEntitlement()(account, {}, (err) => { if (err) throw err; }); assert.equal(account.isPremium, false);
  const sub = await Subscription.create({ userId: owner, planId: new mongoose.Types.ObjectId(), status: 'active', expiryDate: new Date(Date.now() - 1000) });
  await attachEntitlement()(account, {}, (err) => { if (err) throw err; }); assert.equal(account.isPremium, false);
  await Subscription.updateOne({ _id: sub._id }, { $set: { expiryDate: new Date(Date.now() + 60000) } });
  await attachEntitlement()(account, {}, (err) => { if (err) throw err; }); assert.equal(account.isPremium, true);
  const premium = await listCutoffs({ year: 2026 }, account.isPremium); assert.equal(premium.lockedCount, 0); assert.equal(premium.data.length, Math.min(20, freeLimit + 2));
});

test('hostel and bond drafts publish through linked masters, preserve hostel history and support corrections', async () => {
  const link = await masters();
  const Hostel = require('../src/models/HostelFee'), Bond = require('../src/models/BondDetail');
  for (const [entity, input] of [
    ['hostel-fees', { collegeCode: 'COL-001', year: '2025', amount: '80000' }],
    ['hostel-fees', { collegeCode: 'COL-001', year: '2026', amount: '85000' }],
    ['bonds', { collegeCode: 'COL-001', courseSlug: 'mbbs', years: '1', penaltyAmount: '1000000', applicableStates: 'Maharashtra|Gujarat' }],
  ]) {
    const ready = await draft(entity, input);
    assert.equal(ready.status, 'ready');
    const submitted = await submit(ready);
    await workflow.publish(submitted, owner, submitted.revision);
  }
  assert.equal(await Hostel.countDocuments({ collegeId: link.collegeId }), 2);
  assert.deepEqual((await Bond.findOne({ collegeCourseId: link._id }).lean()).applicableStates, ['Maharashtra', 'Gujarat']);
  const detail = await require('../src/modules/colleges/colleges.service').getCollegeDetail(link.collegeId, false);
  assert.equal(detail.college.hostelMess, 85000);
  assert.equal(detail.college.bondYears, 1);
  assert.equal(detail.college.bondPenalty, 1000000);
  const hostel = await Hostel.findOne({ year: 2026 });
  const correction = await request(app).post('/imports/from-record').send({ entity: 'hostel-fees', id: String(hostel._id) });
  assert.equal(correction.status, 200);
  const ready = await workflow.validate(correction.body.data, { mapping: correction.body.data.mapping, revision: 0 });
  assert.equal(ready.totals.unchanged, 1);
  const bad = await draft('hostel-fees', { collegeCode: 'MISSING', year: '2026', amount: '1000' });
  assert.equal(bad.status, 'needs_correction');
});

test('single and bulk deletion enforce dependencies, permission, snapshots and atomic audit', async () => {
  const link = await masters();
  const collegeId = String(link.collegeId);
  const preview = await request(app).post('/catalog-deletion/preview').send({ entity: 'colleges', ids: [collegeId] });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.dependencies[0].section, 'college-courses');
  assert.equal((await request(app).post('/catalog-deletion/confirm').send({ entity: 'colleges', ids: [collegeId], fingerprint: preview.body.data.fingerprint, reason: 'Test removal' })).status, 409);
  assert.equal(await College.countDocuments(), 1);
  assert.equal((await request(app).post('/catalog-deletion/preview').set('x-editor', '1').send({ entity: 'colleges', ids: [collegeId] })).status, 403);
  const deletion = require('../src/modules/admin/catalogDelete.service');
  const fees = await Fee.create([2025, 2026].map((year) => ({ collegeCourseId: link._id, year, tier: 'merit', tuition: 10000 })));
  const ids = fees.map((fee) => String(fee._id));
  const original = await deletion.preview('fees', ids);
  await Fee.updateOne({ _id: ids[0] }, { $set: { tuition: 20000 } });
  await assert.rejects(deletion.remove({ entity: 'fees', ids, fingerprint: original.fingerprint, reason: 'Correct bad data', userId: owner }), { statusCode: 409 });
  assert.equal(await Fee.countDocuments(), 2);
  const fresh = await deletion.preview('fees', ids);
  const insert = Audit.insertMany;
  Audit.insertMany = async () => { throw new Error('Forced audit failure'); };
  try { await assert.rejects(deletion.remove({ entity: 'fees', ids, fingerprint: fresh.fingerprint, reason: 'Correct bad data', userId: owner }), /Forced audit failure/); }
  finally { Audit.insertMany = insert; }
  assert.equal(await Fee.countDocuments(), 2);
  const removed = await request(app).post('/catalog-deletion/confirm').send({ entity: 'fees', ids, fingerprint: fresh.fingerprint, reason: 'Correct bad data' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.deletedCount, 2);
  assert.equal(await Fee.countDocuments(), 0);
  assert.equal(await Audit.countDocuments({ action: 'delete', entity: 'Fee', 'before.tuition': { $exists: true } }), 2);
  const feeDraft = await submit(await draft('fees', { ...definitions.fees.sample, collegeCode: 'COL-001' }));
  const linkIds = [String(link._id)];
  const linkPreview = await deletion.preview('college-courses', linkIds);
  await deletion.remove({ entity: 'college-courses', ids: linkIds, fingerprint: linkPreview.fingerprint, reason: 'Remove wrong link', userId: owner });
  await assert.rejects(workflow.publish(feeDraft, owner, feeDraft.revision), { statusCode: 409 });
  assert.equal(await Fee.countDocuments(), 0);
  const finalPreview = await deletion.preview('colleges', [collegeId]);
  await deletion.remove({ entity: 'colleges', ids: [collegeId], fingerprint: finalPreview.fingerprint, reason: 'Remove wrong college', userId: owner });
  assert.equal(await College.countDocuments(), 0);
});

test('published OBC State cutoff appears by default and latest year/round drive the preview without unlocking paid rows', async () => {
  const link = await masters();
  for (const [year, round, closingRank] of [['2025', 'Stray', '100'], ['2026', 'Round1', '500'], ['2026', 'Round2', '900']]) {
    const ready = await draft('cutoffs', { ...definitions.cutoffs.sample, collegeCode: 'COL-001', category: 'OBC', quota: 'State', year, round, closingRank });
    const batch = await submit(ready); await workflow.publish(batch, owner, batch.revision);
  }
  const service = require('../src/modules/colleges/colleges.service');
  const summary = (await service.listColleges({})).data[0];
  assert.equal(summary.closingRank, 900);
  assert.equal(summary.closingRankCategory, 'OBC');
  assert.equal(summary.quota, 'State');
  assert.equal(summary.closingRankRound, 'Round2');
  const cutoffs = await require('../src/modules/cutoffs/cutoffs.service').listCutoffs({}, false);
  assert.equal(cutoffs.data[0].closingRank, 900);
  assert.equal(cutoffs.data[0].category, 'OBC');
  const detail = await service.getCollegeDetail(link.collegeId, false);
  assert.equal(detail.cutoffs.rows[0].courseName, 'MBBS');
  assert.equal(detail.cutoffs.rows[0].closingRank, 900);
  assert.equal(detail.college.hostelFeePublished, false);
  assert.equal(detail.college.bondPublished, false);
});
