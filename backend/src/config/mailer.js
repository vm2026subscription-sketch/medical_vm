const nodemailer = require('nodemailer');
const env = require('./env');
const logger = require('../utils/logger');
const brand = require('./brand');

let transporter;

/**
 * getMailTransporter — lazily creates a single nodemailer transporter from SMTP_* env vars.
 * Works with any SMTP provider: Gmail (with an App Password), Brevo, SendGrid, Mailgun,
 * Amazon SES SMTP, Zoho, etc. — only the host/port/user/pass change between them.
 */
function getMailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
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
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
    const transport = getMailTransporter();
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
      logger.error({ err: { message: err.message, code: err.code, response: err.response, responseCode: err.responseCode }, to }, 'Failed to send email');
      return false;
    }
  }

module.exports = { getMailTransporter, sendMail };
