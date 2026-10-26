const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const College = require('../src/models/College');
const Course = require('../src/models/Course');
const CollegeCourse = require('../src/models/CollegeCourse');
const Fee = require('../src/models/Fee');
const SeatMatrix = require('../src/models/SeatMatrix');
const CutOff = require('../src/models/CutOff');
const { listColleges } = require('../src/modules/colleges/colleges.service');
const { listCutoffs } = require('../src/modules/cutoffs/cutoffs.service');
const { listColleges: validation } = require('../src/modules/colleges/colleges.validation');
const env = require('../src/config/env');
let server, target, nursing, medicine, nursingLink, medicalLink;
before(async () => {
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('college-filters-test'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  [nursing, medicine] = await Course.create([{ name: 'B.Sc. Nursing', slug: 'bsc-nursing' }, { name: 'MBBS', slug: 'mbbs' }]);
  await College.insertMany(Array.from({ length: 55 }, (_, index) => ({ name: `A college ${String(index).padStart(2, '0')}`, collegeCode: `TEST-${index}`, city: 'Pune', state: 'Maharashtra', ownership: 'govt' })));
  target = await College.create({ name: 'Z Nursing (West)', collegeCode: 'TEST-TARGET', city: 'Ahmedabad', state: 'Gujarat', ownership: 'private' });
  [nursingLink, medicalLink] = await CollegeCourse.create([{ collegeId: target._id, courseId: nursing._id, totalSeats: 60 }, { collegeId: target._id, courseId: medicine._id, totalSeats: 100 }]);
  await Fee.create([
    { collegeCourseId: nursingLink._id, year: 2025, tier: 'merit', tuition: 10000 },
    { collegeCourseId: nursingLink._id, year: 2026, tier: 'merit', tuition: 200000 },
    { collegeCourseId: nursingLink._id, year: 2026, tier: 'management', tuition: 700000 },
    { collegeCourseId: medicalLink._id, year: 2026, tier: 'merit', tuition: 50000 },
  ]);
  await SeatMatrix.create({ collegeCourseId: nursingLink._id, category: 'OBC', quota: 'Management', year: 2026, round: 'Round1', authority: 'Test authority', seats: 10 });
  await CutOff.insertMany(Array.from({ length: 25 }, (_, index) => ({ collegeCourseId: medicalLink._id, category: 'OBC', quota: 'State', authority: `Test authority ${index}`, year: 2026, round: 'Round1', closingRank: 1000 + index })));
});
after(async () => { await mongoose.disconnect(); if (server) await server.stop(); });

test('state and partial searches apply before pagination, with stable totals and no invented fees', async () => {
  const first = await listColleges({ page: 1, limit: 24 });
  assert.equal(first.pagination.total, 56);
  assert.equal(first.pagination.totalPages, 3);
  assert.equal(first.data[0].feeFrom, null);
  const last = await listColleges({ page: 3, limit: 24 });
  assert.equal(last.data.length, 8);
  assert.ok(last.data.some((row) => String(row._id) === String(target._id)));
  for (const filters of [{ state: 'Gujarat' }, { search: 'Nurs' }, { search: '(West)' }, { search: 'Ahmed' }]) {
    const result = await listColleges(filters);
    assert.equal(result.pagination.total, 1);
    assert.equal(String(result.data[0]._id), String(target._id));
  }
  assert.equal((await listColleges({ search: '.*' })).pagination.total, 0);
});
test('course, category, quota and latest fees intersect on the same college-course', async () => {
  assert.equal((await listColleges({ course: 'bsc-nursing', maxFee: 99999 })).pagination.total, 0);
  assert.equal((await listColleges({ course: 'mbbs', category: 'OBC', quota: 'Management' })).pagination.total, 0);
  const result = await listColleges({ course: 'bsc-nursing', category: 'OBC', quota: 'Management', minFee: 500001 });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.data[0].feeFrom, 700000);
  assert.equal(result.data[0].seats, 60);
  assert.deepEqual(result.data[0].courses.sort(), ['B.Sc. Nursing', 'MBBS']);
  assert.equal((await listColleges({ category: 'OBC-NCL', quota: 'Management' })).pagination.total, 0);
  assert.equal((await listColleges({ maxFee: 99999 })).pagination.total, 1);
  assert.equal((await listColleges({ course: 'not-published' })).pagination.total, 0);
  assert.equal(validation.query.safeParse({ minFee: '100', maxFee: '10' }).success, false);
});
test('state aliases find existing imported spellings', async () => {
  await College.create({ name: 'Alias test', collegeCode: 'TEST-ALIAS', city: 'Delhi', state: 'New Delhi', ownership: 'govt' });
  assert.equal((await listColleges({ state: 'Delhi' })).pagination.total, 1);
  assert.equal((await listColleges({ state: 'delhi' })).pagination.total, 1);
});
test('cutoff state/search/category filters preserve premium pagination and free masking', async () => {
  const filters = { course: 'mbbs', category: 'OBC', quota: 'State', state: 'Gujarat', search: '(West)', year: 2026, limit: 20 };
  const first = await listCutoffs({ ...filters, page: 1 }, true);
  const next = await listCutoffs({ ...filters, page: 2 }, true);
  assert.equal(first.totalCount, 25);
  assert.equal(first.data.length, 20);
  assert.equal(next.data.length, 5);
  assert.ok(next.data.every((row) => !first.data.some((prior) => String(prior.id) === String(row.id))));
  const guest = await listCutoffs({ ...filters, page: 2 }, false);
  assert.equal(guest.page, 1);
  assert.equal(guest.data.length, Math.min(env.FREE_CUTOFF_ROWS, 25));
  assert.equal(guest.lockedCount, 25 - guest.data.length);
  assert.ok(guest.maskedPreview.every((row) => row.closingRank === null && row.collegeName !== target.name));
  assert.equal((await listCutoffs({ ...filters, state: 'Maharashtra' }, true)).totalCount, 0);
});
