const express = require('express');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { requireAdmin, requirePermission, requireSuperAdmin } = require('../../middlewares/rbac');
const upload = require('../../middlewares/upload');
const schemas = require('./admin.validation');
const controller = require('./admin.controller');

const router = express.Router();

// Every admin route requires a valid user session AND a resolved admin role.
router.use(requireAuth(), requireAdmin());
router.use(require('./importWorkflow.routes'));
router.use(require('./team.routes'));
router.use(require('./catalogDelete.routes'));
// Catalog changes must pass the same review workflow; old clients cannot bypass it.
router.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && /^\/(?:catalog\/)?(?:colleges|courses|college-courses|cutoffs|fees|seat-matrix|hostel-fees|bonds)(?:\/|$)/i.test(req.path)) {
    return next(require('../../utils/ApiError').conflict('Create an import draft in Data entry, then validate, submit and publish it. Direct catalog writes have been retired.'));
  }
  next();
});
router.use(require('./console.routes'));

// Colleges
router.post('/colleges', requirePermission('colleges:write'), validate(schemas.createCollege), controller.createCollege);
router.put('/colleges/:id', requirePermission('colleges:write'), validate(schemas.updateCollege), controller.updateCollege);
router.delete('/colleges/:id', requirePermission('colleges:write'), controller.deleteCollege);
router.post('/colleges/:id/images', requirePermission('colleges:write'), upload.uploadImage.single('file'), controller.addCollegeImage);
router.post('/colleges/bulk-import', requirePermission('colleges:import'), upload.single('file'), controller.importColleges);

// Data imports (college-course links / cutoffs / fees / seat-matrix)
router.post('/college-courses/bulk-import', requirePermission('collegecourses:import'), upload.single('file'), controller.importCollegeCourses);
router.post('/college-courses', requirePermission('collegecourses:import'), validate(schemas.createCollegeCourseLink), controller.createCollegeCourseLink);
router.post('/cutoffs/bulk-import', requirePermission('cutoffs:import'), upload.single('file'), controller.importCutoffs);
router.post('/cutoffs', requirePermission('cutoffs:import'), validate(schemas.createCutoffEntry), controller.createCutoffEntry);
router.post('/fees/bulk-import', requirePermission('fees:import'), upload.single('file'), controller.importFees);
router.post('/fees', requirePermission('fees:import'), validate(schemas.createFeeEntry), controller.createFeeEntry);
router.post('/seat-matrix/bulk-import', requirePermission('seatmatrix:import'), upload.single('file'), controller.importSeatMatrix);
router.post('/seat-matrix', requirePermission('seatmatrix:import'), validate(schemas.createSeatMatrixEntry), controller.createSeatMatrixEntry);

// Users
router.get('/users', requirePermission('users:read'), controller.listUsers);
router.patch('/users/:id', requirePermission('users:manage'), validate(schemas.patchUser), controller.patchUser);

// Payments & coupons
router.get('/payments', requirePermission('payments:read'), controller.listPayments);
router.get('/coupons', requirePermission('coupons:read'), controller.listCoupons);
router.post('/coupons', requirePermission('coupons:write'), validate(schemas.createCoupon), controller.createCoupon);
router.patch('/coupons/:id', requirePermission('coupons:write'), validate(schemas.updateCoupon), controller.updateCoupon);

// Counsellors & bookings (ops console)
router.get('/counsellors', requirePermission('counsellors:read'), controller.listCounsellorsAdmin);
router.post('/counsellors', requirePermission('counsellors:manage'), validate(schemas.createCounsellor), controller.createCounsellor);
router.patch('/counsellors/:id', requirePermission('counsellors:manage'), validate(schemas.updateCounsellor), controller.updateCounsellor);
router.get('/bookings', requirePermission('bookings:read'), controller.listBookingsAdmin);

// Analytics & audit
router.get('/analytics/overview', requirePermission('analytics:read'), controller.analyticsOverview);
router.get('/audit-log', requirePermission('audit:read'), controller.listAuditLog);

// Roles / RBAC management (super_admin only in practice, since requirePermission passes super_admin through)
router.get('/roles', requirePermission('roles:manage'), controller.listRoles);
router.post('/roles', requireSuperAdmin, validate(schemas.createRole), controller.createRole);
router.patch('/admin-users/:id/role', requireSuperAdmin, validate(schemas.assignRole), controller.assignRole);

module.exports = router;
