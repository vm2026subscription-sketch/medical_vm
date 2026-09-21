const College = require('../../models/College');
const Course = require('../../models/Course');
const CollegeCourse = require('../../models/CollegeCourse');
const CutOff = require('../../models/CutOff');
const Fee = require('../../models/Fee');
const SeatMatrix = require('../../models/SeatMatrix');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const Coupon = require('../../models/Coupon');
const Counsellor = require('../../models/Counsellor');
const Booking = require('../../models/Booking');
const Subscription = require('../../models/Subscription');
const AuditLog = require('../../models/AuditLog');
const Role = require('../../models/Role');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { recordAudit } = require('./audit.helper');
const { uploadImageBuffer } = require('./media.service');
const { resolveCollegeCourseId } = require('./bulkImport.service');

// ---- Colleges ----
async function createCollege(adminUserId, data) {
  const college = await College.create(data);
  await recordAudit({ adminUserId, action: 'create', entity: 'College', entityId: college._id, after: data });
  return college;
}async function updateCollege(adminUserId, id, data) {
  const before = await College.findById(id).lean();
  if (!before) throw ApiError.notFound('College not found');
  const after = await College.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  await recordAudit({ adminUserId, action: 'update', entity: 'College', entityId: id, before, after });
  return after;
}

async function deleteCollege(adminUserId, id) {
  const before = await College.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!before) throw ApiError.notFound('College not found');
  await recordAudit({ adminUserId, action: 'delete', entity: 'College', entityId: id, before });
  return before;
}

/**
 * addCollegeImage — uploads the given buffer to Cloudinary and pushes the resulting URL
 * onto College.images. Kept separate from updateCollege since it's a file-upload flow
 * (multipart/form-data) rather than a JSON PUT.
 */
async function addCollegeImage(adminUserId, collegeId, buffer) {
  const college = await College.findById(collegeId);
  if (!college) throw ApiError.notFound('College not found');
  if (college.images.length >= 20) throw ApiError.badRequest('A college can have at most 20 images');

  const result = await uploadImageBuffer(buffer, `medpath/colleges/${collegeId}`);

  const updated = await College.findOneAndUpdate(
    { _id: collegeId, 'images.19': { $exists: false } },
    { $push: { images: result.secure_url } }, { new: true, runValidators: true }
  );
  if (!updated) throw ApiError.badRequest('A college can have at most 20 images');

  await recordAudit({
    adminUserId,
    action: 'update',
    entity: 'College',
    entityId: collegeId,
    after: { addedImage: result.secure_url },
  });

  return { url: result.secure_url, images: updated.images };
}

// ---- Users ----
async function listUsers(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.role) filter.role = query.role;
  if (typeof query.search === 'string') {
    const pattern = new RegExp(query.search.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }];
  }

  const [data, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return paginatedResponse({ data, total, page, limit });
}

async function patchUser(adminUserId, id, data) {
  if (String(adminUserId) === String(id)) throw ApiError.badRequest('You cannot disable your own account');
  const before = await User.findById(id).lean();
  if (!before) throw ApiError.notFound('User not found');
  if (before.role === 'admin') throw ApiError.forbidden('Admin accounts must be managed through role administration');
  const after = await User.findOneAndUpdate({ _id: id, role: 'student' }, { $set: data }, { new: true });
  if (!after) throw ApiError.conflict('User access changed. Refresh before editing this account.');
  await recordAudit({ adminUserId, action: 'update', entity: 'User', entityId: id, before, after });
  return after;
}

