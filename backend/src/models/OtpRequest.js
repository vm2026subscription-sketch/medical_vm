const mongoose = require('mongoose');

// Generalized identifier field: stores either a phone number or an email address depending
// on channel. Kept as one collection so rate-limiting/attempt-tracking logic is shared.
const otpRequestSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, index: true }, // phone number OR email
    channel: { type: String, enum: ['sms', 'email'], required: true, default: 'sms' },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 }); // TTL cleanup after 10 min

module.exports = mongoose.model('OtpRequest', otpRequestSchema);
