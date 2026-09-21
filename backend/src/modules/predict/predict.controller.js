const catchAsync = require('../../utils/catchAsync');
const service = require('./predict.service');

const predict = catchAsync(async (req, res) => {
  const { rank, category, state, budget, courses } = req.body;
  const result = await service.generateSeatMatch({
    userId: req.user?.id || null,
    rank,
    category,
    state,
    budget,
    courseSlugs: courses,
    isPremium: !!req.isPremium,
  });
  res.status(200).json({ success: true, data: result });
});

const history = catchAsync(async (req, res) => {
  const data = await service.getHistory(req.user.id);
  res.status(200).json({ success: true, data });
});

module.exports = { predict, history };
