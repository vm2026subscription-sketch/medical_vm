const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const User = require('../src/models/User');
const Role = require('../src/models/Role');
const AdminUser = require('../src/models/AdminUser');
const Audit = require('../src/models/AuditLog');
const { prepareStorage } = require('../src/modules/admin/importStorage');
const { signAccessToken } = require('../src/utils/jwt');
const { requireAuth } = require('../src/middlewares/auth');
const { requireAdmin } = require('../src/middlewares/rbac');
const app = express(); app.use(express.json());
app.use(requireAuth(), requireAdmin(), require('../src/modules/admin/team.routes'));
app.get('/session', (req, res) => res.json({ role: req.adminRole.name }));
app.use((err, _req, res, _next) => res.status(err.statusCode || 500).json({ message: err.message }));
let server, owner, other, student, editor, inactive, fullRole;
const token = (user) => `Bearer ${signAccessToken({ sub: String(user._id), role: user.role })}`;
before(async () => {
  server = await MongoMemoryReplSet.create({ binary: { downloadDir: require('path').resolve(__dirname, '../.cache/mongodb') }, replSet: { count: 1 } });
  await mongoose.connect(server.getUri('admin-access-isolated'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  await prepareStorage();
});
after(async () => { await mongoose.disconnect(); if (server) await server.stop(); });
beforeEach(async () => {
  for (const model of [User, Role, AdminUser, Audit]) await model.deleteMany({});
  [owner, other, student, editor, inactive] = await User.create([
    { name: 'Owner', email: 'owner@example.com', role: 'admin' },
    { name: 'Other', email: 'other@example.com', role: 'admin' },
    { name: 'Student', email: 'student@example.com', phone: '+919876543210' },
    { name: 'Editor', email: 'editor@example.com', role: 'admin' },
    { name: 'Inactive', email: 'inactive@example.com', isActive: false },
  ]);
  fullRole = await Role.create({ name: 'super_admin', permissions: ['*'] });
  const editorRole = await Role.create({ name: 'data_editor', permissions: ['imports:write', 'roles:manage'] });
  await AdminUser.create([{ userId: owner._id, roleId: fullRole._id }, { userId: other._id, roleId: fullRole._id }, { userId: editor._id, roleId: editorRole._id }]);
});
test('grant by registered email or phone, audit, and immediate revoke with an existing token', async () => {
  const existingToken = token(student);
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: ' STUDENT@EXAMPLE.COM ' }).expect(200);
  await request(app).get('/session').set('Authorization', existingToken).expect(200, { role: 'super_admin' });
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: '91 98765 43210' }).expect(200);
  assert.equal(await AdminUser.countDocuments({ userId: student._id }), 1);
  await request(app).delete(`/admin-access/${student._id}`).set('Authorization', token(owner)).expect(200);
  await request(app).get('/session').set('Authorization', existingToken).expect(403);
  const saved = await User.findById(student._id);
  assert.equal(saved.role, 'student'); assert.equal(saved.isActive, true); assert.equal(saved.email, student.email);
  assert.equal(await AdminUser.countDocuments({ userId: student._id }), 0);
  const audit = await Audit.findOne({ action: 'revoke_admin_access', entityId: student._id });
  assert.equal(audit.before.adminRole, 'super_admin'); assert.equal(audit.after.role, 'student');
});
test('reject unauthenticated callers, students, editors, self changes, inactive and missing users', async () => {
  await request(app).get('/admin-access').expect(401);
  for (const user of [student, editor]) {
    await request(app).get('/admin-access').set('Authorization', token(user)).expect(403);
    await request(app).post('/admin-access').set('Authorization', token(user)).send({ identifier: student.email }).expect(403);
    await request(app).delete(`/admin-access/${other._id}`).set('Authorization', token(user)).expect(403);
  }
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: owner.email }).expect(400);
  await request(app).delete(`/admin-access/${owner._id}`).set('Authorization', token(owner)).expect(400);
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: inactive.email }).expect(400);
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: 'missing@example.com' }).expect(404);
  await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: { $ne: null } }).expect(400);
  await request(app).delete('/admin-access/invalid').set('Authorization', token(owner)).expect(400);
});
test('simultaneous cross-removal leaves one active full administrator', async () => {
  const responses = await Promise.all([
    request(app).delete(`/admin-access/${other._id}`).set('Authorization', token(owner)),
    request(app).delete(`/admin-access/${owner._id}`).set('Authorization', token(other)),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 403]);
  assert.equal(await AdminUser.countDocuments({ roleId: fullRole._id }), 1);
});
test('audit failure rolls back both user role and admin assignment', async () => {
  const original = Audit.create;
  Audit.create = async () => { throw new Error('Audit unavailable'); };
  try { await request(app).post('/admin-access').set('Authorization', token(owner)).send({ identifier: student.email }).expect(500); }
  finally { Audit.create = original; }
  assert.equal((await User.findById(student._id)).role, 'student');
  assert.equal(await AdminUser.countDocuments({ userId: student._id }), 0);
});
