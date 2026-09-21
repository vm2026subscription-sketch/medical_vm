const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const controller = require('./notifications.controller');

const router = express.Router();

router.get('/', requireAuth(), controller.list);
router.patch('/:id/read', requireAuth(), controller.markRead);
router.patch('/read-all', requireAuth(), controller.markAllRead);

module.exports = router;
