const ApiError = require('../utils/ApiError');
const AdminUser = require('../models/AdminUser');
const Role = require('../models/Role');

/**
 * requireAdmin — ensures the caller is an admin (any role) and attaches req.adminRole.
 * Must run after requireAuth().
 */
function requireAdmin() {
  return async (req, res, next) => {
    try {
      if (!req.user) throw ApiError.unauthorized();
      if (req.user.role !== 'admin') throw ApiError.forbidden('Admin access required');

      const adminUser = await AdminUser.findOne({ userId: req.user.id }).populate('roleId');
      if (!adminUser || !adminUser.roleId) throw ApiError.forbidden('No admin role assigned');

      req.adminRole = adminUser.roleId; // { name, permissions[] }
      // This role has a fixed boundary, even if an old database role contains broad permissions.
      if (req.adminRole.name === 'data_editor') req.adminRole = { name: 'data_editor', permissions: ['imports:write'] };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requirePermission('colleges:write') — checks the admin's role includes the given
 * permission string. super_admin implicitly passes everything. Must run after requireAdmin().
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.adminRole) return next(ApiError.forbidden('Admin role not resolved'));
    if (req.adminRole.name === 'super_admin') return next();
    if (req.adminRole.name === 'data_editor' && permission !== 'imports:write') return next(ApiError.forbidden('Data-entry accounts can prepare and submit import drafts only'));
    if (req.adminRole.permissions.includes(permission)) return next();
    return next(ApiError.forbidden(`Missing permission: ${permission}`));
  };
}

function requireSuperAdmin(req, _res, next) {
  if (req.adminRole?.name !== 'super_admin') return next(ApiError.forbidden('Only a full administrator can manage admin access'));
  next();
}

module.exports = { requireAdmin, requirePermission, requireSuperAdmin, Role };
