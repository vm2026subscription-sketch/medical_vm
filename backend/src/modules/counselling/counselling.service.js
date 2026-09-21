const mongoose = require('mongoose');
const { assertConfigured, toPaise } = require('../billing/paymentGateway');
const { nanoid } = require('nanoid');
const razorpay = require('../../config/razorpay');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/ApiError');
const Counsellor = require('../../models/Counsellor');
const Service = require('../../models/Service');
const AvailabilitySlot = require('../../models/AvailabilitySlot');
const Booking = require('../../models/Booking');
const Payment = require('../../models/Payment');
const Feedback = require('../../models/Feedback');
const { applyCoupon } = require('../shared/coupon.helper');
const { scheduleSlotRelease } = require('../../jobs/queues');

async function listCounsellors() {
  return Counsellor.find({ isActive: true }).populate('userId', 'name').sort({ rating: -1 }).lean();
}

async function listServices() {
  return Service.find({ isActive: true }).sort({ price: 1 }).lean();
}

async function listSlotsForDate(counsellorId, dateStr) {
  if (!await Counsellor.exists({ _id: counsellorId, isActive: true })) throw ApiError.notFound('Counsellor not found');
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);

  // Lazily treat expired holds as open without requiring the release job to have run yet.
  await AvailabilitySlot.updateMany(
    { counsellorId, status: 'held', heldUntil: { $lt: new Date() } },
    { $set: { status: 'open' }, $unset: { heldUntil: '', heldByUserId: '', holdToken: '', checkoutBookingId: '' } }
  );

  return AvailabilitySlot.find({ counsellorId, datetime: { $gte: new Date(Math.max(start.getTime(), Date.now())), $lt: end } })
    .select('_id datetime status')
    .sort({ datetime: 1 })
    .lean();
}

/**
 * holdSlot — atomically transitions a slot from 'open' to 'held' for SLOT_HOLD_MINUTES.
 * The atomicity comes from the single findOneAndUpdate with status:'open' in the filter —
 * if two requests race, only one matches and the DB itself resolves the conflict.
 * A BullMQ delayed job is also scheduled as a belt-and-braces release mechanism.
 */
async function holdSlot(slotId, userId) {
  const candidate = await AvailabilitySlot.findById(slotId).select('counsellorId').lean();
  if (!candidate || !await Counsellor.exists({ _id: candidate.counsellorId, isActive: true })) throw ApiError.notFound('Slot not found');
  await releaseSlotIfExpired(slotId);
  const heldUntil = new Date(Date.now() + env.SLOT_HOLD_MINUTES * 60 * 1000);
  const holdToken = nanoid();

  const slot = await AvailabilitySlot.findOneAndUpdate(
    { _id: slotId, status: 'open', datetime: { $gt: new Date() } },
    { $set: { status: 'held', heldUntil, heldByUserId: userId, holdToken }, $unset: { checkoutBookingId: '' } },
    { new: true }
  );

  if (!slot) {
    throw ApiError.conflict('This slot was just taken or is unavailable. Please pick another.');
  }

  await scheduleSlotRelease(slotId.toString(), env.SLOT_HOLD_MINUTES * 60 * 1000);

  return { slotId: slot._id, holdToken, heldUntil };
}

async function releaseSlotIfExpired(slotId) {
  await AvailabilitySlot.updateOne(
    { _id: slotId, status: 'held', heldUntil: { $lt: new Date() } },
    { $set: { status: 'open' }, $unset: { heldUntil: '', heldByUserId: '', holdToken: '', checkoutBookingId: '' } }
  );
}

/**
 * createBooking — validates the hold token still owns the slot, creates a Razorpay order
 * for the service price, and creates a 'pending_payment' booking. Confirmation happens only
 * in confirmBookingAfterPayment(), triggered by the billing webhook.
 */
