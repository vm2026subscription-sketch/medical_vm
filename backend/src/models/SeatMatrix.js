const mongoose = require('mongoose');

const seatMatrixSchema = new mongoose.Schema(
  {
    collegeCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeCourse', required: true, index: true },
    authority: { type: String, required: true },
    category: { type: String, required: true, trim: true, maxlength: 80, validate: { validator: (value) => require('../utils/categoryCodes').categorySchema.safeParse(value).success, message: 'Use a category code of 1–80 characters' } },
    quota: { type: String, required: true },
    round: { type: String, required: true },
    year: { type: Number, required: true, index: true },
    seats: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeatMatrix', seatMatrixSchema);
