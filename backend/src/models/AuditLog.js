const mongoose = require('mongoose');

// Written on every admin mutation of colleges/fees/cutoffs/seat-matrix/coupons/roles etc.
const auditLogSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true }, // 'create' | 'update' | 'delete' | 'bulk_import'
    entity: { type: String, required: true }, // 'College' | 'CutOff' | ...
    entityId: { type: mongoose.Schema.Types.ObjectId },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
