import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Claim } from '../src/models/Claim.js';
import { Report, publicReport } from '../src/models/Report.js';
import { authorize } from '../src/middleware/auth.js';
import { registerSchema } from '../src/routes/auth.routes.js';
import { tokenOptions } from '../src/services/auth.service.js';

const origin = 'http://localhost:5173';
const env = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-only-not-for-production-1234567890', CLIENT_ORIGIN: origin });
const options = { logRequests: false };
const app = createApp(env, options);
const mutation = (agent, method, path) => agent[method](path).set('Origin', origin).set('X-Requested-With', 'ClaimBack');
let database;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  for (const model of [User, Claim, Report]) {
    await model.createCollection();
    await model.createIndexes();
  }
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await database?.stop(); });

describe('API foundation and failure behavior', () => {
  it('returns liveness, readiness, security headers and a request ID', async () => {
    const result = await request(app).get('/api/v1/health').expect(200);
    assert.equal(result.body.data.database, 'connected');
    assert.ok(result.headers['x-request-id']);
    assert.ok(result.headers['x-content-type-options']);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-powered-by'], undefined);
    await request(app).get('/api/v1/health/ready').expect(200);
  });
  it('stays live but returns 503 for data access when Mongo is unavailable', async () => {
    const offline = createApp(env, { ...options, getDatabaseStatus: () => 'disconnected' });
    await request(offline).get('/api/v1/health').expect(200);
    await request(offline).get('/api/v1/health/ready').expect(503);
    const result = await mutation(request(offline), 'post', '/api/v1/auth/register').send({}).expect(503);
    assert.equal(result.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(result.body.error.requestId);
    assert.equal(result.body.error.stack, undefined);
  });
  it('returns a consistent 404 error', async () => {
    const result = await request(app).get('/api/v1/does-not-exist').expect(404);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, 'NOT_FOUND');
  });
  it('rejects untrusted origins, absent origins, and missing mutation headers', async () => {
    await request(app).get('/api/v1/health').set('Origin', 'https://attacker.example').expect(403);
    await request(app).post('/api/v1/auth/login').send({}).expect(403);
    await request(app).post('/api/v1/auth/login').set('Origin', origin).send({}).expect(403);
    await request(app).post('/api/v1/auth/login').set('Origin', 'https://attacker.example').set('X-Requested-With', 'ClaimBack').send({}).expect(403);
  });
  it('allows explicit credentialed CORS preflight without reflecting arbitrary origins', async () => {
    const result = await request(app).options('/api/v1/auth/login').set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Content-Type,X-Requested-With').expect(204);
    assert.equal(result.headers['access-control-allow-origin'], origin);
    assert.equal(result.headers['access-control-allow-credentials'], 'true');
  });
  it('rejects malformed JSON, oversized bodies, and non-JSON input', async () => {
    const broken = await mutation(request(app), 'post', '/api/v1/auth/login').set('Content-Type', 'application/json').send('{broken').expect(400);
    assert.equal(broken.body.error.code, 'INVALID_JSON');
    await mutation(request(app), 'post', '/api/v1/auth/login').send({ password: 'x'.repeat(40000) }).expect(413);
    await mutation(request(app), 'post', '/api/v1/auth/login').type('form').send({ email: 'a@example.com' }).expect(415);
  });
});

