const catchAsync = require('../../utils/catchAsync');
const service = require('./cutoffs.service');

const list = catchAsync(async (req, res) => {
  const result = await service.listCutoffs(req.query, req.isPremium);
  res.status(200).json({ success: true, isPremium: req.isPremium, ...result });
});

module.exports = { list };
