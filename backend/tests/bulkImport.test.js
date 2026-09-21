jest.mock('../src/models/College', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../src/models/Course', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/CollegeCourse', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../src/models/CutOff', () => ({ updateOne: jest.fn() }));
jest.mock('../src/models/Fee', () => ({ updateOne: jest.fn() }));
jest.mock('../src/models/SeatMatrix', () => ({ updateOne: jest.fn() }));
jest.mock('../src/modules/admin/audit.helper', () => ({ recordAudit: jest.fn() }));

const College = require('../src/models/College');
const Course = require('../src/models/Course');
const CollegeCourse = require('../src/models/CollegeCourse');
const CutOff = require('../src/models/CutOff');
const Fee = require('../src/models/Fee');
const SeatMatrix = require('../src/models/SeatMatrix');
const { bulkImport } = require('../src/modules/admin/bulkImport.service');
const { recordAudit } = require('../src/modules/admin/audit.helper');
const collegeHeader = 'name,city,state,ownership,nmcApproved';
const collegeRow = 'Example College,Pune,Maharashtra,govt,true';
const csv = (content) => Buffer.from(content);

beforeEach(() => {
  jest.clearAllMocks();
  College.findOne.mockResolvedValue({ _id: 'college' });
  Course.findOne.mockResolvedValue({ _id: 'course' });
  CollegeCourse.findOne.mockResolvedValue({ _id: 'link' });
  for (const model of [College, CollegeCourse, CutOff, Fee, SeatMatrix]) model.updateOne.mockResolvedValue({ upsertedCount: 1 });
});

test('accepts Excel UTF-8 BOM and previews without any writes or audit mutations', async () => {
  const result = await bulkImport('colleges', csv(`\uFEFF${collegeHeader}\r\n${collegeRow}`), 'admin', true);
  expect(result).toMatchObject({ total: 1, valid: 1, failed: 0, dryRun: true, succeeded: 0 });
  expect(result.preview[0].nmcApproved).toBe(true);
  expect(College.updateOne).not.toHaveBeenCalled();
  expect(recordAudit).not.toHaveBeenCalled();
});

test.each([
  ['name,city,state\nA,Pune,Maharashtra', /Missing columns/],
  ['name,name,city,state,ownership\nA,A,Pune,Maharashtra,govt', /Duplicate column/],
  ['name,city,state,ownership,typo\nA,Pune,Maharashtra,govt,x', /Unknown columns/],
  [collegeHeader, /no data rows/],
  [`${collegeHeader}\n"unterminated`, /Invalid CSV/],
])('rejects invalid headers or CSV before writes: %s', async (content, message) => {
  await expect(bulkImport('colleges', csv(content), 'admin')).rejects.toThrow(message);
  expect(College.updateOne).not.toHaveBeenCalled();
});

test('a bad row blocks the entire batch and reports its CSV line', async () => {
  const result = await bulkImport('colleges', csv(`${collegeHeader}\n${collegeRow}\nOther,Pune,Maharashtra,wrong,true`), 'admin');
  expect(result).toMatchObject({ blocked: true, succeeded: 0, valid: 1, failed: 1 });
  expect(result.errors[0]).toMatchObject({ row: 3 });
  expect(College.updateOne).not.toHaveBeenCalled();
});

test('rejects duplicate natural keys within one CSV', async () => {
  const result = await bulkImport('colleges', csv(`${collegeHeader}\n${collegeRow}\n${collegeRow}`), 'admin');
  expect(result.errors[0].message).toMatch(/Duplicate record/);
  expect(College.updateOne).not.toHaveBeenCalled();
});

test('blank optional values do not reset approval or images on existing colleges', async () => {
  College.updateOne.mockResolvedValue({ upsertedCount: 0 });
  const result = await bulkImport('colleges', csv(`${collegeHeader},images\nExample College,Pune,Maharashtra,govt,,`), 'admin');
  expect(result).toMatchObject({ succeeded: 1, updated: 1, created: 0 });
  expect(College.updateOne.mock.calls[0][1].$set).not.toHaveProperty('nmcApproved');
  expect(College.updateOne.mock.calls[0][1].$set).not.toHaveProperty('images');
});

test('rejects incorrect approval values instead of silently converting to false', async () => {
  const result = await bulkImport('colleges', csv(`${collegeHeader}\nA,Pune,Maharashtra,govt,yes`), 'admin');
  expect(result.errors[0].message).toMatch(/true or false/);
});

test('validates numeric fields before attempting database writes', async () => {
  const result = await bulkImport('fees', csv('collegeName,city,courseSlug,year,tier,tuition\nA,Pune,mbbs,2026,merit,invalid'), 'admin');
  expect(result.blocked).toBe(true);
  expect(Fee.updateOne).not.toHaveBeenCalled();
});

test('missing references block an import and explain which prerequisite is missing', async () => {
  CollegeCourse.findOne.mockResolvedValue(null);
  const result = await bulkImport('fees', csv('collegeName,city,courseSlug,year,tier,tuition\nA,Pune,mbbs,2026,merit,0'), 'admin', true);
  expect(result.errors[0].message).toMatch(/Import links first/);
});

test('seat matrix reimports update the same key and keep other years separate', async () => {
  SeatMatrix.updateOne.mockResolvedValue({ upsertedCount: 0 });
  const header = 'collegeName,city,courseSlug,authority,category,quota,round,year,seats';
  const result = await bulkImport('seat-matrix', csv(`${header}\nA,Pune,mbbs,MCC,General,AIQ,Round1,2025,20\nA,Pune,mbbs,MCC,General,AIQ,Round1,2026,0`), 'admin');
  expect(result).toMatchObject({ succeeded: 2, updated: 2 });
  expect(SeatMatrix.updateOne.mock.calls.map(([filter]) => filter.year)).toEqual([2025, 2026]);
  expect(SeatMatrix.updateOne.mock.calls[0][0]).toEqual({ collegeCourseId: 'link', authority: 'MCC', category: 'General', quota: 'AIQ', round: 'Round1', year: 2025 });
});

test('database failure reports partial outcome and audit totals without pretending a rollback', async () => {
  College.updateOne.mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce({ upsertedCount: 1 });
  const result = await bulkImport('colleges', csv(`${collegeHeader}\n${collegeRow}\nOther,Pune,Maharashtra,govt,true`), 'admin');
  expect(result).toMatchObject({ blocked: false, failed: 1, succeeded: 1, created: 1 });
  expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ failed: 1, succeeded: 1 }) }));
});
