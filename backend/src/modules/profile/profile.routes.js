const express = require('express');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const schemas = require('./profile.validation');
const controller = require('./profile.controller');

const router = express.Router();

router.get('/me', requireAuth(), controller.getMe);
router.put('/me', requireAuth(), validate(schemas.updateProfile), controller.updateMe);

module.exports = router;
