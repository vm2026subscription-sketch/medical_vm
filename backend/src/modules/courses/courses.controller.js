const catchAsync = require('../../utils/catchAsync');
const service = require('./courses.service');

const list = catchAsync(async (req, res) => {
  const data = await service.listCourses();
  res.status(200).json({ success: true, data });
});

const getBySlug = catchAsync(async (req, res) => {
  const data = await service.getCourseBySlug(req.params.slug);
  res.status(200).json({ success: true, data });
});

module.exports = { list, getBySlug };
