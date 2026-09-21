const catchAsync = require('../../utils/catchAsync');
const service = require('./counselling.service');

const listCounsellors = catchAsync(async (req, res) => {
  const data = await service.listCounsellors();
  res.status(200).json({ success: true, data });
});

const listServices = catchAsync(async (req, res) => {
  const data = await service.listServices();
  res.status(200).json({ success: true, data });
});

const listSlots = catchAsync(async (req, res) => {
  const data = await service.listSlotsForDate(req.params.id, req.query.date);
  res.status(200).json({ success: true, data });
});

const holdSlot = catchAsync(async (req, res) => {
  const data = await service.holdSlot(req.params.id, req.user.id);
  res.status(200).json({ success: true, data });
});

const createBooking = catchAsync(async (req, res) => {
  const data = await service.createBooking(req.user.id, req.body);
  res.status(201).json({ success: true, data });
});

const listBookings = catchAsync(async (req, res) => {
  const data = await service.listBookingsForUser(req.user.id);
  res.status(200).json({ success: true, data });
});

const reschedule = catchAsync(async (req, res) => {
  const data = await service.rescheduleBooking(req.user.id, req.params.id, req.body.newSlotId);
  res.status(200).json({ success: true, data });
});

const feedback = catchAsync(async (req, res) => {
  const data = await service.submitFeedback(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data });
});

module.exports = { listCounsellors, listServices, listSlots, holdSlot, createBooking, listBookings, reschedule, feedback };
