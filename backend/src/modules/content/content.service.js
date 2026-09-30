const Blog = require('../../models/Blog');
const Faq = require('../../models/Faq');
const Download = require('../../models/Download');
const Setting = require('../../models/Setting');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

async function listBlogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { isPublished: true };
  const [data, total] = await Promise.all([
    Blog.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);
  return paginatedResponse({ data, total, page, limit });
}

async function getBlogBySlug(slug) {
  const blog = await Blog.findOne({ slug, isPublished: true }).lean();
  if (!blog) throw ApiError.notFound('Blog post not found');
  return blog;
}

async function listFaqs() {
  return Faq.find().sort({ category: 1 }).lean();
}

async function listPublicDownloads() {
  return Download.find({ userId: null }).sort({ createdAt: -1 }).lean();
}

async function getFooterSettings() {
  const setting = await Setting.findOne({ key: 'footer_settings' }).lean();
  return setting?.value || { contacts: [], links: [] };
}

module.exports = { listBlogs, getBlogBySlug, listFaqs, listPublicDownloads, getFooterSettings };
