const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const controller = require('./dashboard.controller');

const router = express.Router();

router.get('/overview', requireAuth(), controller.overview);

module.exports = router;
