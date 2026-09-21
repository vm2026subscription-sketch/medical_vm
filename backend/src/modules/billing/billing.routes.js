const express = require('express');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const schemas = require('./billing.validation');
const controller = require('./billing.controller');

const router = express.Router();
const paymentLimiter = require('express-rate-limit')({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get('/plans', controller.listPlans);
router.post('/checkout', requireAuth(), validate(schemas.checkout), controller.checkout);
router.post('/verify', requireAuth(), paymentLimiter, validate(schemas.verify), controller.verify);
router.get('/payments/:id', requireAuth(), paymentLimiter, validate(schemas.status), controller.status);
// NOTE: /webhook/razorpay is intentionally NOT registered here. It's mounted directly in
// app.js with express.raw() BEFORE the global express.json() parser, because Razorpay's
// webhook signature must be verified against the exact raw request bytes. Registering it
// again on this router would only add a dead, unreachable duplicate route.
router.get('/invoices', requireAuth(), controller.invoices);

module.exports = router;
