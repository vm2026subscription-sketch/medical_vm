const express = require('express');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { attachEntitlement } = require('../../middlewares/checkEntitlement');
const schemas = require('./predict.validation');
const controller = require('./predict.controller');

const router = express.Router();

// Guests can try the predictor (isPremium=false path), but a userId is needed to store
// history — require auth here since the frontend logs users in before offering AI match.
router.post('/', requireAuth(), attachEntitlement(), validate(schemas.predict), controller.predict);
router.get('/history', requireAuth(), controller.history);

module.exports = router;
