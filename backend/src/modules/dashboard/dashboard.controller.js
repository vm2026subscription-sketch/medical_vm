const catchAsync = require('../../utils/catchAsync');
const service = require('./dashboard.service');

const overview = catchAsync(async (req, res) => {
  const data = await service.getOverview(req.user.id);
  res.status(200).json({ success: true, data });
});

module.exports = { overview };