async function createBooking(userId, { slotId, holdToken, serviceId, couponCode }) {
  assertConfigured();
  const slot = await AvailabilitySlot.findById(slotId);
  if (!slot || slot.status !== 'held' || slot.holdToken !== holdToken || String(slot.heldByUserId) !== String(userId)) {
    throw ApiError.conflict('Your hold on this slot has expired. Please select a slot again.');
  }
  if (slot.heldUntil.getTime() < Date.now()) {
    throw ApiError.conflict('Your hold on this slot has expired. Please select a slot again.');
  }

  if (slot.datetime <= new Date()) throw ApiError.conflict('This slot has already started.');
  if (slot.checkoutBookingId) {
    const existing = await Payment.findOne({ purpose: 'booking', purposeRefId: slot.checkoutBookingId, userId });
    if (existing && existing.status !== 'paid') return { bookingId: slot.checkoutBookingId, paymentId: existing._id, razorpayOrderId: existing.gatewayOrderId, razorpayKeyId: env.RAZORPAY_KEY_ID, amount: existing.amount, currency: existing.currency };
    throw ApiError.conflict('This slot already has a checkout.');
  }
  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) throw ApiError.notFound('Service not found');

  const { amount, coupon } = await applyCoupon(couponCode, service.price);
  const amountPaise = toPaise(amount);
  const idempotencyKey = nanoid();

  let order;
  try {
    order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: idempotencyKey,
      notes: { userId: userId.toString(), slotId: slotId.toString(), purpose: 'booking' },
    });
  } catch (err) {
    logger.error({ err }, 'Razorpay order creation failed for booking');
    throw ApiError.internal('Could not create payment order. Please try again.');
  }

  const bookingId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const reserved = await AvailabilitySlot.updateOne({ _id: slotId, status: 'held', holdToken, heldByUserId: userId, heldUntil: { $gt: new Date() }, datetime: { $gt: new Date() }, checkoutBookingId: null }, { $set: { checkoutBookingId: bookingId, heldUntil: new Date(Date.now() + 15 * 60000) } }, { session });
      if (!reserved.modifiedCount) throw ApiError.conflict('This hold expired or already has a checkout. Select the slot again.');
      await Booking.create([{ _id: bookingId, userId, counsellorId: slot.counsellorId, serviceId, slotId, status: 'pending_payment', paymentId }], { session });
      await Payment.create([{ _id: paymentId, userId, amount, gatewayOrderId: order.id, status: 'created', purpose: 'booking', purposeRefId: bookingId, couponId: coupon?._id, idempotencyKey }], { session });
    });
  } finally { await session.endSession(); }

  return {
    bookingId,
    paymentId,
    razorpayOrderId: order.id,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    amount,
    currency: 'INR',
  };
}

/**
 * confirmBookingAfterPayment — called from the billing webhook once Razorpay confirms
 * payment.captured for a purpose:'booking' payment. Marks the slot booked and generates
 * a meeting link. Idempotent: if the booking is already confirmed, this is a no-op.
 */
async function confirmBookingAfterPayment(payment, session) {
  const booking = await Booking.findById(payment.purposeRefId).session(session);
  if (!booking) throw new Error('Booking missing for captured payment');
  if (booking.status === 'confirmed' || booking.status === 'completed') return true;
  if (booking.status !== 'pending_payment') return false;
  const reserved = await AvailabilitySlot.updateOne({ _id: booking.slotId, status: 'held', checkoutBookingId: booking._id, heldByUserId: booking.userId, datetime: { $gt: new Date() } }, { $set: { status: 'booked' }, $unset: { heldUntil: '', heldByUserId: '', holdToken: '', checkoutBookingId: '' } }, { session });
  if (!reserved.modifiedCount) return false;
  booking.status = 'confirmed';
  await booking.save({ session });
  return true;
}

async function listBookingsForUser(userId) {
  return Booking.find({ userId })
    .populate('counsellorId')
    .populate('serviceId')
    .populate('slotId')
    .sort({ createdAt: -1 })
    .lean();
}

async function rescheduleBooking(userId, bookingId, newSlotId) {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'confirmed') throw ApiError.badRequest('Only confirmed bookings can be rescheduled');

  const newSlot = await AvailabilitySlot.findOneAndUpdate(
    { _id: newSlotId, status: 'open' },
    { $set: { status: 'booked' } },
    { new: true }
  );
  if (!newSlot) throw ApiError.conflict('The new slot is unavailable');

  const oldSlotId = booking.slotId;
  booking.slotId = newSlot._id;
  await booking.save();

  await AvailabilitySlot.findByIdAndUpdate(oldSlotId, { $set: { status: 'open' } });

  return booking;
}

async function submitFeedback(userId, bookingId, { rating, review }) {
  const booking = await Booking.findOne({ _id: bookingId, userId });
  if (!booking) throw ApiError.notFound('Booking not found');

  return Feedback.findOneAndUpdate(
    { bookingId },
    { $set: { rating, review } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  listCounsellors,
  listServices,
  listSlotsForDate,
  holdSlot,
  releaseSlotIfExpired,
  createBooking,
  confirmBookingAfterPayment,
  listBookingsForUser,
  rescheduleBooking,
  submitFeedback,
};
