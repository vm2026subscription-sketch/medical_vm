const AuditLog = require('../../models/AuditLog');

async function recordAudit({ adminUserId, action, entity, entityId, before, after, ip }) {
  await AuditLog.create({ adminUserId, action, entity, entityId, before, after, ip });
}

module.exports = { recordAudit };
