const mongoose = require('mongoose');

const savedCollegeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    notes: { type: String },
    tag: { type: String, enum: ['safe', 'target', 'dream'] },
  },
  { timestamps: true }
);

savedCollegeSchema.index({ userId: 1, collegeId: 1 }, { unique: true });

module.exports = mongoose.model('SavedCollege', savedCollegeSchema);
