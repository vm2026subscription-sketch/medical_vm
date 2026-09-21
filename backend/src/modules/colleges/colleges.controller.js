const catchAsync = require('../../utils/catchAsync');
const service = require('./colleges.service');

const list = catchAsync(async (req, res) => {
  const result = await service.listColleges(req.query);
  res.status(200).json({ success: true, ...result });
});

const getById = catchAsync(async (req, res) => {
  const result = await service.getCollegeDetail(req.params.id, req.isPremium);
  res.status(200).json({ success: true, data: result });
});

const save = catchAsync(async (req, res) => {
  const result = await service.saveCollege(req.user.id, req.params.id, req.body);
  res.status(200).json({ success: true, data: result });
});

const unsave = catchAsync(async (req, res) => {
  await service.unsaveCollege(req.user.id, req.params.id);
  res.status(204).send();
});

const compare = catchAsync(async (req, res) => {
  const result = await service.compareColleges(req.body.collegeIds, req.isPremium);
  res.status(200).json({ success: true, data: result });
});

module.exports = { list, getById, save, unsave, compare };
