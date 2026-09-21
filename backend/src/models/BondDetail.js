const mongoose = require('mongoose');

const bondDetailSchema = new mongoose.Schema(
  {
    collegeCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeCourse', required: true, index: true },
    years: { type: Number, default: null, min: 0, max: 50 }, // null means duration unavailable
    penaltyAmount: { type: Number, default: null, min: 0 },
    applicableStates: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('BondDetail', bondDetailSchema);
