const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    input: {
      rank: Number,
      category: String,
      state: String,
      budget: Number,
      courses: [String],
    },
    result: [
      {
        collegeCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollegeCourse' },
        collegeName: String,
        courseName: String,
        bucket: { type: String, enum: ['dream', 'target', 'safe'] },
        probability: Number,
        reason: String,
      },
    ],
    isPremiumRun: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prediction', predictionSchema);
