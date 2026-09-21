const mongoose = require('mongoose');

// This is the paywalled "crown jewel" data. Always insert new records per year/round —
// never overwrite historical cutoffs.
const cutOffSchema = new mongoose.Schema(
  {
    collegeCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeCourse', required: true, index: true },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      validate: { validator: (value) => require('../utils/categoryCodes').categorySchema.safeParse(value).success, message: 'Use a category code of 1–80 characters' },
      required: true,
      index: true,
    },
    quota: { type: String, enum: ['AIQ', 'State', 'Management', 'NRI', 'Deemed'], required: true, index: true },
    authority: { type: String, required: true, index: true }, // MCC, AACCC, state CET cell name, etc.
    year: { type: Number, required: true, index: true },
    round: {
      type: String,
      enum: ['Round1', 'Round2', 'MopUp', 'Stray', 'Round3'],
      required: true,
    },
    closingRank: { type: Number, required: true },
    closingScore: { type: Number },
    seats: { type: Number },
  },
  { timestamps: true }
);

cutOffSchema.index(
  { collegeCourseId: 1, category: 1, quota: 1, authority: 1, year: 1, round: 1 },
  { unique: true }
);

module.exports = mongoose.model('CutOff', cutOffSchema);
