const ApiError = require('../../utils/ApiError');
const User = require('../../models/User');
const Role = require('../../models/Role');
const AdminUser = require('../../models/AdminUser');
const Audit = require('../../models/AuditLog');
const Lock = require('../../models/CatalogLock');
const { transaction } = require('./importWorkflow.service');

// Serialize access changes and recheck the caller inside the transaction, so two
// administrators cannot remove each other and leave the platform without an admin.
async function changeAccess(actorId, filter, roleName) {
  return transaction(async (session) => {
    await Lock.updateOne({ _id: 'catalog' }, { $inc: { revision: 1 } }, { session });
    const actor = await User.findById(actorId).session(session);
    const assignment = await AdminUser.findOne({ userId: actorId }).populate('roleId').session(session);
    if (!actor?.isActive || actor.role !== 'admin' || assignment?.roleId?.name !== 'super_admin') throw ApiError.forbidden('Only a full administrator can manage admin access');
    const user = await User.findOne(filter).session(session);
    if (!user) throw ApiError.notFound('Registered user not found. Ask this person to sign up first.');
    if (String(user._id) === String(actorId)) throw ApiError.badRequest('You cannot change your own admin access');
    if (roleName && !user.isActive) throw ApiError.badRequest('Activate this user account before granting admin access');
    const existing = await AdminUser.findOne({ userId: user._id }).populate('roleId').session(session);
    const before = { role: user.role, adminRole: existing?.roleId?.name || null };
    if (roleName) {
      const role = ['super_admin', 'data_editor'].includes(roleName)
        ? await Role.findOneAndUpdate({ name: roleName }, { $setOnInsert: { permissions: roleName === 'super_admin' ? ['*'] : ['imports:write'] } }, { upsert: true, new: true, session })
        : await Role.findOne({ name: roleName }).session(session);
      if (!role) throw ApiError.notFound('Admin role not found');
      await AdminUser.updateOne({ userId: user._id }, { $set: { roleId: role._id } }, { upsert: true, session });
    } else {
      if (!existing && user.role !== 'admin') throw ApiError.notFound('This user does not have admin access');
      await AdminUser.deleteOne({ userId: user._id }, { session });
    }
    user.role = roleName ? 'admin' : 'student';
    await user.save({ session });
    await Audit.create([{ adminUserId: actorId, action: roleName ? 'grant_admin_access' : 'revoke_admin_access', entity: 'User', entityId: user._id, before, after: { role: user.role, adminRole: roleName || null } }], { session });
    return { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, adminRole: roleName || null };
  });
}

module.exports = { changeAccess };
