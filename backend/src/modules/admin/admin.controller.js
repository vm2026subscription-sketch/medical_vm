const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const service = require('./admin.service');
const bulkImportService = require('./bulkImport.service');

// ---- Colleges ----
const createCollege = catchAsync(async (req, res) => {
  const data = await service.createCollege(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const updateCollege = catchAsync(async (req, res) => {
  const data = await service.updateCollege(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data });
});

const deleteCollege = catchAsync(async (req, res) => {
  await service.deleteCollege(req.user.id, req.params.id);
  res.status(204).send();
});

const addCollegeImage = catchAsync(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Image file is required (field name: "file")');
  const data = await service.addCollegeImage(req.user.id, req.params.id, req.file.buffer);
  res.status(200).json({ success: true, data });
});

// ---- Bulk import ----
function requireFile(req) {
  if (!req.file) throw ApiError.badRequest('CSV file is required (field name: "file")');
  return req.file.buffer;
}

const importColleges = catchAsync(async (req, res) => {
  const data = await bulkImportService.bulkImportColleges(requireFile(req), req.user.id, req.query.dryRun === 'true');
  res.status(200).json({ success: true, data });
});

const importCutoffs = catchAsync(async (req, res) => {
  const data = await bulkImportService.bulkImportCutoffs(requireFile(req), req.user.id, req.query.dryRun === 'true');
  res.status(200).json({ success: true, data });
});

const importFees = catchAsync(async (req, res) => {
  const data = await bulkImportService.bulkImportFees(requireFile(req), req.user.id, req.query.dryRun === 'true');
  res.status(200).json({ success: true, data });
});

const importSeatMatrix = catchAsync(async (req, res) => {
  const data = await bulkImportService.bulkImportSeatMatrix(requireFile(req), req.user.id, req.query.dryRun === 'true');
  res.status(200).json({ success: true, data });
});

const importCollegeCourses = catchAsync(async (req, res) => {
  const data = await bulkImportService.bulkImportCollegeCourses(requireFile(req), req.user.id, req.query.dryRun === 'true');
  res.status(200).json({ success: true, data });
});

// ---- Single-entry data creation ----
const createCollegeCourseLink = catchAsync(async (req, res) => {
  const data = await service.createCollegeCourseLink(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const createCutoffEntry = catchAsync(async (req, res) => {
  const data = await service.createCutoffEntry(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const createFeeEntry = catchAsync(async (req, res) => {
  const data = await service.createFeeEntry(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const createSeatMatrixEntry = catchAsync(async (req, res) => {
  const data = await service.createSeatMatrixEntry(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

// ---- Users ----
const listUsers = catchAsync(async (req, res) => {
  const result = await service.listUsers(req.query);
  res.status(200).json({ success: true, ...result });
});

const patchUser = catchAsync(async (req, res) => {
  const data = await service.patchUser(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data });
});

// ---- Payments / Coupons ----
const listPayments = catchAsync(async (req, res) => {
  const result = await service.listPayments(req.query);
  res.status(200).json({ success: true, ...result });
});

const createCoupon = catchAsync(async (req, res) => {
  const data = await service.createCoupon(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const updateCoupon = catchAsync(async (req, res) => {
  const data = await service.updateCoupon(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data });
});

const listCoupons = catchAsync(async (req, res) => {
  const data = await service.listCoupons();
  res.status(200).json({ success: true, data });
});

// ---- Counsellors / Bookings ----
const createCounsellor = catchAsync(async (req, res) => {
  const data = await service.createCounsellor(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const updateCounsellor = catchAsync(async (req, res) => {
  const data = await service.updateCounsellor(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data });
});

const listCounsellorsAdmin = catchAsync(async (req, res) => {
  const data = await service.listCounsellorsAdmin();
  res.status(200).json({ success: true, data });
});

const listBookingsAdmin = catchAsync(async (req, res) => {
  const result = await service.listBookingsAdmin(req.query);
  res.status(200).json({ success: true, ...result });
});

// ---- Analytics / Audit ----
const analyticsOverview = catchAsync(async (req, res) => {
  const data = await service.analyticsOverview();
  res.status(200).json({ success: true, data });
});

const listAuditLog = catchAsync(async (req, res) => {
  const result = await service.listAuditLog(req.query);
  res.status(200).json({ success: true, ...result });
});

// ---- Roles ----
const createRole = catchAsync(async (req, res) => {
  const data = await service.createRole(req.body);
  res.status(201).json({ success: true, data });
});

const listRoles = catchAsync(async (req, res) => {
  const data = await service.listRoles();
  res.status(200).json({ success: true, data });
});

const assignRole = catchAsync(async (req, res) => {
  const data = await service.assignRole(req.user.id, req.params.id, req.body.roleName);
  res.status(200).json({ success: true, data });
});

module.exports = {
  createCollege,
  updateCollege,
  deleteCollege,
  addCollegeImage,
  importColleges,
  importCollegeCourses,
  createCollegeCourseLink,
  createCutoffEntry,
  createFeeEntry,
  createSeatMatrixEntry,
  importCutoffs,
  importFees,
  importSeatMatrix,
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
