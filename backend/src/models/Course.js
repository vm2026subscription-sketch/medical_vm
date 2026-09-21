const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "BAMS"
    slug: { type: String, required: true, unique: true, index: true },
    fullName: { type: String }, // e.g. "Bachelor of Ayurvedic Medicine & Surgery"
    duration: { type: String }, // e.g. "5.5 years (4.5 + 1 year internship)"
    eligibility: [{ type: String }],
    careerPath: [{ type: String }],
    description: { type: String },
    discipline: { type: String, enum: require('../modules/courses/courseSchema').disciplines },
    level: { type: String, enum: ['Degree', 'Diploma'] },
    admissionRoute: { type: String, enum: ['neet-ug', 'institution-specific'] },
    admissionNotes: String,
    aliases: [String],
    sourceUrls: [String],
    reviewedOn: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
