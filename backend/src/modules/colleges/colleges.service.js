const College = require('../../models/College');
const CollegeCourse = require('../../models/CollegeCourse');
const Course = require('../../models/Course');
const Fee = require('../../models/Fee');
const HostelFee = require('../../models/HostelFee');
const BondDetail = require('../../models/BondDetail');
const CutOff = require('../../models/CutOff');
const SavedCollege = require('../../models/SavedCollege');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const env = require('../../config/env');
const SeatMatrix = require('../../models/SeatMatrix');
const { escapeRegex, stateMatch } = require('../../utils/catalogFilters');
const { stages: cutoffOrder } = require('../../utils/cutoffOrder');

async function listColleges(filters) {
  const { page, limit, skip } = parsePagination(filters);
  const query = { isActive: true };

  if (filters.state) query.state = stateMatch(filters.state);
  if (filters.ownership) query.ownership = filters.ownership;
  if (filters.search) query.$or = ['name', 'city', 'state'].map((field) => ({ [field]: new RegExp(escapeRegex(filters.search.trim()), 'i') }));

  const linkQuery = {};
  if (filters.course) {
    const course = await Course.findOne({ slug: filters.course }).lean();
    if (course) {
      linkQuery.courseId = course._id;
    } else {
      // course filter given but doesn't exist -> no results
      return paginatedResponse({ data: [], total: 0, page, limit });
    }
  }

  // Intersect at the college-course level so a nursing fee cannot match an MBBS filter.
  let matchedLinks;
  if (filters.category || filters.quota) {
    const match = {};
    if (filters.category) match.category = filters.category;
    if (filters.quota) match.quota = filters.quota;
    const ids = await Promise.all([SeatMatrix.distinct('collegeCourseId', match), CutOff.distinct('collegeCourseId', match)]);
    matchedLinks = [...new Map(ids.flat().map((id) => [String(id), id])).values()];
  }
  const hasFeeFilter = filters.minFee !== undefined || filters.maxFee !== undefined;
  if (hasFeeFilter) {
    const tuition = { $type: 'number' };
    if (filters.minFee !== undefined) tuition.$gte = filters.minFee;
    if (filters.maxFee !== undefined) tuition.$lte = filters.maxFee;
    const latestFees = await Fee.aggregate([
      { $sort: { year: -1, _id: -1 } },
      { $group: { _id: { link: '$collegeCourseId', tier: '$tier' }, tuition: { $first: '$tuition' } } },
      { $match: { tuition } },
    ]);
    const feeIds = latestFees.map((fee) => fee._id.link);
    const keys = new Set(feeIds.map(String));
    matchedLinks = matchedLinks ? matchedLinks.filter((id) => keys.has(String(id))) : feeIds;
  }
  if (matchedLinks) linkQuery._id = { $in: matchedLinks };
  if (Object.keys(linkQuery).length) query._id = { $in: await CollegeCourse.distinct('collegeId', linkQuery) };

  const [data, total] = await Promise.all([
    College.find(query).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    College.countDocuments(query),
  ]);

  const withSummary = await Promise.all(data.map((college) => attachSummary(college, { courseId: linkQuery.courseId, matchedLinks, minFee: filters.minFee, maxFee: filters.maxFee })));

  return paginatedResponse({ data: withSummary, total, page, limit });
}

/**
 * attachSummary — enriches a bare College doc with the fields the card/list UI needs
 * (courses offered, total seats, latest merit/private fee, latest hostel fee, bond terms,
 * and the best available closing rank) without requiring the caller to hit the full
 * detail endpoint. Kept as light aggregate queries since catalog size is small; move to a
 * precomputed/cached summary collection if this list grows into the tens of thousands.
 */
