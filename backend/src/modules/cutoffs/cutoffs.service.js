const CutOff = require('../../models/CutOff');
const CollegeCourse = require('../../models/CollegeCourse');
const College = require('../../models/College');
const Course = require('../../models/Course');
const { parsePagination } = require('../../utils/pagination');
const env = require('../../config/env');
const { escapeRegex, stateMatch } = require('../../utils/catalogFilters');
const { stages } = require('../../utils/cutoffOrder');
async function orderedRows(match, skip, limit) {
  const rows = await CutOff.aggregate([{ $match: match }, ...stages(), { $skip: skip }, { $limit: limit }]);
  return CutOff.populate(rows, { path: 'collegeCourseId', populate: [{ path: 'collegeId' }, { path: 'courseId' }] });
}

/**
 * listCutoffs — the paywall module. Regardless of filters, a guest/free user gets
 * env.FREE_CUTOFF_ROWS fully-readable rows; every row beyond that is returned with the
 * college name and closing rank/score masked (mirrors the frontend's "blurred but visible
 * shape" pattern) plus an accurate lockedCount so the UI can render "N more locked".
 *
 * Premium users (req.isPremium === true) get every row, fully readable, paginated normally.
 */
async function listCutoffs(filters, isPremium) {
  const { page, limit, skip } = parsePagination(filters, { defaultLimit: 20, maxLimit: 50 });

  const match = {};
  if (filters.category) match.category = filters.category;
  if (filters.quota) match.quota = filters.quota;
  if (filters.year) match.year = filters.year;

  const collegeQuery = { isActive: true };
  if (filters.state) collegeQuery.state = stateMatch(filters.state);
  if (filters.search) collegeQuery.$or = ['name', 'city', 'state'].map((field) => ({ [field]: new RegExp(escapeRegex(filters.search.trim()), 'i') }));
  const activeColleges = await College.find(collegeQuery).select('_id').lean();
  const activeCollegeIds = activeColleges.map((college) => college._id);
  const activeLinks = await CollegeCourse.find({ collegeId: { $in: activeCollegeIds } }).select('_id').lean();
  let collegeCourseFilter = { collegeCourseId: { $in: activeLinks.map((link) => link._id) } };
  if (filters.course) {
    const course = await Course.findOne({ slug: filters.course }).lean();
    if (!course) return { data: [], totalCount: 0, freeCount: 0, lockedCount: 0, page, limit };
    const links = await CollegeCourse.find({ courseId: course._id, collegeId: { $in: activeCollegeIds } }).select('_id').lean();
    collegeCourseFilter = { collegeCourseId: { $in: links.map((l) => l._id) } };
  }

  Object.assign(match, collegeCourseFilter);

  const totalCount = await CutOff.countDocuments(match);

  // Premium users get every row, fully readable, paginated normally.
  if (isPremium) {
    const rows = await orderedRows(match, skip, limit);

    const withTrend = await attachTrend(rows);

    return {
      data: withTrend,
      totalCount,
      freeCount: rows.length,
      lockedCount: 0,
      page,
      limit,
    };
  }

  // Free tier: always return page 1 semantics — first FREE_CUTOFF_ROWS fully readable,
  // ignore pagination beyond that (frontend shows a locked overlay, not further pages).
  const freeRows = await orderedRows(match, 0, env.FREE_CUTOFF_ROWS);

  const freeRowsWithTrend = await attachTrend(freeRows);

  const lockedCount = Math.max(totalCount - freeRows.length, 0);

  // A small sample of masked rows so the UI can render the "blurred" preview shape.
  const maskedSample = await orderedRows(match, freeRows.length, 3);

  return {
    data: freeRowsWithTrend,
    maskedPreview: maskedSample.map(maskRow),
    totalCount,
    freeCount: freeRows.length,
    lockedCount,
    page: 1,
    limit: env.FREE_CUTOFF_ROWS,
  };
}

/**
 * attachTrend — for each row, looks up the same college/course/category/quota/authority's
 * closing rank from the previous year and computes a year-on-year direction + magnitude.
 * A dropping closing rank means the cutoff got tighter (more competitive); a rising one
 * means it eased. Rows with no prior-year record get trend: null (nothing to compare).
 */
async function attachTrend(rows) {
  const priorLookups = await Promise.all(
    rows.map((r) =>
      CutOff.findOne({
        collegeCourseId: r.collegeCourseId?._id || r.collegeCourseId,
        category: r.category,
        quota: r.quota,
        authority: r.authority,
        year: r.year - 1,
        round: r.round,
      })
        .select('closingRank')
        .lean()
    )
  );

  return rows.map((row, i) => {
    const prior = priorLookups[i];
    const formatted = formatRow(row);
    if (!prior) return { ...formatted, trend: null, delta: null };

    const delta = Math.abs(row.closingRank - prior.closingRank);
    const trend = row.closingRank < prior.closingRank ? 'tighter' : 'easier';
    return { ...formatted, trend, delta };
  });
}

function formatRow(row) {
  const college = row.collegeCourseId?.collegeId;
  const course = row.collegeCourseId?.courseId;
  return {
    id: row._id,
    collegeName: college?.name,
    collegeCity: college?.city,
    courseName: course?.name,
    category: row.category,
    quota: row.quota,
    authority: row.authority,
    year: row.year,
    round: row.round,
    closingRank: row.closingRank,
    closingScore: row.closingScore,
    seats: row.seats,
  };
}

function maskRow(row) {
  const formatted = formatRow(row);
  return {
    ...formatted,
    collegeName: '••••••••••',
    collegeCity: undefined,
    closingRank: null,
    closingScore: null,
    seats: null,
    locked: true,
  };
}

module.exports = { listCutoffs };
