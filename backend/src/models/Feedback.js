const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    review: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
