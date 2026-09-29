jest.mock('../src/utils/logger', () => require('pino')({ level: 'silent' }));

jest.mock('../src/config/env', () => ({
  ...jest.requireActual('../src/config/env'),
  BREVO_API_KEY: 'test-brevo-key',
  RESEND_API_KEY: 'test-resend-key',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  APP_URL: 'https://example.test',
}));

const mockSendMail = jest.fn();
jest.mock('../src/config/mailer', () => ({
  sendMail: (...args) => mockSendMail(...args),
  resolveProvider: () => process.env.TEST_EMAIL_PROVIDER || 'mock',
  providerReady: () => true,
}));

jest.mock('../src/models/OtpChallenge', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
}));

const Challenge = require('../src/models/OtpChallenge');
const { sendEmailOtp } = require('../src/modules/auth/otpProvider');
const brand = require('../src/config/brand');

beforeEach(() => {
  mockSendMail.mockReset().mockResolvedValue(true);
  Challenge.findOneAndUpdate.mockReset().mockResolvedValue({ _id: 'challenge-id', version: 'v1' });
  Challenge.updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 });
});

test('every email provider actually hands the message to the mailer', async () => {
  for (const provider of ['smtp', 'brevo', 'resend']) {
    process.env.TEST_EMAIL_PROVIDER = provider;
    await sendEmailOtp('learner@example.com');
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'learner@example.com' }));
    mockSendMail.mockClear();
  }
});

test('the login code and a live app URL are present in the email body', async () => {
  process.env.TEST_EMAIL_PROVIDER = 'brevo';
  await expect(sendEmailOtp('learner@example.com')).resolves.toEqual({ sent: true });
  const [payload] = mockSendMail.mock.calls[0];
  expect(payload.subject).toMatch(/login code/i);
  expect(payload.html).toMatch(/\d{6}/);
  expect(payload.html).toContain(brand.siteUrl);
  expect(brand.siteUrl).toMatch(/^https?:\/\//);
});

test('a failed delivery is reported instead of being reported as sent', async () => {
  process.env.TEST_EMAIL_PROVIDER = 'brevo';
  mockSendMail.mockResolvedValue(false);
  await expect(sendEmailOtp('learner@example.com')).rejects.toMatchObject({ statusCode: 503 });
  expect(Challenge.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: { state: 'failed' } }));
});
