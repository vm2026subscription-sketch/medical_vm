const mongoose = require('mongoose');

const collegeCourseSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    // null means intake information is unavailable, not zero seats.
    totalSeats: { type: Number, default: null, min: 1, validate: { validator: (value) => value == null || Number.isInteger(value), message: 'Total seats must be a positive whole number or N/A' } },
  },
  { timestamps: true }
);

collegeCourseSchema.index({ collegeId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('CollegeCourse', collegeCourseSchema);
