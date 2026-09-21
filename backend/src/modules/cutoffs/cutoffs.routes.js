const express = require('express');
const validate = require('../../middlewares/validate');
const { optionalAuth } = require('../../middlewares/auth');
const { attachEntitlement } = require('../../middlewares/checkEntitlement');
const schemas = require('./cutoffs.validation');
const controller = require('./cutoffs.controller');

const router = express.Router();
router.get('/categories', require('../../utils/catchAsync')(async (_req, res) => {
  res.json({ success: true, data: await require('../../utils/categoryCodes').listCategoryCodes() });
}));

// optionalAuth + attachEntitlement is the pattern reused on every gated route:
// guests and free users get req.isPremium = false, active subscribers get true.
router.get('/', optionalAuth(), attachEntitlement(), validate(schemas.listCutoffs), controller.list);

module.exports = router;
