const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    counsellorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'AvailabilitySlot', required: true },
    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'],
      default: 'pending_payment',
      index: true,
    },
    meetingLink: { type: String },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
