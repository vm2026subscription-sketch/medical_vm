const { z } = require('zod');

const checkout = {
  body: z.object({
    planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan id'),
    couponCode: z.string().optional(),
  }),
};

const paymentId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid payment id');
const verify = { body: z.object({ paymentId, razorpay_order_id: z.string().max(100), razorpay_payment_id: z.string().max(100), razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i) }) };
const status = { params: z.object({ id: paymentId }) };
module.exports = { checkout, verify, status };
