const NewsNotification = require('../../models/NewsNotification');
const NotificationEmailDelivery = require('../../models/NotificationEmailDelivery');
const User = require('../../models/User');
const brand = require('../../config/brand');
const { resolveProvider } = require('../../config/mailer');
const { scheduleNotification } = require('../../jobs/queues');

const BATCH_SIZE = 50;
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function message(notification) {
  const attachments = notification.attachments?.length
    ? `<p><strong>Downloads</strong></p><ul>${notification.attachments.map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a></li>`).join('')}</ul>`
    : '';
  return {
    subject: `${brand.name}: ${notification.title}`,
    text: `${notification.title}\n\n${notification.body}\n\nView notifications: ${brand.siteUrl}/notifications`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#18283a"><h2>${escapeHtml(notification.title)}</h2><p style="white-space:pre-line">${escapeHtml(notification.body)}</p>${attachments}<p><a href="${brand.siteUrl}/notifications">View your notifications</a></p></div>`,
  };
}

async function deliverNotificationEmailBatch({ notificationId, afterUserId } = {}) {
  const notification = await NewsNotification.findById(notificationId).lean();
  if (!notification?.emailEnabled || (notification.scheduledFor && notification.scheduledFor > new Date())) return { sent: 0, queued: false };
  if (resolveProvider() === 'mock') return { sent: 0, queued: false };

  const filter = { role: 'student', isActive: true, email: { $type: 'string', $ne: '' } };
  if (afterUserId) filter._id = { $gt: afterUserId };
  const users = await User.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).select('_id email name').lean();
  const mail = message(notification);
  let sent = 0;
  for (const user of users) {
    if (await NotificationEmailDelivery.exists({ notificationId, userId: user._id })) continue;
    const result = await require('../../config/mailer').sendMail({
      to: user.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    await NotificationEmailDelivery.create({
      notificationId,
      userId: user._id,
      status: result ? 'sent' : 'failed',
      ...(result ? {} : { error: 'Mail provider did not accept delivery' }),
    });
    if (result) sent += 1;
  }
  const hasMore = users.length === BATCH_SIZE;
  if (hasMore) await scheduleNotification({ kind: 'email-broadcast', notificationId, afterUserId: users[users.length - 1]._id.toString() }, 1000);
  return { sent, queued: hasMore };
}

module.exports = { deliverNotificationEmailBatch };