describe('identity and authorization', () => {
  const profile = { name: 'Alex Morgan', email: 'Alex@Example.com', password: 'a secure long password' };
  let agent;
  let cookie;
  let userId;
  it('registers with a hashed password and an HTTP-only JWT cookie', async () => {
    agent = request.agent(app);
    const result = await mutation(agent, 'post', '/api/v1/auth/register').send(profile).expect(201);
    userId = result.body.data.user.id;
    assert.equal(result.body.data.user.email, 'alex@example.com');
    assert.equal(result.body.data.user.role, 'user');
    assert.equal(result.body.data.user.passwordHash, undefined);
    cookie = result.headers['set-cookie'][0].split(';')[0];
    assert.match(result.headers['set-cookie'][0], /HttpOnly/);
    assert.match(result.headers['set-cookie'][0], /SameSite=Lax/);
    assert.match(result.headers['set-cookie'][0], /Path=\/api\/v1/);
    const stored = await User.findById(userId).select('+passwordHash');
    assert.notEqual(stored.passwordHash, profile.password);
    assert.equal(await bcrypt.compare(profile.password, stored.passwordHash), true);
  });
  it('rejects duplicate emails regardless of case', async () => {
    await mutation(request(app), 'post', '/api/v1/auth/register').send({ ...profile, email: 'alex@example.com' }).expect(409);
  });
  it('rejects mass assignment and unsafe inputs', async () => {
    await mutation(request(app), 'post', '/api/v1/auth/register').send({ ...profile, email: 'new@example.com', role: 'admin' }).expect(400);
    await mutation(request(app), 'post', '/api/v1/auth/login').send({ email: { $ne: null }, password: 'test' }).expect(400);
    const result = await mutation(request(app), 'post', '/api/v1/auth/register').send({ name: 'A', email: 'bad', password: 'short' }).expect(400);
    assert.ok(result.body.error.details.some((detail) => detail.field === 'password'));
  });
  it('loads only safe session fields and allows name changes', async () => {
    const current = await agent.get('/api/v1/auth/me').expect(200);
    assert.equal(current.body.data.user.id, userId);
    assert.equal(current.body.data.user.tokenVersion, undefined);
    const updated = await mutation(agent, 'patch', '/api/v1/users/me').send({ name: 'Alex Updated' }).expect(200);
    assert.equal(updated.body.data.user.name, 'Alex Updated');
    await mutation(agent, 'patch', '/api/v1/users/me').send({ name: 'Admin', role: 'admin' }).expect(400);
    assert.equal((await User.findById(userId)).role, 'user');
  });
  it('rejects unsigned, expired, or wrong-audience tokens and missing sessions', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', 'claimback_session=not-a-token').expect(401);
    for (const overrides of [{ expiresIn: -10 }, { audience: 'other-app', expiresIn: '1h' }]) {
      const token = jwt.sign({ version: 0 }, env.JWT_SECRET, { ...tokenOptions, subject: userId, ...overrides });
      await request(app).get('/api/v1/auth/me').set('Cookie', `claimback_session=${token}`).expect(401);
    }
  });
  it('does not reveal whether a failed login email exists', async () => {
    const known = await mutation(request(app), 'post', '/api/v1/auth/login').send({ email: profile.email, password: 'wrong password' }).expect(401);
    const unknown = await mutation(request(app), 'post', '/api/v1/auth/login').send({ email: 'absent@example.com', password: 'wrong password' }).expect(401);
    assert.equal(known.body.error.message, unknown.body.error.message);
  });
  it('logs in, and logout invalidates even a copied session token', async () => {
    const login = await mutation(agent, 'post', '/api/v1/auth/login').send({ email: profile.email, password: profile.password }).expect(200);
    assert.equal(login.body.data.user.id, userId);
    await mutation(agent, 'post', '/api/v1/auth/logout').send({}).expect(200);
    await agent.get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  });
  it('suspended users cannot sign in or use pre-existing sessions', async () => {
    await mutation(agent, 'post', '/api/v1/auth/login').send({ email: profile.email, password: profile.password }).expect(200);
    await User.updateOne({ _id: userId }, { status: 'suspended' });
    await agent.get('/api/v1/auth/me').expect(401);
    await mutation(request(app), 'post', '/api/v1/auth/login').send({ email: profile.email, password: profile.password }).expect(401);
  });
  it('rate limits repeated login attempts with the JSON error contract', async () => {
    const limitedApp = createApp(env, options);
    for (let attempt = 0; attempt < 20; attempt += 1) await mutation(request(limitedApp), 'post', '/api/v1/auth/login').send({}).expect(400);
    const result = await mutation(request(limitedApp), 'post', '/api/v1/auth/login').send({}).expect(429);
    assert.equal(result.body.error.code, 'RATE_LIMITED');
    assert.ok(result.headers['retry-after']);
  });
  it('restricts admin authorization and rejects anonymous use', () => {
    for (const user of [undefined, { role: 'user' }]) {
      authorize('admin')({ user }, {}, (error) => assert.equal(error.status, 403));
    }
    authorize('admin')({ user: { role: 'admin' } }, {}, (error) => assert.equal(error, undefined));
  });
});

describe('configuration and persistence boundaries', () => {
  it('fails closed for missing production secrets and insecure origins', () => {
    assert.throws(() => parseEnv({ NODE_ENV: 'production' }), /HTTPS|Production/);
    assert.throws(() => parseEnv({ JWT_SECRET: 'short' }), /32 bytes/);
    assert.throws(() => parseEnv({ CLIENT_ORIGIN: '*' }), /origins/);
    assert.throws(() => parseEnv({ MONGODB_URI: 'https://example.com' }), /MongoDB/);
    assert.throws(() => parseEnv({ COOKIE_CROSS_SITE: 'true' }), /HTTPS/);
    const valid = parseEnv({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://app.example.com', JWT_SECRET: 'x'.repeat(48), MONGODB_URI: 'mongodb://localhost/test' });
    assert.equal(valid.production, true);
    assert.equal(valid.ephemeralSecret, false);
  });
  it('rejects passwords that would be truncated by bcrypt', () => {
    assert.equal(registerSchema.safeParse({ name: 'Test User', email: 'valid@example.com', password: '🔐'.repeat(20) }).success, false);
  });
  it('keeps private claim evidence out of default queries and enforces exclusive approval', async () => {
    const report = new mongoose.Types.ObjectId();
    const claim = await Claim.create({ report, claimant: new mongoose.Types.ObjectId(), privateEvidence: 'Serial number and a private identifying mark.', status: 'approved' });
    assert.equal((await Claim.findById(claim._id)).privateEvidence, undefined);
    assert.ok((await Claim.findById(claim._id).select('+privateEvidence')).privateEvidence);
    await assert.rejects(Claim.create({ report, claimant: new mongoose.Types.ObjectId(), privateEvidence: 'Another private identifying ownership detail.', status: 'approved' }), (error) => error.code === 11000);
    const pending = await Claim.create({ report, claimant: new mongoose.Types.ObjectId(), privateEvidence: 'Another pending claim for the same found item.', status: 'pending' });
    assert.equal(pending.status, 'pending');
  });
  it('public report projection excludes owner identifiers and upload IDs', () => {
    const report = new Report({ owner: new mongoose.Types.ObjectId(), type: 'found', title: 'Canvas bag', description: 'A green canvas bag', category: 'bags', location: 'Library', occurredAt: new Date(), images: [{ url: 'https://example.com/bag.jpg', publicId: 'private-provider-id' }] });
    const result = publicReport(report);
    assert.equal(result.owner, undefined);
    assert.equal(result.images[0].publicId, undefined);
    assert.equal(result.images[0].url, 'https://example.com/bag.jpg');
  });
});
