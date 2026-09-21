const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  identifier: { type: String, required: true },
  channel: { type: String, enum: ['sms', 'email'], required: true },
  provider: { type: String, required: true },
  version: { type: String, required: true },
  codeHash: { type: String, required: true },
  providerSid: String,
  requestedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  state: { type: String, enum: ['sending', 'ready', 'consumed', 'failed'], required: true },
}, { timestamps: true });
schema.index({ identifier: 1, channel: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });
module.exports = mongoose.model('OtpChallenge', schema);
