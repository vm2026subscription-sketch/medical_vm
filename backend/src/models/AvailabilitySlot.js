const mongoose = require('mongoose');

// status transitions: open -> held (temporary, 5 min) -> booked
// A background job releases held slots back to 'open' once heldUntil passes without payment.
const availabilitySlotSchema = new mongoose.Schema(
  {
    counsellorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
    datetime: { type: Date, required: true, index: true },
    status: { type: String, enum: ['open', 'held', 'booked'], default: 'open', index: true },
    heldUntil: { type: Date },
    heldByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    holdToken: { type: String },
    checkoutBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true }
);

availabilitySlotSchema.index({ counsellorId: 1, datetime: 1 }, { unique: true });

module.exports = mongoose.model('AvailabilitySlot', availabilitySlotSchema);
