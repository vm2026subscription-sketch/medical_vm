const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const env = require('../src/config/env');
Object.assign(env, { NODE_ENV: 'production', EMAIL_OTP_PROVIDER: 'smtp', SMTP_HOST: 'test.invalid', SMTP_USER: 'test@test.invalid', SMTP_PASS: 'isolated-password', RAZORPAY_KEY_ID: 'rzp_test_isolated', RAZORPAY_KEY_SECRET: 'isolated-key-secret', RAZORPAY_WEBHOOK_SECRET: 'isolated-webhook-secret' });
const logger = require('../src/utils/logger'); logger.level = 'silent';
const gateway = require('../src/config/razorpay');
let ordersCreated = 0, fetchedEntity;
gateway.orders.create = async () => ({ id: `order_isolated_${++ordersCreated}` });
gateway.payments.fetch = async () => fetchedEntity;
gateway.orders.fetchPayments = async () => ({ items: fetchedEntity ? [fetchedEntity] : [] });
let delivered, deliveryWorks = true;
require('../src/config/mailer').sendMail = async (message) => { delivered = message; return deliveryWorks; };
const originalFetch = global.fetch;
global.fetch = async () => { throw new Error('Unexpected real network call in integration test'); };
const otp = require('../src/modules/auth/otpProvider');
const billing = require('../src/modules/billing/billing.service');
const counselling = require('../src/modules/counselling/counselling.service');
const Challenge = require('../src/models/OtpChallenge');
const Plan = require('../src/models/Plan');
const Payment = require('../src/models/Payment');
const Subscription = require('../src/models/Subscription');
const Coupon = require('../src/models/Coupon');
const Booking = require('../src/models/Booking');
const Slot = require('../src/models/AvailabilitySlot');
const Counsellor = require('../src/models/Counsellor');
const Service = require('../src/models/Service');
const oid = () => new mongoose.Types.ObjectId();
const code = () => delivered.text.match(/code is (\d{6})/)[1];
const event = (payment, extra = {}) => ({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${payment.gatewayOrderId}`, order_id: payment.gatewayOrderId, status: 'captured', captured: true, currency: 'INR', amount: Math.round(payment.amount * 100), ...extra } } } });
let server, plan;
before(async () => {
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('isolated-auth-payments'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  plan = await Plan.create({ name: 'Season Pass', slug: 'test-pass', price: 99, durationDays: 120 });
});
after(async () => { global.fetch = originalFetch; await mongoose.disconnect(); if (server) await server.stop(); });
async function checkout(user = oid(), coupon) {
  const result = await billing.createCheckoutOrder(user, plan._id, coupon);
  return Payment.findById(result.paymentId);
}

test('SMTP codes are hashed, normalized, single-use under concurrent verification and rate limited by recipient', async () => {
  assert.deepEqual(await otp.sendEmailOtp(' Alice@Example.com '), { sent: true });
  const value = code();
  const stored = await Challenge.findOne({ identifier: 'alice@example.com' });
  assert.notEqual(stored.codeHash, value);
  await assert.rejects(otp.sendEmailOtp('alice@example.com'), { statusCode: 429 });
  const results = await Promise.allSettled([otp.verifyEmailOtp('ALICE@example.com', value), otp.verifyEmailOtp('alice@example.com', value)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  await assert.rejects(otp.verifyEmailOtp('alice@example.com', value), { statusCode: 400 });
});
test('resend replaces old codes, expiry and five concurrent bad attempts block verification', async () => {
  await otp.sendEmailOtp('retry@example.com'); const old = code();
  await Challenge.updateOne({ identifier: 'retry@example.com' }, { $set: { requestedAt: new Date(Date.now() - 61000) } });
  await otp.sendEmailOtp('retry@example.com'); const fresh = code();
  if (old !== fresh) await assert.rejects(otp.verifyEmailOtp('retry@example.com', old), { statusCode: 400 });
  await otp.verifyEmailOtp('retry@example.com', fresh);
  await assert.rejects(otp.verifyEmailOtp('retry@example.com', old), { statusCode: 400 });
  await otp.sendEmailOtp('attempts@example.com'); const valid = code();
  await Promise.allSettled(Array.from({ length: 12 }, () => otp.verifyEmailOtp('attempts@example.com', '000000')));
  assert.equal((await Challenge.findOne({ identifier: 'attempts@example.com' })).attempts, 5);
  await assert.rejects(otp.verifyEmailOtp('attempts@example.com', valid), { statusCode: 400 });
  await otp.sendEmailOtp('expired@example.com'); const expired = code();
  await Challenge.updateOne({ identifier: 'expired@example.com' }, { $set: { expiresAt: new Date(0) } });
  await assert.rejects(otp.verifyEmailOtp('expired@example.com', expired), { statusCode: 400 });
});
test('failed delivery and production mock mode never produce a usable OTP', async () => {
  deliveryWorks = false;
  try { await assert.rejects(otp.sendEmailOtp('failed@example.com'), { statusCode: 503 }); } finally { deliveryWorks = true; }
  await assert.rejects(otp.verifyEmailOtp('failed@example.com', code()), { statusCode: 400 });
  env.EMAIL_OTP_PROVIDER = 'mock';
  try { await assert.rejects(otp.sendEmailOtp('mock@example.com'), { statusCode: 503 }); } finally { env.EMAIL_OTP_PROVIDER = 'smtp'; }
});
test('Twilio Verify checks provider approval and MSG91 sends auth in headers with a timeout', async () => {
  Object.assign(env, { OTP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC_test', TWILIO_AUTH_TOKEN: 'isolated', TWILIO_VERIFY_SID: 'VA_test' });
  global.fetch = async (url, init) => {
    assert.ok(init.signal); assert.match(init.headers.Authorization, /^Basic /);
    if (url.endsWith('/Verifications')) { assert.equal(init.body.get('To'), '+919876543210'); return { ok: true, json: async () => ({ status: 'pending', sid: 'VE_test' }) }; }
    assert.equal(init.body.get('VerificationSid'), 'VE_test');
    return { ok: true, json: async () => ({ status: init.body.get('Code') === '123456' ? 'approved' : 'pending' }) };
  };
  await otp.sendOtp('919876543210');
  await assert.rejects(otp.verifyOtp('+919876543210', '000000'), { statusCode: 400 });
  await otp.verifyOtp('+919876543210', '123456');
  Object.assign(env, { OTP_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'isolated-auth', MSG91_TEMPLATE_ID: 'isolated-template' });
  let sentCode;
  global.fetch = async (url, init) => { assert.ok(init.signal); assert.equal(init.headers.authkey, env.MSG91_AUTH_KEY); assert.ok(!url.includes(env.MSG91_AUTH_KEY)); sentCode = new URL(url).searchParams.get('otp'); return { ok: true, json: async () => ({ type: 'success' }) }; };
  await otp.sendOtp('+919876543211'); await otp.verifyOtp('+919876543211', sentCode);
  global.fetch = async () => { throw new Error('Unexpected provider network call'); };
});
test('missing keys and zero-value orders fail before contacting Razorpay', async () => {
  const saved = env.RAZORPAY_WEBHOOK_SECRET; env.RAZORPAY_WEBHOOK_SECRET = '';
  try { await assert.rejects(checkout(), { statusCode: 503 }); assert.equal(billing.verifyWebhookSignature(Buffer.from('{}'), '0'.repeat(64)), false); } finally { env.RAZORPAY_WEBHOOK_SECRET = saved; }
  const free = await Plan.create({ name: 'Free', slug: 'free', price: 0, durationDays: 120 });
  const count = ordersCreated; await assert.rejects(billing.createCheckoutOrder(oid(), free._id), { statusCode: 400 }); assert.equal(ordersCreated, count);
});
test('concurrent captures activate once and increment the coupon once with snapshotted plan duration', async () => {
  const coupon = await Coupon.create({ code: 'ONCE', type: 'flat', value: 9, validFrom: new Date(0), validTo: new Date(Date.now() + 86400000) });
  const payment = await checkout(oid(), coupon.code);
  await Plan.updateOne({ _id: plan._id }, { $set: { durationDays: 1 } });
  await Promise.all(Array.from({ length: 5 }, () => billing.handleWebhook(event(payment))));
  const subscriptions = await Subscription.find({ userId: payment.userId });
  assert.equal(subscriptions.length, 1); assert.equal(subscriptions[0].expiryDate - subscriptions[0].startDate, 120 * 86400000);
  assert.equal((await Coupon.findById(coupon._id)).timesUsed, 1);
  assert.equal((await Payment.findById(payment._id)).fulfillmentStatus, 'fulfilled');
  await Plan.updateOne({ _id: plan._id }, { $set: { durationDays: 120 } });
});
test('an activation failure rolls back paid status, and webhook retry recovers', async () => {
  const payment = await checkout(); const create = Subscription.create;
  Subscription.create = async () => { throw new Error('Injected database failure'); };
  try { await assert.rejects(billing.handleWebhook(event(payment)), /Injected/); } finally { Subscription.create = create; }
  assert.equal((await Payment.findById(payment._id)).status, 'created');
  await billing.handleWebhook(event(payment));
  assert.equal(await Subscription.countDocuments({ userId: payment.userId }), 1);
});
test('amount/currency mismatches and failed attempts never grant or downgrade premium', async () => {
  const payment = await checkout();
  await assert.rejects(billing.handleWebhook(event(payment, { amount: 1 })), { statusCode: 400 });
  await assert.rejects(billing.handleWebhook(event(payment, { currency: 'USD' })), { statusCode: 400 });
  assert.equal(await Subscription.countDocuments({ userId: payment.userId }), 0);
  const failure = { ...event(payment), event: 'payment.failed' }; await billing.handleWebhook(failure);
  assert.equal((await Payment.findById(payment._id)).status, 'failed');
  await billing.handleWebhook(event(payment)); await billing.handleWebhook(failure);
  assert.equal((await Payment.findById(payment._id)).status, 'paid');
});
test('checkout signature, user ownership and captured provider status are required; missed webhook recovers through status API', async () => {
  const payment = await checkout(); fetchedEntity = event(payment).payload.payment.entity;
  const input = { paymentId: payment._id, razorpay_order_id: payment.gatewayOrderId, razorpay_payment_id: fetchedEntity.id, razorpay_signature: '0'.repeat(64) };
  await assert.rejects(billing.verifyCheckout(payment.userId, input), { statusCode: 400 });
  input.razorpay_signature = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(input.razorpay_order_id + '|' + input.razorpay_payment_id).digest('hex');
  await assert.rejects(billing.verifyCheckout(oid(), input), { statusCode: 404 });
  fetchedEntity = { ...fetchedEntity, status: 'authorized', captured: false };
  assert.equal((await billing.verifyCheckout(payment.userId, input)).status, 'created');
  assert.equal(await Subscription.countDocuments({ userId: payment.userId }), 0);
  fetchedEntity = event(payment).payload.payment.entity;
  assert.equal((await billing.getPaymentStatus(payment.userId, payment._id)).fulfillmentStatus, 'fulfilled');
  assert.equal((await billing.verifyCheckout(payment.userId, input)).status, 'paid');
  assert.equal(await Subscription.countDocuments({ userId: payment.userId }), 1);
});
test('raw webhook signatures reject forged bodies and accept an authentic event', async () => {
  const request = require('supertest'); const app = require('../src/app'); const payment = await checkout();
  const body = JSON.stringify(event(payment)); const signature = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  const endpoint = '/api/v1/billing/webhook/razorpay';
  await request(app).post(endpoint).set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body + ' ').expect(400);
  await request(app).post(endpoint).set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(body).expect(200);
  assert.equal(await Subscription.countDocuments({ userId: payment.userId }), 1);
});
test('booking checkout is reused, confirmation is atomic and a reassigned slot is never overwritten by a late capture', async () => {
  const expert = await Counsellor.create({ userId: oid(), pricePerSession: 100 });
  const service = await Service.create({ name: 'Call', slug: 'isolated-call', price: 100, durationMins: 30 });
  for (const late of [false, true]) {
    const user = oid(); const slot = await Slot.create({ counsellorId: expert._id, datetime: new Date(Date.now() + (late ? 2 : 1) * 86400000), status: 'held', holdToken: 'token', heldByUserId: user, heldUntil: new Date(Date.now() + 60000) });
    const input = { slotId: slot._id, holdToken: 'token', serviceId: service._id };
    const first = await counselling.createBooking(user, input); const second = await counselling.createBooking(user, input);
    assert.equal(String(first.paymentId), String(second.paymentId));
    const payment = await Payment.findById(first.paymentId);
    if (late) await Slot.updateOne({ _id: slot._id }, { $set: { checkoutBookingId: oid(), heldByUserId: oid() } });
    await billing.handleWebhook(event(payment)); await billing.handleWebhook(event(payment));
    assert.equal((await Payment.findById(payment._id)).fulfillmentStatus, late ? 'manual_review' : 'fulfilled');
    assert.equal((await Slot.findById(slot._id)).status, late ? 'held' : 'booked');
    assert.equal((await Booking.findById(first.bookingId)).status, late ? 'pending_payment' : 'confirmed');
  }
});
