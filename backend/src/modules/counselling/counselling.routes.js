const express = require('express');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const schemas = require('./counselling.validation');
const controller = require('./counselling.controller');

const router = express.Router();

router.get('/counsellors', controller.listCounsellors);
router.get('/services', controller.listServices);
router.get('/counsellors/:id/slots', validate(schemas.listSlots), controller.listSlots);
router.post('/slots/:id/hold', requireAuth(), validate(schemas.holdSlot), controller.holdSlot);
router.post('/bookings', requireAuth(), validate(schemas.createBooking), controller.createBooking);
router.get('/bookings', requireAuth(), controller.listBookings);
router.patch('/bookings/:id/reschedule', requireAuth(), validate(schemas.reschedule), controller.reschedule);
router.post('/bookings/:id/feedback', requireAuth(), validate(schemas.feedback), controller.feedback);

module.exports = router;