async function attachSummary(college, { courseId, matchedLinks, minFee, maxFee } = {}) {
  const links = await CollegeCourse.find({ collegeId: college._id }).populate('courseId').lean();
  const selectedLinks = links.filter((link) => (!courseId || String(link.courseId?._id) === String(courseId)) && (!matchedLinks || matchedLinks.some((id) => String(id) === String(link._id))));
  const collegeCourseIds = selectedLinks.map((l) => l._id);
  // A partial sum would look like a complete intake. Unknown links keep the total unknown.
  const totalSeats = selectedLinks.length && selectedLinks.every((link) => link.totalSeats != null)
    ? selectedLinks.reduce((sum, link) => sum + link.totalSeats, 0) : null;
  const courseCodes = links.map((l) => l.courseId?.name).filter(Boolean);

  const [latestFees, hostelFee, bond, previewCutoffs, latestCutoff] = await Promise.all([
    Fee.aggregate([
      { $match: { collegeCourseId: { $in: collegeCourseIds } } },
      { $sort: { year: -1, _id: -1 } },
      { $group: { _id: { link: '$collegeCourseId', tier: '$tier' }, tuition: { $first: '$tuition' } } },
    ]),
    HostelFee.findOne({ collegeId: college._id }).sort({ year: -1 }).lean(),
    BondDetail.findOne({ collegeCourseId: { $in: collegeCourseIds } }).lean(),
    // One public preview row; the full cutoff table retains entitlement checks.
    CutOff.aggregate([{ $match: { collegeCourseId: { $in: collegeCourseIds } } }, ...cutoffOrder(), { $limit: 1 }]),
    CutOff.findOne({ collegeCourseId: { $in: collegeCourseIds } }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
  ]);
  const bestCutoff = previewCutoffs[0];
  const minimumFee = (fees) => {
    const amounts = fees.map((fee) => fee.tuition).filter((amount) => typeof amount === 'number' && Number.isFinite(amount));
    return amounts.length ? Math.min(...amounts) : null;
  };

  return {
    ...college,
    courses: courseCodes,
    seats: totalSeats,
    feeMerit: minimumFee(latestFees.filter((fee) => fee._id.tier === 'merit')),
    feePrivate: minimumFee(latestFees.filter((fee) => fee._id.tier !== 'merit')),
    feeFrom: minimumFee(latestFees.filter((fee) => (minFee === undefined || fee.tuition >= minFee) && (maxFee === undefined || fee.tuition <= maxFee))),
    hostelMess: hostelFee?.amount ?? null,
    bondYears: bond?.years ?? null,
    bondPenalty: bond?.penaltyAmount ?? null,
    hostelFeePublished: hostelFee?.amount != null,
    bondPublished: bond?.years != null || bond?.penaltyAmount != null,
    cutoffUpdatedAt: latestCutoff?.updatedAt || null,
    closingRankYear: bestCutoff?.year || null,
    closingRankRound: bestCutoff?.round || null,
    closingRankCategory: bestCutoff?.category || null,
    closingRankCourse: selectedLinks.find((link) => String(link._id) === String(bestCutoff?.collegeCourseId))?.courseId?.name || null,
    closingRank: bestCutoff?.closingRank ?? null,
    quota: bestCutoff?.quota ?? null,
  };
}

async function getCollegeDetail(collegeId, isPremium) {
  const college = await College.findById(collegeId).lean();
  if (!college || !college.isActive) throw ApiError.notFound('College not found');

  const collegeCourses = await CollegeCourse.find({ collegeId }).populate('courseId').lean();
  const collegeCourseIds = collegeCourses.map((cc) => cc._id);

  const [fees, hostelFees, bonds, cutoffs] = await Promise.all([
    Fee.find({ collegeCourseId: { $in: collegeCourseIds } }).sort({ year: -1 }).lean(),
    HostelFee.find({ collegeId }).sort({ year: -1 }).lean(),
    BondDetail.find({ collegeCourseId: { $in: collegeCourseIds } }).lean(),
    CutOff.aggregate([{ $match: { collegeCourseId: { $in: collegeCourseIds } } }, ...cutoffOrder()]),
  ]);
  for (const cutoff of cutoffs) cutoff.courseName = collegeCourses.find((link) => String(link._id) === String(cutoff.collegeCourseId))?.courseId?.name || '';

  // Entitlement gating: free users see only the most recent year's cutoffs, capped in count.
  let cutoffPayload;
  if (isPremium) {
    cutoffPayload = { locked: false, rows: cutoffs, lockedCount: 0 };
  } else {
    const freeRows = cutoffs.slice(0, env.FREE_CUTOFF_ROWS);
    cutoffPayload = {
      locked: cutoffs.length > freeRows.length,
      rows: freeRows,
      lockedCount: Math.max(cutoffs.length - freeRows.length, 0),
    };
  }

  return {
    college: await attachSummary(college),
    courses: collegeCourses,
    fees,
    hostelFees,
    bonds,
    cutoffs: cutoffPayload,
  };
}

async function saveCollege(userId, collegeId, { tag, notes }) {
  const college = await College.findById(collegeId);
  if (!college) throw ApiError.notFound('College not found');

  return SavedCollege.findOneAndUpdate(
    { userId, collegeId },
    { $set: { tag, notes } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function unsaveCollege(userId, collegeId) {
  await SavedCollege.deleteOne({ userId, collegeId });
}

async function compareColleges(collegeIds, isPremium = false) {
  const colleges = await College.find({ _id: { $in: collegeIds }, isActive: true }).lean();
  if (colleges.length !== collegeIds.length) throw ApiError.badRequest('One or more college ids are invalid');

  const details = await Promise.all(colleges.map((c) => getCollegeDetail(c._id, isPremium)));
  // Note: compare always shows aligned rows; premium gating for the underlying cutoff data
  // still applies at the caller level if you want compare itself gated — kept open here
  // since comparison is a decision tool, not the raw cutoff database.
  return details;
}

module.exports = { listColleges, getCollegeDetail, saveCollege, unsaveCollege, compareColleges, attachSummary };
