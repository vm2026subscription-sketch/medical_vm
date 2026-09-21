const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.passwordHash', '*.accessToken', '*.refreshToken'], censor: '[REDACTED]' },
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

module.exports = logger;
