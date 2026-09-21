const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true }, // rupees
    currency: { type: String, default: 'INR' },
    gatewayOrderId: { type: String, required: true, unique: true, index: true },
    gatewayPaymentId: { type: String, index: true },
    planDurationDays: { type: Number },
    fulfillmentStatus: { type: String, enum: ['pending', 'fulfilled', 'manual_review'], default: 'pending' },
    fulfillmentMessage: { type: String },
    fulfilledAt: { type: Date },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created', index: true },
    purpose: { type: String, enum: ['subscription', 'booking', 'dfy'], required: true },
    purposeRefId: { type: mongoose.Schema.Types.ObjectId }, // planId or bookingId
    invoiceUrl: { type: String },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
