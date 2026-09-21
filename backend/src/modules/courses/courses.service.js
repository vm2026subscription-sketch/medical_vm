const Course = require('../../models/Course');
const CollegeCourse = require('../../models/CollegeCourse');
const Fee = require('../../models/Fee');
const ApiError = require('../../utils/ApiError');

async function listCourses() {
  return Course.find().sort({ name: 1 }).lean();
}

async function getCourseBySlug(slug) {
  const course = await Course.findOne({ slug }).lean();
  if (!course) throw ApiError.notFound('Course not found');

  const links = (await CollegeCourse.find({ courseId: course._id }).populate({ path: 'collegeId', match: { isActive: true } }).lean()).filter((link) => link.collegeId);
  const collegeCourseIds = links.map((l) => l._id);

  const fees = await Fee.find({ collegeCourseId: { $in: collegeCourseIds } })
    .sort({ year: -1 })
    .lean();

  // Aggregate a simple fee range by ownership tier for the "fee range by ownership" UI block.
  const ownership = new Map(links.map((link) => [String(link._id), link.collegeId.ownership]));
  const latest = new Map();
  for (const fee of fees) {
    const key = `${fee.collegeCourseId}:${fee.tier}`;
    if (!latest.has(key)) latest.set(key, fee);
  }
  const latestFees = [...latest.values()].filter((fee) => typeof fee.tuition === 'number' && Number.isFinite(fee.tuition));
  const govtFees = latestFees.filter((f) => ownership.get(String(f.collegeCourseId)) === 'govt').map((f) => f.tuition);
  const privateFees = latestFees.filter((f) => ownership.get(String(f.collegeCourseId)) !== 'govt').map((f) => f.tuition);

  const feeRange = (arr) => (arr.length ? { min: Math.min(...arr), max: Math.max(...arr) } : null);

  return {
    course,
    totalColleges: links.length,
    feeRangeByOwnership: {
      government: feeRange(govtFees),
      privateOrDeemed: feeRange(privateFees),
    },
  };
}

module.exports = { listCourses, getCourseBySlug };
