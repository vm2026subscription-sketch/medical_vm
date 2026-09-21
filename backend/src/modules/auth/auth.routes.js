const express = require('express');
const validate = require('../../middlewares/validate');
const { otpRequestLimiter, otpVerifyLimiter } = require('../../middlewares/rateLimit');
const schemas = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/otp/request', otpRequestLimiter, validate(schemas.requestOtp), controller.requestOtp);
router.post('/otp/verify', otpVerifyLimiter, validate(schemas.verifyOtp), controller.verifyOtp);
router.post('/email-otp/request', otpRequestLimiter, validate(schemas.requestEmailOtp), controller.requestEmailOtp);
router.post('/email-otp/verify', otpVerifyLimiter, validate(schemas.verifyEmailOtp), controller.verifyEmailOtp);
router.post('/google', validate(schemas.googleAuth), controller.googleAuth);
router.post('/refresh', validate(schemas.refresh), controller.refresh);
router.post('/logout', controller.logout);

module.exports = router;
