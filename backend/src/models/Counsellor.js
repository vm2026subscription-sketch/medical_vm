const mongoose = require('mongoose');

const counsellorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    specialization: [{ type: String }], // e.g. ['MBBS & AYUSH', 'AIQ & Deemed specialist']
    languages: [{ type: String }],
    rating: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    pricePerSession: { type: Number, required: true },
    commissionRate: { type: Number, default: 0.3 }, // platform commission, 0-1
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counsellor', counsellorSchema);
