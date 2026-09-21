const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminUser', adminUserSchema);
