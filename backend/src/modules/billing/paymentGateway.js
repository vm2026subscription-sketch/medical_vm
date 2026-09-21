const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
function assertConfigured() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET || /placeholder|xxxxx/i.test(env.RAZORPAY_KEY_ID + env.RAZORPAY_KEY_SECRET + env.RAZORPAY_WEBHOOK_SECRET)) {
    throw new ApiError(503, 'Payments are not configured yet. Please try again later.');
  }
}
function toPaise(amount) {
  const paise = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(paise) || paise < 100) throw ApiError.badRequest('The payable amount must be at least INR 1. Check the plan or coupon.');
  return paise;
}
module.exports = { assertConfigured, toPaise };
