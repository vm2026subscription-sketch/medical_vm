const catchAsync = require('../../utils/catchAsync');
const service = require('./notifications.service');

const list = catchAsync(async (req, res) => {
  const result = await service.listForUser(req.user.id, req.query);
  res.status(200).json({ success: true, ...result });
});

const markRead = catchAsync(async (req, res) => {
  const data = await service.markRead(req.user.id, req.params.id);
  res.status(200).json({ success: true, data });
});

const markAllRead = catchAsync(async (req, res) => {
  await service.markAllRead(req.user.id);
  res.status(200).json({ success: true });
});

module.exports = { list, markRead, markAllRead };
