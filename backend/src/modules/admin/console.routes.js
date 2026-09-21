const express = require('express');
const { z } = require('zod');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { requirePermission } = require('../../middlewares/rbac');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { recordAudit } = require('./audit.helper');
const schemas = require('./admin.validation');
const env = require('../../config/env');
const College = require('../../models/College');
const Course = require('../../models/Course');
const CollegeCourse = require('../../models/CollegeCourse');
const CutOff = require('../../models/CutOff');
const Fee = require('../../models/Fee');
const HostelFee = require('../../models/HostelFee');
const SeatMatrix = require('../../models/SeatMatrix');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Subscription = require('../../models/Subscription');
const Setting = require('../../models/Setting');
const Service = require('../../models/Service');
const Plan = require('../../models/Plan');
const AvailabilitySlot = require('../../models/AvailabilitySlot');
const Counsellor = require('../../models/Counsellor');

const router = express.Router();
const id = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid record ID');
const { courseSchema } = require('../courses/courseSchema');
const resources = {
  'hostel-fees': { model: require('../../models/HostelFee'), permission: 'fees:import', schema: require('./importDefinitions').definitions['hostel-fees'].schema.omit({ collegeCode: true, collegeName: true, city: true }), populate: ['collegeId'], collegeLinked: true },
  bonds: { model: require('../../models/BondDetail'), permission: 'fees:import', schema: require('./importDefinitions').definitions.bonds.schema.omit({ collegeCode: true, collegeName: true, city: true, courseSlug: true }), linked: true },
  services: { model: Service, permission: 'counsellors:manage', create: true, schema: z.object({ name: z.string().trim().min(1), durationMins: z.number().int().min(5).max(240), price: z.number().positive(), description: z.string().optional(), isActive: z.boolean().optional() }), search: ['name'] },
  plans: { model: Plan, permission: 'coupons:write', create: true, schema: z.object({ name: z.string().trim().min(1), slug: z.string().regex(/^[a-z0-9-]+$/), price: z.number().positive(), durationDays: z.number().int().positive(), features: z.array(z.string()).optional(), isActive: z.boolean().optional() }), search: ['name'] },
  slots: { model: AvailabilitySlot, permission: 'counsellors:manage', schema: z.object({ datetime: z.coerce.date().refine((d) => d > new Date(), 'Choose a future time') }), populate: [{ path: 'counsellorId', populate: { path: 'userId', select: 'name email' } }] },
  colleges: { model: College, permission: 'colleges:write', schema: schemas.createCollege.body, search: ['name', 'city', 'state'] },
  courses: { model: Course, permission: 'collegecourses:import', schema: courseSchema, search: ['name', 'slug'] },
  'college-courses': { model: CollegeCourse, permission: 'collegecourses:import', schema: z.object({ totalSeats: schemas.createCollegeCourseLink.body.shape.totalSeats }), populate: ['collegeId', 'courseId'] },
  cutoffs: { model: CutOff, permission: 'cutoffs:import', schema: schemas.createCutoffEntry.body.omit({ collegeName: true, city: true, courseSlug: true }), linked: true },
  fees: { model: Fee, permission: 'fees:import', schema: schemas.createFeeEntry.body.omit({ collegeName: true, city: true, courseSlug: true }), linked: true },
  'seat-matrix': { model: SeatMatrix, permission: 'seatmatrix:import', schema: schemas.createSeatMatrixEntry.body.omit({ collegeName: true, city: true, courseSlug: true }), linked: true },
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw ApiError.badRequest(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  return result.data;
}

router.get('/session', (req, res) => res.json({ success: true, data: { role: req.adminRole.name, permissions: req.adminRole.permissions } }));
router.get('/setup', requirePermission('analytics:read'), (req, res) => {
  res.json({ success: true, data: {
    environment: env.NODE_ENV,
    cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
    email: env.EMAIL_OTP_PROVIDER === 'smtp' && Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM),
    sms: env.OTP_PROVIDER === 'msg91' && Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID),
    payments: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET),
  } });
});

