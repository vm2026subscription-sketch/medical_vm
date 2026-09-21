const mongoose = require('mongoose');

const hostelFeeSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    year: { type: Number, required: true },
    amount: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

hostelFeeSchema.index({ collegeId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('HostelFee', hostelFeeSchema);
