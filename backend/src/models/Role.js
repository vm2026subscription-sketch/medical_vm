const mongoose = require('mongoose');

// Fixed permission strings used across admin routes, e.g. 'colleges:write', 'cutoffs:import',
// 'payments:read', 'counsellors:manage', 'users:manage', 'settings:manage'.
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['super_admin', 'data_editor', 'counsellor', 'support', 'finance', 'read_only'],
    },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
