const SavedCollege = require('../../models/SavedCollege');
const Subscription = require('../../models/Subscription');
const Download = require('../../models/Download');
const Booking = require('../../models/Booking');
const Prediction = require('../../models/Prediction');
const Setting = require('../../models/Setting');
const { attachSummary } = require('../colleges/colleges.service');

async function getOverview(userId) {
  const [savedColleges, activeSub, downloads, recentBookings, recentPredictions, deadline, savedCollegeIds] = await Promise.all([
    SavedCollege.find({ userId }).populate('collegeId').sort({ createdAt: -1 }).limit(10).lean(),
    Subscription.findOne({ userId, status: 'active', expiryDate: { $gt: new Date() } }).sort({ expiryDate: -1 }).lean(),
    Download.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Booking.find({ userId }).sort({ createdAt: -1 }).limit(5).populate('counsellorId').lean(),
    Prediction.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    Setting.findOne({ key: 'counselling_deadline' }).lean(),
    SavedCollege.distinct('collegeId', { userId }),
  ]);

  return {
    nextDeadline: deadline?.value?.enabled && new Date(deadline.value.date) > new Date() ? deadline.value : null,
    isPremium: !!activeSub,
    subscription: activeSub,
    savedCollegeIds: savedCollegeIds.map(String),
    savedColleges: await Promise.all(savedColleges.filter((s) => s.collegeId?.isActive).map(async (s) => ({ ...s, collegeId: await attachSummary(s.collegeId) }))),
    downloads,
    recentActivity: [
      ...recentBookings.map((b) => ({ type: 'booking', at: b.createdAt, data: b })),
      ...recentPredictions.map((p) => ({ type: 'prediction', at: p.createdAt, data: p })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 10),
  };
}

module.exports = { getOverview };
