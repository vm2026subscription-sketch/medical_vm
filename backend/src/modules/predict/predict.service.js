const CutOff = require('../../models/CutOff');
const CollegeCourse = require('../../models/CollegeCourse');
const Course = require('../../models/Course');
const Prediction = require('../../models/Prediction');
const Fee = require('../../models/Fee');
const { stateMatch } = require('../../utils/catalogFilters');
const { stages: cutoffOrder } = require('../../utils/cutoffOrder');

/**
 * Rules-based seat-probability model.
 *
 * probability is a simple monotonic function of how much slack the student's rank has
 * versus last year's closing rank for that category/quota:
 *   slack = (closingRank - studentRank) / closingRank
 *   probability = clamp(50 + slack * 140, 2, 98)
 * A positive slack (student's rank is BETTER/lower than the closing rank) pushes
 * probability up; a negative slack (rank is worse/higher) pushes it down.
 *
 * This is intentionally simple and transparent (matches the "why this pick" UX requirement).
 * Swap this function out for a trained model later — callers only depend on
 * generateSeatMatch()'s return shape, not its internals.
 */
function computeProbability(studentRank, closingRank) {
  const slack = (closingRank - studentRank) / closingRank;
  const raw = 50 + slack * 140;
  return Math.round(Math.min(Math.max(raw, 2), 98));
}

function bucketFor(probability) {
  if (probability >= 75) return 'safe';
  if (probability >= 40) return 'target';
  return 'dream';
}

async function generateSeatMatch({ userId, rank, category, state, budget, courseSlugs, isPremium }) {
  const courses = await Course.find({ slug: { $in: courseSlugs } }).lean();
  const courseIds = courses.map((c) => c._id);
  const courseNameById = Object.fromEntries(courses.map((c) => [c._id.toString(), c.name]));

  const links = await CollegeCourse.find({ courseId: { $in: courseIds } })
    .populate({ path: 'collegeId', match: { isActive: true } })
    .lean();
  const linkById = Object.fromEntries(links.map((l) => [l._id.toString(), l]));
  const collegeCourseIds = links.map((l) => l._id);

  // Use published rounds for AIQ or the student's home-state quota only.
  const cutoffs = await CutOff.aggregate([{ $match: {
    collegeCourseId: { $in: collegeCourseIds }, category, quota: { $in: ['AIQ', 'State'] }, closingRank: { $gt: 0 },
  } }, ...cutoffOrder()]);
  const homeState = stateMatch(state);
  const latestFees = budget !== undefined ? await Fee.aggregate([
    { $match: { collegeCourseId: { $in: collegeCourseIds }, tier: 'merit' } },
    { $sort: { year: -1, _id: -1 } },
    { $group: { _id: '$collegeCourseId', tuition: { $first: '$tuition' } } },
  ]) : [];
  const tuitionByLink = new Map(latestFees.map((fee) => [String(fee._id), fee.tuition]));

  const latestByCollegeCourse = new Map();
  for (const c of cutoffs) {
    const key = c.collegeCourseId.toString();
    const college = linkById[key]?.collegeId;
    if (!college || (c.quota === 'State' && !homeState.test(college.state))) continue;
    if (budget !== undefined && (tuitionByLink.get(key) == null || tuitionByLink.get(key) > budget)) continue;
    if (!latestByCollegeCourse.has(key)) latestByCollegeCourse.set(key, c);
  }

  let results = [];
  for (const [collegeCourseId, cutoff] of latestByCollegeCourse.entries()) {
    const link = linkById[collegeCourseId];
    if (!link || !link.collegeId) continue;

    const probability = computeProbability(rank, cutoff.closingRank);
    const bucket = bucketFor(probability);

    const rankDiff = cutoff.closingRank - rank;
    const reason =
      rankDiff >= 0
        ? `Your rank clears the published ${cutoff.year} ${cutoff.quota} ${cutoff.round} closing rank by ${rankDiff.toLocaleString('en-IN')}`
        : `A stretch — ${Math.abs(rankDiff).toLocaleString('en-IN')} above the published ${cutoff.year} ${cutoff.quota} ${cutoff.round} closing rank`;

    results.push({
      collegeCourseId: link._id,
      collegeName: link.collegeId.name,
      courseName: courseNameById[link.courseId?.toString()] || courseNameById[Object.keys(courseNameById)[0]],
      bucket,
      probability,
      reason,
      year: cutoff.year,
      closingRank: cutoff.closingRank,
    });
  }

  results.sort((a, b) => b.probability - a.probability);

  // Free tier: return only the top overall matches (no full dream/target/safe breakdown export).
  if (!isPremium) {
    results = results.slice(0, 5);
  }

  const grouped = {
    dream: results.filter((r) => r.bucket === 'dream'),
    target: results.filter((r) => r.bucket === 'target'),
    safe: results.filter((r) => r.bucket === 'safe'),
  };

  const prediction = await Prediction.create({
    userId,
    input: { rank, category, state, budget, courses: courseSlugs },
    result: results.map((r) => ({
      collegeCourseId: r.collegeCourseId,
      collegeName: r.collegeName,
      courseName: r.courseName,
      bucket: r.bucket,
      probability: r.probability,
      reason: r.reason,
    })),
    isPremiumRun: isPremium,
  });

  return {
    predictionId: prediction._id,
    best: results.slice(0, 10),
    grouped,
    counts: { dream: grouped.dream.length, target: grouped.target.length, safe: grouped.safe.length },
    isPremiumRun: isPremium,
  };
}

async function getHistory(userId) {
  return Prediction.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
}

module.exports = { generateSeatMatch, getHistory };
