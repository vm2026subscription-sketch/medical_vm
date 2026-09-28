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
 *
 * dns.lookup is tried first because it uses the OS resolver (getaddrinfo) and therefore
 * ignores dns.setServers() from config/env. A DNS_SERVERS override can break the c-ares
 * path (resolve4) when outbound UDP 53 is blocked, which would silently push us back to
 * the hostname and reproduce the IPv6 failure.
 */
async function resolveIPv4(host) {
  try {
    const result = await dns.lookup(host, { family: 4, all: true });
    if (result.length) return { address: result[0].address, via: 'lookup' };
  } catch (error) {
    logger.warn({ host, err: error.message }, 'IPv4 dns.lookup failed');
  }
  try {
    const records = await dns.resolve4(host);
    if (records.length) return { address: records[0], via: 'resolve4' };
  } catch (error) {
    logger.warn({ host, err: error.message }, 'IPv4 resolve4 failed');
  }
  logger.error({ host }, 'No IPv4 address found, falling back to hostname (SMTP may fail without IPv6 routing)');
  return { address: host, via: 'hostname' };
}

/**
 * getMailTransporter — lazily creates a single nodemailer transporter from SMTP_* env vars.
 * Works with any SMTP provider: Gmail (with an App Password), Brevo, SendGrid, Mailgun,
 * Amazon SES SMTP, Zoho, etc. — only the host/port/user/pass change between them.
 */
async function getMailTransporter() {
  if (!transporter) {
    const host = env.SMTP_HOST;
    const { address, via } = await resolveIPv4(host);
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
    logger.info({ host, address, via }, 'SMTP transporter created');
  }
  return transporter;
}

/** Drops the cached transporter so the next attempt re-resolves DNS. */
function resetMailTransporter() {
  transporter = undefined;
}

function senderName() {
  return env.MAIL_FROM_NAME || brand.fullName;
}

/**
 * Railway blocks outbound SMTP (port 587 times out), so HTTP mail APIs are the reliable
 * option in production. These travel over port 443, which is always allowed.
 */
async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM || env.SMTP_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}

async function sendViaBrevo({ to, subject, html, text }) {
  const [name, address] = splitSender(env.BREVO_FROM || env.SMTP_FROM);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: { name, email: address }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}

/** Splits a "Display Name <addr@example.com>" string into its parts. */
function splitSender(value) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value || '');
  return match ? [match[1] || senderName(), match[2]] : [senderName(), value || env.SMTP_USER];
}

async function sendMail({ to, subject, html, text }) {
    const provider = env.EMAIL_OTP_PROVIDER;
    try {
      if (provider === 'resend' || provider === 'brevo') {
        logger.info({ to, provider }, 'Sending email via HTTP mail API');
        if (provider === 'resend') await sendViaResend({ to, subject, html, text });
        else await sendViaBrevo({ to, subject, html, text });
        logger.info({ to, provider }, 'Email sent successfully');
        return true;
      }
      const transport = await getMailTransporter();
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
      logger.error({ err: { message: err.message, code: err.code, response: err.response, responseCode: err.responseCode }, to, provider }, 'Failed to send email');
      return false;
    }
  }

module.exports = { getMailTransporter, sendMail };
