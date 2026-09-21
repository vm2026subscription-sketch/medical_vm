const NewsNotification = require('../../models/NewsNotification');
const NotificationRead = require('../../models/NotificationRead');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const visible = (userId) => ({ $and: [{ $or: [{ userId }, { userId: null }] }, { $or: [{ scheduledFor: null }, { scheduledFor: { $lte: new Date() } }] }] });

async function listForUser(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = visible(userId);
  const [data, total] = await Promise.all([
    NewsNotification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    NewsNotification.countDocuments(filter),
  ]);
  const reads = await NotificationRead.find({ userId, notificationId: { $in: [null, ...data.map((row) => row._id)] } }).lean();
  const readIds = new Set(reads.filter((row) => row.notificationId).map((row) => String(row.notificationId)));
  const through = reads.find((row) => !row.notificationId)?.readAt?.getTime() || 0;
  return paginatedResponse({ data: data.map((row) => ({ ...row, isRead: Boolean((row.userId && row.isRead) || readIds.has(String(row._id)) || Math.max(new Date(row.createdAt).getTime(), row.scheduledFor ? new Date(row.scheduledFor).getTime() : 0) <= through) })), total, page, limit });
}
async function markRead(userId, id) {
  const record = await NewsNotification.findOne({ _id: id, ...visible(userId) }).lean();
  if (!record) throw ApiError.notFound('Notification not found');
  await NotificationRead.updateOne({ userId, notificationId: id }, { $set: { readAt: new Date() } }, { upsert: true });
  return { ...record, isRead: true };
}
async function markAllRead(userId) {
  await NotificationRead.updateOne({ userId, notificationId: null }, { $set: { readAt: new Date() } }, { upsert: true });
}
module.exports = { listForUser, markRead, markAllRead };