router.get('/analytics/dashboard', requirePermission('analytics:read'), catchAsync(async (req, res) => {
  const days = parse(z.coerce.number().refine((n) => [7, 30, 90].includes(n), 'Choose 7, 30 or 90 days'), req.query.days || 30);
  // Start of the first day in India; all chart buckets use the same timezone.
  const now = new Date();
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const end = new Date(`${today}T00:00:00+05:30`);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const daily = (model, match, dateField, extra = {}) => model.aggregate([
    { $match: { ...match, [dateField]: { $gte: start, $lte: now } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}`, timezone: 'Asia/Kolkata' } }, count: { $sum: 1 }, ...extra } },
    { $sort: { _id: 1 } },
  ]);
  const [revenue, users, bookings, colleges, activeColleges, missingImages, links, fees, cutoffs, seats, courses, activeSubscriptions, states, paymentStatus, quality] = await Promise.all([
    daily(Payment, { status: 'paid' }, 'updatedAt', { revenue: { $sum: '$amount' } }),
    daily(User, { role: 'student' }, 'createdAt'), daily(Booking, {}, 'createdAt'),
    College.countDocuments(), College.countDocuments({ isActive: true }), College.countDocuments({ isActive: true, 'images.0': { $exists: false } }),
    CollegeCourse.countDocuments(), Fee.countDocuments(), CutOff.countDocuments(), SeatMatrix.countDocuments(), Course.countDocuments(),
    Subscription.countDocuments({ status: 'active', expiryDate: { $gt: now } }),
    College.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$state', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Payment.aggregate([{ $match: { createdAt: { $gte: start, $lte: now } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    CollegeCourse.aggregate([
      { $lookup: { from: Fee.collection.name, localField: '_id', foreignField: 'collegeCourseId', as: 'fees' } },
      { $lookup: { from: CutOff.collection.name, localField: '_id', foreignField: 'collegeCourseId', as: 'cutoffs' } },
      { $group: { _id: null, missingFees: { $sum: { $cond: [{ $eq: [{ $size: '$fees' }, 0] }, 1, 0] } }, missingCutoffs: { $sum: { $cond: [{ $eq: [{ $size: '$cutoffs' }, 0] }, 1, 0] } } } },
    ]),
  ]);
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000 + 330 * 60000).toISOString().slice(0, 10);
    return { date, revenue: revenue.find((r) => r._id === date)?.revenue || 0,
      students: users.find((r) => r._id === date)?.count || 0, bookings: bookings.find((r) => r._id === date)?.count || 0 };
  });
  res.json({ success: true, data: { days, generatedAt: now, series, states, paymentStatus,
    totals: { revenue: series.reduce((s, d) => s + d.revenue, 0), students: series.reduce((s, d) => s + d.students, 0),
      bookings: series.reduce((s, d) => s + d.bookings, 0), activeSubscriptions },
    catalog: { colleges, activeColleges, missingImages, links, fees, cutoffs, seats, courses,
      missingFees: quality[0]?.missingFees || 0, missingCutoffs: quality[0]?.missingCutoffs || 0 } } });
}));

router.get('/deadline', requirePermission('analytics:read'), catchAsync(async (req, res) => {
  const setting = await Setting.findOne({ key: 'counselling_deadline' }).lean();
  res.json({ success: true, data: setting?.value || null });
}));
router.put('/deadline', requirePermission('colleges:write'), catchAsync(async (req, res) => {
  const data = parse(z.object({ title: z.string().trim().min(1).max(200), date: z.coerce.date(), sourceUrl: z.string().url().regex(/^https:\/\//), enabled: z.boolean() }).strict(), req.body);
  const before = await Setting.findOne({ key: 'counselling_deadline' }).lean();
  await Setting.findOneAndUpdate({ key: 'counselling_deadline' }, { $set: { value: data } }, { upsert: true });
  await recordAudit({ adminUserId: req.user.id, action: 'update', entity: 'Setting', before: before?.value, after: data });
  res.json({ success: true, data });
}));
router.patch('/bookings/:id', requirePermission('counsellors:manage'), catchAsync(async (req, res) => {
  const recordId = parse(id, req.params.id);
  const data = parse(z.object({ meetingLink: z.union([z.literal(''), z.string().url().regex(/^https:\/\//)]).optional(), status: z.enum(['confirmed', 'completed', 'no_show']).optional() }).strict(), req.body);
  const before = await Booking.findById(recordId).lean();
  if (!before) throw ApiError.notFound('Booking not found');
  if (!['confirmed', 'completed', 'no_show'].includes(before.status)) throw ApiError.badRequest('Only paid, confirmed bookings can be managed here');
  const after = await Booking.findOneAndUpdate({ _id: recordId, status: before.status }, { $set: data }, { new: true, runValidators: true });
  if (!after) throw ApiError.conflict('Booking changed. Refresh and retry.');
  await recordAudit({ adminUserId: req.user.id, action: 'update', entity: 'Booking', entityId: recordId, before, after });
  res.json({ success: true, data: after });
}));
router.post('/catalog/slots', requirePermission('counsellors:manage'), catchAsync(async (req, res) => {
  const data = parse(resources.slots.schema.extend({ counsellorId: id }).strict(), req.body);
  if (!await Counsellor.exists({ _id: data.counsellorId, isActive: true })) throw ApiError.badRequest('Choose an active counsellor');
  const slot = await AvailabilitySlot.create(data);
  await recordAudit({ adminUserId: req.user.id, action: 'create', entity: 'AvailabilitySlot', entityId: slot._id, after: data });
  res.status(201).json({ success: true, data: slot });
}));

for (const [name, resource] of Object.entries(resources)) {
  router.get(`/catalog/${name}`, requirePermission(resource.permission), catchAsync(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 200) : '';
    if (search && resource.search) filter.$or = resource.search.map((field) => ({ [field]: new RegExp(escapeRegex(search), 'i') }));
    if (name === 'colleges') {
      if (['true', 'false'].includes(req.query.active)) filter.isActive = req.query.active === 'true';
      if (req.query.missingImages === 'true') filter['images.0'] = { $exists: false };
    }
    if (resource.linked || resource.collegeLinked || name === 'college-courses') {
      if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        const found = await College.find({ $or: [{ name: pattern }, { collegeCode: pattern }] }).select('_id').lean();
        const collegeIds = found.map((c) => c._id);
        if (resource.linked) {
          const links = await CollegeCourse.find({ collegeId: { $in: collegeIds } }).select('_id').lean();
          filter.collegeCourseId = { $in: links.map((l) => l._id) };
        } else filter.collegeId = { $in: collegeIds };
      }
      if (req.query.year && name !== 'bonds' && (resource.linked || resource.collegeLinked)) filter.year = parse(z.coerce.number().int().min(2000).max(2100), req.query.year);
    }
    if (name === 'college-courses' && req.query.missingData) {
      const missing = parse(z.enum(['fees', 'cutoffs']), req.query.missingData);
      const model = missing === 'fees' ? Fee : CutOff;
      const [result] = await CollegeCourse.aggregate([
        { $match: filter },
        { $lookup: { from: model.collection.name, localField: '_id', foreignField: 'collegeCourseId', pipeline: [{ $limit: 1 }, { $project: { _id: 1 } }], as: 'coverage' } },
        { $match: { 'coverage.0': { $exists: false } } },
        { $unset: 'coverage' },
        { $facet: { data: [{ $sort: { updatedAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }], total: [{ $count: 'count' }] } },
      ]);
      const data = await CollegeCourse.populate(result.data, [{ path: 'collegeId' }, { path: 'courseId' }]);
      return res.json({ success: true, ...paginatedResponse({ data, total: result.total[0]?.count || 0, page, limit }) });
    }
    let query = resource.model.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit);
    if (resource.linked) query = query.populate({ path: 'collegeCourseId', populate: [{ path: 'collegeId' }, { path: 'courseId' }] });
    for (const path of resource.populate || []) query = query.populate(path);
    const [data, total] = await Promise.all([query.lean(), resource.model.countDocuments(filter)]);
    if (name === 'fees') {
      const filters = data.filter((fee) => fee.collegeCourseId?.collegeId?._id).map((fee) => ({ collegeId: fee.collegeCourseId.collegeId._id, year: fee.year }));
      const hostels = filters.length ? await HostelFee.find({ $or: filters }).lean() : [];
      const amounts = new Map(hostels.map((h) => [`${h.collegeId}:${h.year}`, h.amount]));
      for (const fee of data) fee.hostelMess = amounts.get(`${fee.collegeCourseId?.collegeId?._id}:${fee.year}`) ?? null;
    }
    res.json({ success: true, ...paginatedResponse({ data, total, page, limit }) });
  }));
  router.patch(`/catalog/${name}/:id`, requirePermission(resource.permission), catchAsync(async (req, res) => {
    const recordId = parse(id, req.params.id);
    const data = parse(resource.schema.partial().strict(), req.body);
    if (!Object.keys(data).length) throw ApiError.badRequest('No changes supplied');
    const before = await resource.model.findById(recordId).lean();
    if (!before) throw ApiError.notFound('Record not found');
    if (name === 'slots' && before.status !== 'open') throw ApiError.badRequest('Held or booked slots cannot be edited');
    const after = await resource.model.findOneAndUpdate({ _id: recordId, ...(name === 'slots' ? { status: 'open' } : {}) }, { $set: data }, { new: true, runValidators: true });
    if (!after) throw ApiError.conflict('Record changed. Refresh and retry.');
    await recordAudit({ adminUserId: req.user.id, action: 'update', entity: resource.model.modelName, entityId: recordId, before, after });
    res.json({ success: true, data: after });
  }));
  if (resource.create) router.post(`/catalog/${name}`, requirePermission(resource.permission), catchAsync(async (req, res) => {
    const data = parse(resource.schema.strict(), req.body);
    const record = await resource.model.create(data);
    await recordAudit({ adminUserId: req.user.id, action: 'create', entity: resource.model.modelName, entityId: record._id, after: data });
    res.status(201).json({ success: true, data: record });
  }));
}
router.post('/catalog/courses', requirePermission('collegecourses:import'), catchAsync(async (req, res) => {
  const data = parse(courseSchema.strict(), req.body);
  const course = await Course.create(data);
  await recordAudit({ adminUserId: req.user.id, action: 'create', entity: 'Course', entityId: course._id, after: data });
  res.status(201).json({ success: true, data: course });
}));

module.exports = router;
