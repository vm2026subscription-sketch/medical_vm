const catchAsync = require('../../utils/catchAsync');
const service = require('./billing.service');
const logger = require('../../utils/logger');

const listPlans = catchAsync(async (req, res) => {
  const data = await service.listPlans();
  res.status(200).json({ success: true, data });
});

const checkout = catchAsync(async (req, res) => {
  const { planId, couponCode } = req.body;
  const data = await service.createCheckoutOrder(req.user.id, planId, couponCode);
  res.status(200).json({ success: true, data });
});

// IMPORTANT: this route must receive the raw request body (see app.js — express.raw() is
// mounted specifically on this path) so the HMAC signature can be verified byte-for-byte.
const webhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const isValid = service.verifyWebhookSignature(req.body, signature);
  if (!isValid) {
    logger.warn('Razorpay webhook signature mismatch');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ success: false, message: 'Invalid event JSON' }); }
  await service.handleWebhook(event);
  res.status(200).json({ success: true });
});

const invoices = catchAsync(async (req, res) => {
  const data = await service.listInvoices(req.user.id);
  res.status(200).json({ success: true, data });
});

const verify = catchAsync(async (req, res) => res.json({ success: true, data: await service.verifyCheckout(req.user.id, req.body) }));
const status = catchAsync(async (req, res) => res.json({ success: true, data: await service.getPaymentStatus(req.user.id, req.params.id) }));
module.exports = { listPlans, checkout, webhook, invoices, verify, status };
