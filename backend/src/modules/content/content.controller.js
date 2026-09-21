const catchAsync = require('../../utils/catchAsync');
const service = require('./content.service');

const listBlogs = catchAsync(async (req, res) => {
  const result = await service.listBlogs(req.query);
  res.status(200).json({ success: true, ...result });
});

const getBlog = catchAsync(async (req, res) => {
  const data = await service.getBlogBySlug(req.params.slug);
  res.status(200).json({ success: true, data });
});

const listFaqs = catchAsync(async (req, res) => {
  const data = await service.listFaqs();
  res.status(200).json({ success: true, data });
});

const listDownloads = catchAsync(async (req, res) => {
  const data = await service.listPublicDownloads();
  res.status(200).json({ success: true, data });
});

module.exports = { listBlogs, getBlog, listFaqs, listDownloads };
