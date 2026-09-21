const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { workbook, publishCatalogue } = require('../src/modules/courses/publishCatalogue');
const { courses } = require('../src/data/medicalCourses');
const { readSheet } = require('../src/modules/admin/spreadsheet');
const { normalize, definitions } = require('../src/modules/admin/importDefinitions');
const { prepareStorage } = require('../src/modules/admin/importStorage');
let server;
before(async () => {
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('course-catalogue-test'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  await prepareStorage();
});
after(async () => { await mongoose.disconnect(); if (server) await server.stop(); });
test('all master rows survive Excel parsing, including source links and admission routes', async () => {
  const parsed = await readSheet(await workbook(), 'courses.xlsx', 'Courses');
  assert.equal(parsed.rows.length, courses.length);
  assert.equal(new Set(courses.map((course) => course.slug)).size, courses.length);
  const rows = parsed.rows.map((row) => normalize(row.input, definitions.courses.schema));
  assert.equal(rows.find((row) => row.slug === 'bsc-nursing').admissionRoute, 'institution-specific');
  assert.equal(rows.find((row) => row.slug === 'mbbs').admissionRoute, 'neet-ug');
  for (const row of rows) { assert.ok(row.sourceUrls.length); assert.ok(row.reviewedOn); }
});
test('publishing is audited, preserves existing course IDs/content, leaves other datasets alone, and is repeatable', async () => {
  const User = mongoose.model('User'), Role = mongoose.model('Role'), Admin = mongoose.model('AdminUser');
  const Course = mongoose.model('Course'), College = mongoose.model('College');
  const user = await User.create({ name: 'Catalogue test owner', role: 'admin' });
  const role = await Role.create({ name: 'super_admin', permissions: ['*'] });
  await Admin.create({ userId: user._id, roleId: role._id });
  const existing = await Course.create({ name: 'MBBS', slug: 'mbbs', description: 'Existing approved content' });
  const college = await College.create({ name: 'Existing college', collegeCode: 'TEST-001', city: 'Pune', state: 'Maharashtra', ownership: 'govt' });
  const result = await publishCatalogue(user._id);
  assert.equal(result.inserted, courses.length - 1);
  assert.equal(await Course.countDocuments(), courses.length);
  assert.equal((await Course.findById(existing._id)).description, 'Existing approved content');
  assert.equal(await College.countDocuments(), 1);
  assert.ok(await College.findById(college._id));
  assert.equal(await mongoose.model('CutOff').countDocuments(), 0);
  assert.equal(await mongoose.model('Fee').countDocuments(), 0);
  assert.equal(await mongoose.model('CollegeCourse').countDocuments(), 0);
  assert.equal(await mongoose.model('AuditLog').countDocuments({ action: 'publish_import', entity: 'Course' }), 1);
  assert.equal((await mongoose.model('ImportBatch').findById(result.batchId)).status, 'published');
  assert.equal((await publishCatalogue(user._id)).inserted, 0);
  assert.equal(await mongoose.model('ImportBatch').countDocuments(), 1);
});
