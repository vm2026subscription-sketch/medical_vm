const router = require('express').Router();
const { z } = require('zod');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { requirePermission, requireSuperAdmin } = require('../../middlewares/rbac');
const User = require('../../models/User');
const Role = require('../../models/Role');
const AdminUser = require('../../models/AdminUser');
const Audit = require('../../models/AuditLog');
const { transaction } = require('./importWorkflow.service');
const { changeAccess } = require('./adminAccess.service');
router.get('/admin-access', requireSuperAdmin, catchAsync(async (_req, res) => {
  const data = await AdminUser.find().populate('userId', 'name email phone isActive').populate('roleId', 'name').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
}));
router.post('/admin-access', requireSuperAdmin, catchAsync(async (req, res) => {
  const parsed = z.object({ identifier: z.string().trim().min(1).max(254) }).strict().safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Enter the registered email or phone number');
  const identifier = parsed.data.identifier;
  let filter;
  if (z.string().email().safeParse(identifier).success) filter = { email: identifier.toLowerCase() };
  else {
    const phone = identifier.replace(/[\s()-]/g, '');
    if (!/^\+?\d{10,15}$/.test(phone)) throw ApiError.badRequest('Enter a valid registered email or phone number');
    filter = { phone: `+${phone.replace(/^\+/, '')}` };
  }
  res.json({ success: true, data: await changeAccess(req.user.id, filter, 'super_admin') });
}));
router.delete('/admin-access/:id', requireSuperAdmin, catchAsync(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw ApiError.badRequest('Invalid user ID');
  res.json({ success: true, data: await changeAccess(req.user.id, { _id: req.params.id }, null) });
}));
router.get('/data-entry-users', requirePermission('roles:manage'), catchAsync(async (req, res) => {
  const role = await Role.findOne({ name: 'data_editor' }).lean();
  const data = role ? await AdminUser.find({ roleId: role._id }).populate('userId', 'name email phone isActive').lean() : [];
  res.json({ success: true, data });
}));
router.post('/data-entry-users', requirePermission('roles:manage'), catchAsync(async (req, res) => {
  const parsed = z.object({ email: z.string().trim().email().toLowerCase() }).safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest('Enter the email of an existing registered user');
  const result = await transaction(async (session) => {
    const user = await User.findOne({ email: parsed.data.email, isActive: true }).session(session);
    if (!user) throw ApiError.notFound('Active registered user not found. Ask this person to sign up first.');
    if (String(user._id) === String(req.user.id)) throw ApiError.badRequest('You cannot change your own access here');
    const existing = await AdminUser.findOne({ userId: user._id }).populate('roleId').session(session);
    if (existing && existing.roleId?.name !== 'data_editor') throw ApiError.conflict('This account already has another admin role. It cannot be replaced here.');
    const role = await Role.findOneAndUpdate({ name: 'data_editor' }, { $set: { permissions: ['imports:write'] } }, { upsert: true, new: true, session });
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } }, { session });
    await AdminUser.updateOne({ userId: user._id }, { $set: { roleId: role._id } }, { upsert: true, session });
    await Audit.create([{ adminUserId: req.user.id, action: 'assign_data_editor', entity: 'User', entityId: user._id }], { session });
    return { email: user.email };
  });
  res.json({ success: true, data: result });
}));
router.delete('/data-entry-users/:id', requirePermission('roles:manage'), catchAsync(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw ApiError.badRequest('Invalid user ID');
  await transaction(async (session) => {
    const record = await AdminUser.findOne({ userId: req.params.id }).populate('roleId').session(session);
    if (!record || record.roleId?.name !== 'data_editor') throw ApiError.notFound('Data-entry account not found');
    await AdminUser.deleteOne({ _id: record._id }, { session });
    await User.updateOne({ _id: req.params.id }, { $set: { role: 'student' } }, { session });
    await Audit.create([{ adminUserId: req.user.id, action: 'revoke_data_editor', entity: 'User', entityId: req.params.id }], { session });
  });
  res.json({ success: true });
}));
module.exports = router;
