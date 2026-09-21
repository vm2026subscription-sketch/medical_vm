const express = require('express');
const request = require('supertest');
jest.mock('../src/middlewares/auth', () => ({ requireAuth: () => (req, res, next) => {
  if (!req.headers['x-test-role']) return res.status(401).json({ message: 'Login required' });
  req.user = { id: '507f1f77bcf86cd799439011', role: req.headers['x-test-role'] }; next();
} }));
jest.mock('../src/models/AdminUser', () => ({ findOne: () => ({ populate: async () => ({ roleId: { name: 'data_editor', permissions: ['colleges:write', 'colleges:import'] } }) }) }));
jest.mock('../src/modules/admin/admin.controller', () => new Proxy({}, { get: () => (req, res) => res.json({ success: true }) }));
jest.mock('../src/modules/admin/audit.helper', () => ({ recordAudit: jest.fn() }));
const College = require('../src/models/College');
const app = express();
app.use(express.json());
app.use('/admin', require('../src/modules/admin/admin.routes'));
app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));

test('unauthenticated users cannot access the admin catalog', async () => {
  expect((await request(app).get('/admin/catalog/colleges')).status).toBe(401);
});
test('students cannot access the admin session or catalog', async () => {
  expect((await request(app).get('/admin/session').set('x-test-role', 'student')).status).toBe(403);
  expect((await request(app).get('/admin/catalog/colleges').set('x-test-role', 'student')).status).toBe(403);
});
test('admin session returns assigned permissions without private configuration', async () => {
  const res = await request(app).get('/admin/session').set('x-test-role', 'admin');
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ role: 'data_editor', permissions: ['imports:write'] });
});
test('data editor cannot access financial analytics or another dataset', async () => {
  expect((await request(app).post('/admin/catalog-deletion/preview').set('x-test-role', 'admin').send({ entity: 'colleges', ids: ['507f1f77bcf86cd799439012'] })).status).toBe(403);
  expect((await request(app).post('/admin/catalog-deletion/confirm').set('x-test-role', 'admin').send({})).status).toBe(403);
  expect((await request(app).get('/admin/analytics/dashboard').set('x-test-role', 'admin')).status).toBe(403);
  expect((await request(app).get('/admin/catalog/fees').set('x-test-role', 'admin')).status).toBe(403);
});
test('legacy live mutations are blocked without a database mutation', async () => {
  const spy = jest.spyOn(College, 'findOneAndUpdate');
  const invalid = await request(app).patch('/admin/catalog/colleges/invalid').set('x-test-role', 'admin').send({ name: 'New' });
  expect(invalid.status).toBe(409);
  const unknown = await request(app).patch('/admin/catalog/colleges/507f1f77bcf86cd799439012').set('x-test-role', 'admin').send({ secretField: true });
  expect(unknown.status).toBe(409);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
