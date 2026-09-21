const express = require('express');

const router = express.Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/profile', require('../modules/profile/profile.routes'));
router.use('/colleges', require('../modules/colleges/colleges.routes'));
router.use('/courses', require('../modules/courses/courses.routes'));
router.use('/cutoffs', require('../modules/cutoffs/cutoffs.routes'));
router.use('/predict', require('../modules/predict/predict.routes'));
router.use('/billing', require('../modules/billing/billing.routes'));
router.use('/counselling', require('../modules/counselling/counselling.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/content', require('../modules/content/content.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
