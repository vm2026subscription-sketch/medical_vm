const crypto = require('crypto');
const { nanoid } = require('nanoid');
const razorpay = require('../../config/razorpay');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/ApiError');
const mongoose = require('mongoose');
const Coupon = require('../../models/Coupon');
const { assertConfigured, toPaise } = require('./paymentGateway');
const Plan = require('../../models/Plan');
const Payment = require('../../models/Payment');
const Subscription = require('../../models/Subscription');
const { applyCoupon } = require('../shared/coupon.helper');

async function listPlans() {
  return Plan.find({ isActive: true }).sort({ price: 1 }).lean();
}

/**
 * createCheckoutOrder — validates the plan + coupon, creates a Razorpay order, and records
 * a Payment row in 'created' status. The subscription itself is only activated once the
 * webhook confirms payment — never on the client's say-so.
 */
async function createCheckoutOrder(userId, planId, couponCode) {
  assertConfigured();
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) throw ApiError.notFound('Plan not found');

  const { amount, coupon } = await applyCoupon(couponCode, plan.price);
  if (!Number.isInteger(plan.durationDays) || plan.durationDays < 1) throw ApiError.badRequest('Plan duration is invalid');
  const amountPaise = toPaise(amount);
  const idempotencyKey = nanoid();

  let order;
  try {
    order = await razorpay.orders.create({
      amount: amountPaise, // integer paise
      currency: 'INR',
      receipt: idempotencyKey,
      notes: { userId: userId.toString(), planId: planId.toString(), purpose: 'subscription' },
    });
  } catch (err) {
    logger.error({ err }, 'Razorpay order creation failed');
    throw ApiError.internal('Could not create payment order. Please try again.');
  }

  const payment = await Payment.create({
    userId,
    amount,
    gatewayOrderId: order.id,
    status: 'created',
    purpose: 'subscription',
    purposeRefId: plan._id,
    planDurationDays: plan.durationDays,
    couponId: coupon?._id,
    idempotencyKey,
  });

  return {
    paymentId: payment._id,
    razorpayOrderId: order.id,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    amount,
    currency: 'INR',
    plan: { id: plan._id, name: plan.name, durationDays: plan.durationDays },
  };
}

function equalSignature(secret, input, signature) {
  if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(input).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
function verifyWebhookSignature(rawBody, signature) {
  return Buffer.isBuffer(rawBody) && equalSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);
}
function assertPaymentMatches(payment, entity) {
  if (entity.order_id !== payment.gatewayOrderId || entity.currency !== payment.currency || entity.amount !== toPaise(payment.amount) || !entity.id) throw ApiError.badRequest('Payment order, amount or currency mismatch');
}
async function capturePayment(entity) {
  if (entity.status !== 'captured' || entity.captured !== true) throw ApiError.badRequest('Payment has not been captured');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ gatewayOrderId: entity.order_id }).session(session);
      if (!payment) throw new ApiError(503, 'Payment order is not recorded yet. Retry notification.');
      assertPaymentMatches(payment, entity);
      if (payment.status === 'paid' || payment.status === 'refunded') return;
      // Claim the same document in the transaction so concurrent webhook/callback retries conflict safely.
      payment.status = 'paid'; payment.gatewayPaymentId = entity.id;
      await payment.save({ session });
      let fulfilled = true;
      if (payment.purpose === 'subscription') {
        const plan = await Plan.findById(payment.purposeRefId).session(session);
        const duration = payment.planDurationDays || plan?.durationDays;
        if (!duration || !payment.purposeRefId) throw new Error('Purchased plan is missing its duration');
        const startDate = new Date();
        await Subscription.create([{ userId: payment.userId, planId: payment.purposeRefId, status: 'active', startDate, expiryDate: new Date(startDate.getTime() + duration * 86400000), source: 'purchase' }], { session });
      } else if (payment.purpose === 'booking') {
        fulfilled = await require('../counselling/counselling.service').confirmBookingAfterPayment(payment, session);
      } else throw new Error('Unsupported payment purpose');
      if (payment.couponId) await Coupon.updateOne({ _id: payment.couponId }, { $inc: { timesUsed: 1 } }, { session });
      payment.fulfillmentStatus = fulfilled ? 'fulfilled' : 'manual_review';
      payment.fulfillmentMessage = fulfilled ? undefined : 'Payment received, but the slot is no longer reserved. Contact support with this payment reference for rebooking or a refund.';
      payment.fulfilledAt = new Date();
      await payment.save({ session });
    });
  } finally { await session.endSession(); }
}
async function handleWebhook(event) {
  if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event)) return;
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) throw ApiError.badRequest('Missing payment event details');
  if (event.event === 'payment.failed') {
    // Failure of one attempt must never downgrade a captured order.
    await Payment.updateOne({ gatewayOrderId: entity.order_id, status: 'created' }, { $set: { status: 'failed' } });
  } else await capturePayment(entity);
}
function statusResponse(payment) {
  return { paymentId: payment._id, status: payment.status, fulfillmentStatus: payment.fulfillmentStatus, message: payment.fulfillmentMessage || '', amount: payment.amount, purpose: payment.purpose };
}
async function getPaymentStatus(userId, paymentId) {
  let payment = await Payment.findOne({ _id: paymentId, userId });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (!['paid', 'refunded'].includes(payment.status)) {
    assertConfigured();
    const result = await razorpay.orders.fetchPayments(payment.gatewayOrderId);
    const captured = result.items?.find((item) => item.status === 'captured');
    if (captured) { await capturePayment(captured); payment = await Payment.findById(paymentId); }
  }
  return statusResponse(payment);
}
async function verifyCheckout(userId, input) {
  assertConfigured();
  const payment = await Payment.findOne({ _id: input.paymentId, userId });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (input.razorpay_order_id !== payment.gatewayOrderId || !equalSignature(env.RAZORPAY_KEY_SECRET, payment.gatewayOrderId + '|' + input.razorpay_payment_id, input.razorpay_signature)) throw ApiError.badRequest('Invalid checkout signature');
  const entity = await razorpay.payments.fetch(input.razorpay_payment_id);
  assertPaymentMatches(payment, entity);
  if (entity.status === 'captured') await capturePayment(entity);
  return statusResponse(await Payment.findById(payment._id));
}
async function listInvoices(userId) { return Payment.find({ userId, status: 'paid' }).sort({ createdAt: -1 }).lean(); }
module.exports = { listPlans, createCheckoutOrder, verifyWebhookSignature, handleWebhook, listInvoices, verifyCheckout, getPaymentStatus };
