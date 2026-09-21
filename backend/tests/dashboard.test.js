jest.mock('../src/models/SavedCollege', () => ({ find: jest.fn(), distinct: jest.fn() }));
jest.mock('../src/models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Download', () => ({ find: jest.fn() }));
jest.mock('../src/models/Booking', () => ({ find: jest.fn() }));
jest.mock('../src/models/Prediction', () => ({ find: jest.fn() }));
jest.mock('../src/models/Setting', () => ({ findOne: jest.fn() }));
jest.mock('../src/modules/colleges/colleges.service', () => ({ attachSummary: jest.fn(async (college) => ({ ...college, seats: 150 })) }));
const SavedCollege = require('../src/models/SavedCollege');
const Subscription = require('../src/models/Subscription');
const Download = require('../src/models/Download');
const Booking = require('../src/models/Booking');
const Prediction = require('../src/models/Prediction');
const Setting = require('../src/models/Setting');
const { getOverview } = require('../src/modules/dashboard/dashboard.service');
function query(value) {
  const chain = { populate: () => chain, sort: () => chain, limit: () => chain, lean: async () => value };
  return chain;
}
beforeEach(() => {
  SavedCollege.find.mockReturnValue(query([{ collegeId: { _id: 'published', isActive: true } }, { collegeId: null }, { collegeId: { _id: 'draft', isActive: false } }]));
  SavedCollege.distinct.mockResolvedValue(Array.from({ length: 15 }, (_, index) => `college-${index}`));
  Subscription.findOne.mockReturnValue(query(null));
  for (const model of [Download, Booking, Prediction]) model.find.mockReturnValue(query([]));
  Setting.findOne.mockReturnValue(query(null));
});

test('saved IDs are not truncated to the dashboard preview and previews exclude unpublished colleges', async () => {
  const result = await getOverview('user');
  expect(result.savedCollegeIds).toHaveLength(15);
  expect(result.savedColleges).toEqual([{ collegeId: { _id: 'published', isActive: true, seats: 150 } }]);
});

test('does not fabricate a deadline when none is configured or the configured deadline expired', async () => {
  expect((await getOverview('user')).nextDeadline).toBeNull();
  Setting.findOne.mockReturnValue(query({ value: { enabled: true, title: 'Old deadline', date: new Date(Date.now() - 1000) } }));
  expect((await getOverview('user')).nextDeadline).toBeNull();
});

test('returns a verified enabled future deadline and its source', async () => {
  const value = { enabled: true, title: 'Choice filling', date: new Date(Date.now() + 86400000), sourceUrl: 'https://example.com/official-notice' };
  Setting.findOne.mockReturnValue(query({ value }));
  expect((await getOverview('user')).nextDeadline).toEqual(value);
});
