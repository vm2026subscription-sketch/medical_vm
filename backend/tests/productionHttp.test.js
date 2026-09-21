jest.mock('../src/utils/logger', () => require('pino')({ level: 'silent' }));
jest.mock('../src/config/env', () => ({ ...jest.requireActual('../src/config/env'), NODE_ENV: 'production' }));
const request = require('supertest');
const app = require('../src/app');

test('health is safe to expose and readiness fails when MongoDB is disconnected', async () => {
  const health = await request(app).get('/health').expect(200);
  expect(health.body).toEqual({ status: 'ok' });
  expect(health.headers['x-powered-by']).toBeUndefined();
  expect((await request(app).get('/ready').expect(503)).body).toEqual({ status: 'unavailable' });
});

test('malformed and oversized JSON return client errors without stack traces', async () => {
  const malformed = await request(app).post('/api/v1/not-a-route').set('Content-Type', 'application/json').send('{').expect(400);
  expect(JSON.stringify(malformed.body)).not.toMatch(/SyntaxError|node_modules/);
  expect(malformed.headers['cache-control']).toBe('no-store');
  await request(app).post('/api/v1/not-a-route').send({ value: 'x'.repeat(2 * 1024 * 1024) }).expect(413);
});
