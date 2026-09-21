const catchAsync = require('../../utils/catchAsync');
const service = require('./profile.service');

const getMe = catchAsync(async (req, res) => {
  const data = await service.getMyProfile(req.user.id);
  res.status(200).json({ success: true, data });
});

const updateMe = catchAsync(async (req, res) => {
  const data = await service.updateMyProfile(req.user.id, req.body);
  res.status(200).json({ success: true, data });
});

module.exports = { getMe, updateMe };
