const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const News = require('../src/models/NewsNotification');
require('../src/models/NotificationRead');
const College = require('../src/models/College');
const Course = require('../src/models/Course');
const Link = require('../src/models/CollegeCourse');
const Fee = require('../src/models/Fee');
const Cutoff = require('../src/models/CutOff');
const Counsellor = require('../src/models/Counsellor');
const Slot = require('../src/models/AvailabilitySlot');
const Setting = require('../src/models/Setting');
const notifications = require('../src/modules/notifications/notifications.service');
const content = require('../src/modules/content/content.service');
const { generateSeatMatch } = require('../src/modules/predict/predict.service');
const { listSlotsForDate } = require('../src/modules/counselling/counselling.service');
const oid = () => new mongoose.Types.ObjectId();
let server;
before(async () => {
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('production-flows-test'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
});
after(async () => { await mongoose.disconnect(); if (server) await server.stop(); });

test('broadcast reads are isolated by user; private and future notifications stay hidden', async () => {
  const alice = oid(), bob = oid();
  const broadcast = await News.create({ title: 'Notice', body: 'Official details', isRead: true, attachments: [{ name: 'Round schedule.pdf', url: 'https://files.example.test/round-schedule.pdf', mime: 'application/pdf', size: 1024 }] });
  const privateNotice = await News.create({ userId: bob, title: 'Private', body: 'For Bob' });
  const future = await News.create({ title: 'Scheduled', body: 'Later', scheduledFor: new Date(Date.now() + 86400000) });
  assert.equal((await notifications.listForUser(alice, {})).data.length, 1);
  assert.equal((await notifications.listForUser(alice, {})).data[0].isRead, false);
  assert.equal((await notifications.listForUser(alice, {})).data[0].attachments[0].name, 'Round schedule.pdf');
  await notifications.markRead(alice, broadcast._id);
  assert.equal((await notifications.listForUser(alice, {})).data[0].isRead, true);
  const bobPage = await notifications.listForUser(bob, {});
  assert.equal(bobPage.data.find((row) => row._id.equals(broadcast._id)).isRead, false);
  await assert.rejects(notifications.markRead(alice, privateNotice._id), { statusCode: 404 });
  await assert.rejects(notifications.markRead(alice, future._id), { statusCode: 404 });
  await notifications.markAllRead(bob);
  assert.ok((await notifications.listForUser(bob, {})).data.every((row) => row.isRead));
  await News.updateOne({ _id: future._id }, { $set: { scheduledFor: new Date(Date.now() - 1) } });
  const scheduled = (await notifications.listForUser(bob, {})).data.find((row) => row._id.equals(future._id));
  assert.equal(scheduled.isRead, false);
});

test('public footer settings stay empty until an administrator saves contacts or links', async () => {
  assert.deepEqual(await content.getFooterSettings(), { contacts: [], links: [] });
  const value = {
    contacts: [{ type: 'email', label: 'Admissions', value: 'contact@example.test' }],
    links: [{ icon: 'instagram', label: 'Instagram', url: 'https://instagram.com/example' }],
  };
  await Setting.create({ key: 'footer_settings', value });
  assert.deepEqual(await content.getFooterSettings(), value);
});

test('seat matches respect home-state quota, latest tuition budget, latest round and exclude NRI', async () => {
  const course = await Course.create({ name: 'MBBS', slug: 'mbbs' });
  const links = [];
  for (const [index, state] of ['Maharashtra', 'Gujarat', 'Gujarat', 'Maharashtra', 'Maharashtra'].entries()) {
    const college = await College.create({ name: `Match ${index}`, collegeCode: `MATCH-${index}`, city: 'Test city', state, ownership: 'govt' });
    links.push(await Link.create({ collegeId: college._id, courseId: course._id, totalSeats: 60 }));
  }
  await Cutoff.create(links.map((link, index) => ({ collegeCourseId: link._id, category: 'General', quota: index === 2 ? 'AIQ' : index === 3 ? 'NRI' : 'State', authority: 'Test', year: 2026, round: 'Round1', closingRank: 10000 })));
  await Cutoff.create({ collegeCourseId: links[0]._id, category: 'General', quota: 'State', authority: 'Test', year: 2026, round: 'Round2', closingRank: 12000 });
  await Fee.create(links.slice(0, 4).map((link) => ({ collegeCourseId: link._id, year: 2025, tier: 'merit', tuition: 20000 })));
  await Fee.create({ collegeCourseId: links[2]._id, year: 2026, tier: 'merit', tuition: 200000 });
  const input = { userId: oid(), rank: 5000, category: 'General', state: 'Maharashtra', courseSlugs: ['mbbs'], isPremium: true };
  const budget = await generateSeatMatch({ ...input, budget: 50000 });
  assert.deepEqual(budget.best.map((row) => row.collegeName), ['Match 0']);
  assert.equal(budget.best[0].closingRank, 12000);
  assert.match(budget.best[0].reason, /2026 State Round2/);
  const all = await generateSeatMatch(input);
  assert.deepEqual(all.best.map((row) => row.collegeName).sort(), ['Match 0', 'Match 2', 'Match 4']);
});

test('public slots use Indian calendar dates and never expose hold credentials or past slots', async () => {
  const counsellor = await Counsellor.create({ userId: oid(), pricePerSession: 100 });
  const inactive = await Counsellor.create({ userId: oid(), pricePerSession: 100, isActive: false });
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+05:30`);
  await Slot.create([
    { counsellorId: counsellor._id, datetime: new Date(start.getTime() - 1), status: 'open' },
    { counsellorId: counsellor._id, datetime: start, status: 'held', holdToken: 'private-token', heldByUserId: oid(), heldUntil: new Date(Date.now() + 86400000) },
    { counsellorId: counsellor._id, datetime: new Date(start.getTime() + 86400000), status: 'open' },
    { counsellorId: counsellor._id, datetime: new Date(Date.now() - 60000), status: 'open' },
  ]);
  const slots = await listSlotsForDate(counsellor._id, day);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].datetime.getTime(), start.getTime());
  assert.deepEqual(Object.keys(slots[0]).sort(), ['_id', 'datetime', 'status']);
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  assert.equal((await listSlotsForDate(counsellor._id, today)).length, 0);
  await assert.rejects(listSlotsForDate(inactive._id, day), { statusCode: 404 });
});
