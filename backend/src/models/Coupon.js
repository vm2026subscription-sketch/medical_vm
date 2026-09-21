const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ['flat', 'percent'], required: true },
    value: { type: Number, required: true },
    usageLimit: { type: Number, default: null }, // null = unlimited
    timesUsed: { type: Number, default: 0 },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    referralUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.methods.isValidNow = function isValidNow() {
  const now = Date.now();
  const withinWindow = this.validFrom.getTime() <= now && now <= this.validTo.getTime();
  const withinLimit = this.usageLimit === null || this.timesUsed < this.usageLimit;
  return this.isActive && withinWindow && withinLimit;
};

module.exports = mongoose.model('Coupon', couponSchema);
