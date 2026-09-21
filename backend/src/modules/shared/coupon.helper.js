const Coupon = require('../../models/Coupon');
const ApiError = require('../../utils/ApiError');

/**
 * applyCoupon — validates a coupon code and returns the discounted amount.
 * Does NOT increment timesUsed here; call incrementCouponUsage() only after payment succeeds,
 * so a coupon isn't consumed by an abandoned checkout.
 */
async function applyCoupon(code, baseAmount) {
  if (!code) return { amount: baseAmount, coupon: null, discount: 0 };

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.isValidNow()) {
    throw ApiError.badRequest('Coupon is invalid or expired');
  }

  const discount = coupon.type === 'flat' ? coupon.value : Math.round((baseAmount * coupon.value) / 100);
  const amount = Math.max(baseAmount - discount, 0);

  return { amount, coupon, discount };
}

async function incrementCouponUsage(couponId) {
  if (!couponId) return;
  await Coupon.findByIdAndUpdate(couponId, { $inc: { timesUsed: 1 } });
}

module.exports = { applyCoupon, incrementCouponUsage };