// ---- Payments ----
async function listPayments(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.purpose) filter.purpose = query.purpose;

  const [data, total] = await Promise.all([
    Payment.find(filter).populate('userId', 'name phone email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  return paginatedResponse({ data, total, page, limit });
}

// ---- Coupons ----
async function createCoupon(adminUserId, data) {
  validateCoupon(data);
  const coupon = await Coupon.create(data);
  await recordAudit({ adminUserId, action: 'create', entity: 'Coupon', entityId: coupon._id, after: data });
  return coupon;
}

async function updateCoupon(adminUserId, id, data) {
  const before = await Coupon.findById(id).lean();
  if (!before) throw ApiError.notFound('Coupon not found');
  validateCoupon({ ...before, ...data });
  const after = await Coupon.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  await recordAudit({ adminUserId, action: 'update', entity: 'Coupon', entityId: id, before, after });
  return after;
}

async function listCoupons() {
  return Coupon.find().sort({ createdAt: -1 }).lean();
}

function validateCoupon(data) {
  if (new Date(data.validTo) <= new Date(data.validFrom)) throw ApiError.badRequest('Coupon expiry must be after its start date');
  if (data.type === 'percent' && data.value > 100) throw ApiError.badRequest('Percentage discount cannot exceed 100');
}

// ---- Counsellors ----
async function createCounsellor(adminUserId, data) {
  if (!await User.exists({ _id: data.userId, isActive: true })) throw ApiError.badRequest('Choose an existing active user for this counsellor');
  const counsellor = await Counsellor.create(data);
  await recordAudit({ adminUserId, action: 'create', entity: 'Counsellor', entityId: counsellor._id, after: data });
  return counsellor;
}

async function updateCounsellor(adminUserId, id, data) {
  const before = await Counsellor.findById(id).lean();
  if (!before) throw ApiError.notFound('Counsellor not found');
  const after = await Counsellor.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  await recordAudit({ adminUserId, action: 'update', entity: 'Counsellor', entityId: id, before, after });
  return after;
}

async function listCounsellorsAdmin() {
  return Counsellor.find().populate('userId', 'name phone email').sort({ createdAt: -1 }).lean();
}

async function listBookingsAdmin(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;

  const [data, total] = await Promise.all([
    Booking.find(filter)
      .populate('userId', 'name phone')
      .populate({ path: 'counsellorId', populate: { path: 'userId', select: 'name email' } })
      .populate('slotId')
      .populate('serviceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  return paginatedResponse({ data, total, page, limit });
}

// ---- Analytics ----
async function analyticsOverview() {
  const [revenueAgg, totalUsers, activeSubs, totalBookings, premiumConversions] = await Promise.all([
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    User.countDocuments({ role: 'student' }),
    Subscription.countDocuments({ status: 'active', expiryDate: { $gt: new Date() } }),
    Booking.countDocuments({ status: 'confirmed' }),
    Subscription.countDocuments({ source: 'purchase' }),
  ]);

  return {
    totalRevenue: revenueAgg[0]?.total || 0,
    totalUsers,
    activeSubscriptions: activeSubs,
    confirmedBookings: totalBookings,
    premiumConversions,
  };
}

// ---- Audit log ----
async function listAuditLog(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.entity) filter.entity = query.entity;

  const [data, total] = await Promise.all([
    AuditLog.find(filter).populate('adminUserId', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return paginatedResponse({ data, total, page, limit });
}

// ---- Roles / RBAC ----
async function createRole(data) {
  return Role.create(data);
}

async function listRoles() {
  return Role.find().lean();
}

async function assignRole(actorId, userId, roleName) {
  return require('./adminAccess.service').changeAccess(actorId, { _id: userId }, roleName);
}

// ---- Single-entry data creation (College-Course link, Cutoff, Fee, Seat Matrix) ----
// These mirror the bulk-import row processors but for one record at a time, entered via
// an admin form rather than a CSV. All resolve the college+course by human-readable name
// via the same resolveCollegeCourseId() helper bulk-import uses, so behavior stays consistent.

async function createCollegeCourseLink(adminUserId, { collegeName, city, courseSlug, totalSeats }) {
  const college = await College.findOne({ name: collegeName, city });
  if (!college) throw ApiError.notFound(`College not found: "${collegeName}" in "${city}"`);

  const course = await Course.findOne({ slug: courseSlug });
  if (!course) throw ApiError.notFound(`Course not found: "${courseSlug}"`);

  const link = await CollegeCourse.findOneAndUpdate(
    { collegeId: college._id, courseId: course._id },
    { $set: { totalSeats } },
    { upsert: true, new: true, runValidators: true }
  );

  await recordAudit({ adminUserId, action: 'create', entity: 'CollegeCourse', entityId: link._id, after: { collegeName, courseSlug, totalSeats } });
  return link;
}

async function createCutoffEntry(adminUserId, data) {
  const collegeCourseId = await resolveCollegeCourseId(data.collegeName, data.city, data.courseSlug);

  const cutoff = await CutOff.findOneAndUpdate(
    {
      collegeCourseId,
      category: data.category,
      quota: data.quota,
      authority: data.authority,
      year: data.year,
      round: data.round,
    },
    { $set: { closingRank: data.closingRank, closingScore: data.closingScore, seats: data.seats } },
    { upsert: true, new: true, runValidators: true }
  );

  await recordAudit({ adminUserId, action: 'create', entity: 'CutOff', entityId: cutoff._id, after: data });
  return cutoff;
}

async function createFeeEntry(adminUserId, data) {
  const collegeCourseId = await resolveCollegeCourseId(data.collegeName, data.city, data.courseSlug);

  const fee = await Fee.findOneAndUpdate(
    { collegeCourseId, year: data.year, tier: data.tier },
    { $set: { tuition: data.tuition, otherCharges: data.otherCharges ?? 0, sourceTag: data.sourceTag } },
    { upsert: true, new: true, runValidators: true }
  );

  await recordAudit({ adminUserId, action: 'create', entity: 'Fee', entityId: fee._id, after: data });
  return fee;
}

async function createSeatMatrixEntry(adminUserId, data) {
  const collegeCourseId = await resolveCollegeCourseId(data.collegeName, data.city, data.courseSlug);

  const entry = await SeatMatrix.findOneAndUpdate({
    collegeCourseId,
    authority: data.authority,
    category: data.category,
    quota: data.quota,
    round: data.round,
    year: data.year,
  }, { $set: { seats: data.seats } }, { upsert: true, new: true, runValidators: true });

  await recordAudit({ adminUserId, action: 'create', entity: 'SeatMatrix', entityId: entry._id, after: data });
  return entry;
}

module.exports = {
  createCollege,
  updateCollege,
  deleteCollege,
  addCollegeImage,
  createCollegeCourseLink,
  createCutoffEntry,
  createFeeEntry,
  createSeatMatrixEntry,
  listUsers,
  patchUser,
  listPayments,
  createCoupon,
  updateCoupon,
  listCoupons,
  createCounsellor,
  updateCounsellor,
  listCounsellorsAdmin,
  listBookingsAdmin,
  analyticsOverview,
  listAuditLog,
  createRole,
  listRoles,
  assignRole,
};
