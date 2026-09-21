const Razorpay = require('razorpay');
const env = require('./env');

// If keys are not set, checkout reports a configuration error; no simulated order is created.
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});
razorpay.api.rq.defaults.timeout = 12000;

module.exports = razorpay;
