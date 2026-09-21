const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    neetRank: { type: Number },
    neetScore: { type: Number },
    category: {
      type: String,
      enum: ['General', 'EWS', 'OBC', 'SC', 'ST', 'PwD'],
    },
    homeState: { type: String },
    domicile: { type: String },
    marks: { type: Number },
    preferences: {
      maxBudget: { type: Number },
      courses: [{ type: String }], // e.g. ['MBBS', 'BDS', 'BAMS']
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
