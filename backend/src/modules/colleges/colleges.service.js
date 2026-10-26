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

  const withSummary = await attachSummaries(data, { courseId: linkQuery.courseId, matchedLinks, minFee: filters.minFee, maxFee: filters.maxFee });

  return paginatedResponse({ data: withSummary, total, page, limit });
}

function selectLinks(links, { courseId, matchedLinks } = {}) {
  const matched = matchedLinks && new Set(matchedLinks.map(String));
  return links.filter((link) => (!courseId || String(link.courseId?._id) === String(courseId)) && (!matched || matched.has(String(link._id))));
}

function summarizeCollege(college, { links, latestFees, hostelFee, bond, bestCutoff, cutoffUpdatedAt }, { courseId, matchedLinks, minFee, maxFee } = {}) {
  const selectedLinks = selectLinks(links, { courseId, matchedLinks });
  // A partial sum would look like a complete intake. Unknown links keep the total unknown.
  const totalSeats = selectedLinks.length && selectedLinks.every((link) => link.totalSeats != null)
    ? selectedLinks.reduce((sum, link) => sum + link.totalSeats, 0) : null;
  const courseCodes = links.map((l) => l.courseId?.name).filter(Boolean);

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
    cutoffUpdatedAt: cutoffUpdatedAt || null,
    closingRankYear: bestCutoff?.year || null,
    closingRankRound: bestCutoff?.round || null,
    closingRankCategory: bestCutoff?.category || null,
    closingRankCourse: selectedLinks.find((link) => String(link._id) === String(bestCutoff?.collegeCourseId))?.courseId?.name || null,
    closingRank: bestCutoff?.closingRank ?? null,
    quota: bestCutoff?.quota ?? null,
  };
}

// Fetch summaries for the entire page in a fixed number of queries, rather than
// opening seven queries per college and queuing them behind the connection pool.
async function attachSummaries(colleges, options = {}) {
  if (!colleges.length) return [];
  const collegeIds = colleges.map((college) => college._id);
  const links = await CollegeCourse.find({ collegeId: { $in: collegeIds } }).populate('courseId', 'name').lean();
  const selectedLinks = selectLinks(links, options);
  const collegeCourseIds = selectedLinks.map((link) => link._id);
  const [latestFees, hostelFees, bonds, previews] = await Promise.all([
    Fee.aggregate([
      { $match: { collegeCourseId: { $in: collegeCourseIds } } },
      { $sort: { year: -1, _id: -1 } },
      { $group: { _id: { link: '$collegeCourseId', tier: '$tier' }, tuition: { $first: '$tuition' } } },
    ]),
    HostelFee.find({ collegeId: { $in: collegeIds } }).sort({ year: -1 }).lean(),
    BondDetail.find({ collegeCourseId: { $in: collegeCourseIds } }).lean(),
    CutOff.aggregate([
      { $match: { collegeCourseId: { $in: collegeCourseIds } } },
      ...cutoffOrder(),
      { $group: { _id: '$collegeCourseId', row: { $first: '$$ROOT' }, updatedAt: { $max: '$updatedAt' } } },
      // Reapply the same ordering across course previews before selecting a college's first row.
      { $replaceRoot: { newRoot: { $mergeObjects: ['$row', { cutoffUpdatedAt: '$updatedAt' }] } } },
      ...cutoffOrder(),
    ]),
  ]);
  const groupBy = (rows, key) => {
    const grouped = new Map();
    for (const row of rows) {
      const id = String(key(row));
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(row);
    }
    return grouped;
  };
  const collegeByLink = new Map(links.map((link) => [String(link._id), link.collegeId]));
  const linksByCollege = groupBy(links, (row) => row.collegeId);
  const feesByCollege = groupBy(latestFees, (row) => collegeByLink.get(String(row._id.link)));
  const hostelsByCollege = groupBy(hostelFees, (row) => row.collegeId);
  const bondsByCollege = groupBy(bonds, (row) => collegeByLink.get(String(row.collegeCourseId)));
  const previewsByCollege = groupBy(previews, (row) => collegeByLink.get(String(row.collegeCourseId)));

  return colleges.map((college) => {
    const id = String(college._id);
    const cutoffs = previewsByCollege.get(id) || [];
    return summarizeCollege(college, {
      links: linksByCollege.get(id) || [],
      latestFees: feesByCollege.get(id) || [],
      hostelFee: hostelsByCollege.get(id)?.[0],
      bond: bondsByCollege.get(id)?.[0],
      bestCutoff: cutoffs[0],
      cutoffUpdatedAt: cutoffs.reduce((latest, row) => row.cutoffUpdatedAt > latest ? row.cutoffUpdatedAt : latest, null),
    }, options);
  });
}

async function attachSummary(college, options) {
  return (await attachSummaries([college], options))[0];
}

async function getCollegeDetail(collegeId, isPremium) {
  const college = await College.findById(collegeId).lean();
  if (!college || !college.isActive) throw ApiError.notFound('College not found');

  const collegeCourses = await CollegeCourse.find({ collegeId }).populate('courseId').lean();
  const collegeCourseIds = collegeCourses.map((cc) => cc._id);

  const [fees, hostelFees, bonds, cutoffs, seatMatrix] = await Promise.all([
    Fee.find({ collegeCourseId: { $in: collegeCourseIds } }).sort({ year: -1, _id: -1 }).lean(),
    HostelFee.find({ collegeId }).sort({ year: -1 }).lean(),
    BondDetail.find({ collegeCourseId: { $in: collegeCourseIds } }).lean(),
    CutOff.aggregate([{ $match: { collegeCourseId: { $in: collegeCourseIds } } }, ...cutoffOrder()]),
    SeatMatrix.find({ collegeCourseId: { $in: collegeCourseIds } }).sort({ year: -1, authority: 1, round: 1, category: 1, quota: 1, _id: 1 }).lean(),
  ]);
  const courseNames = new Map(collegeCourses.map((link) => [String(link._id), link.courseId?.name || '']));
  for (const row of [...cutoffs, ...seatMatrix]) row.courseName = courseNames.get(String(row.collegeCourseId)) || '';
  const latestFees = new Map();
  for (const fee of fees) {
    const key = `${fee.collegeCourseId}:${fee.tier}`;
    if (!latestFees.has(key)) latestFees.set(key, { _id: { link: fee.collegeCourseId, tier: fee.tier }, tuition: fee.tuition });
  }

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
    college: summarizeCollege(college, {
      links: collegeCourses,
      latestFees: [...latestFees.values()],
      hostelFee: hostelFees[0],
      bond: bonds[0],
      bestCutoff: cutoffs[0],
      cutoffUpdatedAt: cutoffs.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, null),
    }),
    courses: collegeCourses,
    fees,
    hostelFees,
    bonds,
    seatMatrix,
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
