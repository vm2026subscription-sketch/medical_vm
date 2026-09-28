const nodemailer = require('nodemailer');
const dns = require('node:dns').promises;
const env = require('./env');
const logger = require('../utils/logger');
const brand = require('./brand');

let transporter;

/**
 * resolveIPv4 — smtp.gmail.com (and other mail hosts) publish AAAA records, but Railway
 * has no IPv6 route, so the IPv6 attempt fails with ENETUNREACH before IPv4 is ever tried.
 * Nodemailer forwards no family/lookup option to the socket, so the address is resolved
 * here and the original hostname is preserved separately for TLS SNI verification.
 */
async function resolveIPv4(host) {
  try {
    const result = await dns.resolve4(host);
    return result[0] || host;
  } catch (error) {
    logger.warn({ host, err: error.message }, 'IPv4 lookup failed, falling back to hostname');
    return host;
  }
}

/**
 * getMailTransporter — lazily creates a single nodemailer transporter from SMTP_* env vars.
 * Works with any SMTP provider: Gmail (with an App Password), Brevo, SendGrid, Mailgun,
 * Amazon SES SMTP, Zoho, etc. — only the host/port/user/pass change between them.
 */
async function getMailTransporter() {
  if (!transporter) {
    const host = env.SMTP_HOST;
    const address = await resolveIPv4(host);
    transporter = nodemailer.createTransport({
      host: address,
      // Keeps certificate/SNI validation bound to the real hostname while connecting by IP.
      servername: host,
      tls: { servername: host },
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true for port 465 (SSL), false for 587 (STARTTLS)
      requireTLS: env.SMTP_PORT !== 465,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    logger.info({ host, address }, 'SMTP transporter created');
  }
  return transporter;
}

/** Drops the cached transporter so the next attempt re-resolves DNS. */
function resetMailTransporter() {
  transporter = undefined;
}

async function sendMail({ to, subject, html, text }) {
    const transport = await getMailTransporter();
    try {
      logger.info({ to, host: env.SMTP_HOST, port: env.SMTP_PORT }, 'Sending email via SMTP');
      await transport.sendMail({
        from: env.SMTP_FROM || { name: brand.fullName, address: env.SMTP_USER },
        to,
        subject,
        html,
        text,
      });
      logger.info({ to }, 'Email sent successfully');
      return true;
    } catch (err) {
      // A cached IP can go stale, so drop the transporter and let the next call re-resolve.
      resetMailTransporter();
      logger.error({ err: { message: err.message, code: err.code, response: err.response, responseCode: err.responseCode }, to }, 'Failed to send email');
      return false;
    }
  }

module.exports = { getMailTransporter, sendMail };
