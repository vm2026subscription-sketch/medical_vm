const mongoose = require('mongoose');

// Year-versioned: never mutate an existing year's record, always insert a new one for a new year.
const feeSchema = new mongoose.Schema(
  {
    collegeCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeCourse', required: true, index: true },
    year: { type: Number, required: true, index: true },
    tier: { type: String, enum: ['merit', 'management', 'nri'], required: true },
    tuition: { type: Number, default: null, min: 0 },
    otherCharges: { type: Number, default: null, min: 0 },
    sourceTag: { type: String }, // e.g. "FRA Maharashtra 2025"
  },
  { timestamps: true }
);

feeSchema.index({ collegeCourseId: 1, year: 1, tier: 1 }, { unique: true });

module.exports = mongoose.model('Fee', feeSchema);
