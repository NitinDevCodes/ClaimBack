import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { tokenOptions } from '../src/services/auth.service.js';
import { createAI, attributesSchema } from '../src/services/ai.service.js';
import { createMatching } from '../src/services/matching.service.js';
import { User, Report, Claim, Match, Notification } from '../src/models/index.js';

const origin = 'http://localhost:5173';
const env = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'isolated-application-test-secret-only-123456', CLIENT_ORIGIN: origin });
const attrs = { object: 'Backpack', category: 'bags', colours: ['green'], brand: '', characteristics: ['zip pocket'], distinctiveFeatures: ['orange patch'], keywords: ['bag', 'backpack'], improvedDescription: 'Green backpack with an orange patch.' };
let uploads = 0;
const services = { ai: { analyze: async () => ({ ...attrs, status: 'complete' }), rank: async () => null }, images: { upload: async () => ({ url: 'https://example.com/synthetic.jpg', publicId: `synthetic-${++uploads}` }), remove: async () => {} } };
const app = createApp(env, { services, logRequests: false });
const actors = {};
let database, image, foundId, lostId;
const payload = { type: 'found', title: 'Green synthetic backpack', description: 'Green backpack with an orange patch and a zip pocket.', category: 'bags', colour: 'green', location: 'Synthetic campus library', occurredAt: '2026-10-01' };
const call = (who, method, url) => request(app)[method](`/api/v1${url}`).set('Origin', origin).set('X-Requested-With', 'ClaimBack').set('Cookie', who ? actors[who].cookie : '');
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri('claimback_synthetic_test'));
  for (const model of [User, Report, Claim, Match, Notification]) { await model.createCollection(); await model.createIndexes(); }
  for (const role of ['finder', 'owner', 'stranger', 'admin']) {
    const user = await User.create({ name: `Synthetic ${role}`, email: `${role}@example.test`, passwordHash: 'not-used-in-token-tests', role: role === 'admin' ? 'admin' : 'user' });
    actors[role] = { user, cookie: `claimback_session=${jwt.sign({ version: 0 }, env.JWT_SECRET, { ...tokenOptions, subject: String(user._id), expiresIn: '1h' })}` };
  }
  image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#357045' } }).png().toBuffer();
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await database?.stop(); });

it('creates reports with decoded uploads and public serialization; no owner/provider IDs', async () => {
  let upload = call('finder', 'post', '/reports');
  for (const [key, value] of Object.entries(payload)) upload = upload.field(key, value);
  const response = await upload.attach('images', image, { filename: 'synthetic.png', contentType: 'image/png' }).expect(201);
  foundId = response.body.data.report.id;
  assert.equal(response.body.data.report.analysis.object, 'Backpack');
  assert.equal(response.body.data.report.owner, undefined);
  assert.equal(response.body.data.report.images[0].publicId, undefined);
  const lost = await call('owner', 'post', '/reports').send({ ...payload, type: 'lost' }).expect(201);
  lostId = lost.body.data.report.id;
  assert.equal(lost.body.data.matches[0].report.id, foundId);
  assert.equal(lost.body.data.matches[0].method, 'fallback');
  assert.ok(lost.body.data.matches[0].score > 70);
});
it('validates browse filters, identity, dates and malicious uploads', async () => {
  await call(null, 'post', '/reports').send(payload).expect(401);
  await call('owner', 'post', '/reports').send({ ...payload, owner: actors.admin.user.id }).expect(400);
  await call('owner', 'post', '/reports').send({ ...payload, occurredAt: '9999-01-01' }).expect(400);
  let upload = call('owner', 'post', '/reports');
  for (const [key, value] of Object.entries(payload)) upload = upload.field(key, value);
  await upload.attach('images', Buffer.from('<svg>not-an-image</svg>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  const result = await call(null, 'get', '/reports?type=found&category=bags&location=library&q=backpack').expect(200);
  assert.equal(result.body.data.total, 1);
  assert.equal((await call('owner', 'get', '/reports/mine?type=found').expect(200)).body.data.total, 0);
  assert.equal((await call('owner', 'get', '/reports/mine?type=lost').expect(200)).body.data.total, 1);
  await call(null, 'get', '/reports?category=invalid').expect(400);
  await call(null, 'get', '/reports/invalid-id').expect(400);
});
it('enforces owner-only edits, optimistic revision checks and correctable AI attributes', async () => {
  await call('stranger', 'patch', `/reports/${foundId}`).send({ revision: 0, title: 'Stolen edit' }).expect(404);
  await call('finder', 'patch', `/reports/${foundId}`).send({ revision: 0, title: 'Green synthetic library backpack' }).expect(200);
  assert.equal((await Report.findById(foundId)).colour, 'green', 'partial updates must not reset an omitted colour to its create default');
  await call('finder', 'patch', `/reports/${foundId}`).send({ revision: 0, title: 'Stale edit' }).expect(409);
  const corrected = await call('finder', 'patch', `/reports/${foundId}/attributes`).send({ revision: 1, attributes: { ...attrs, brand: 'Unknown' } }).expect(200);
  assert.equal(corrected.body.data.analysis.status, 'corrected');
});
it('rejects invalid AI JSON and candidate IDs without exposing provider errors', async () => {
  const ai = createAI({ GEMINI_API_KEY: 'synthetic', GEMINI_MODEL: 'synthetic' }, { models: { generateContent: async () => ({ text: '{"secret":"bad output"}' }) } });
  assert.deepEqual(await ai.analyze(payload, [image]), { status: 'unavailable' });
  assert.equal(await ai.rank(payload, [{ ...payload, _id: foundId }]), null);
  assert.equal(attributesSchema.safeParse({ ...attrs, admin: true }).success, false);
});
it('supports text reports with unavailable providers and fails image upload honestly', async () => {
  const unavailable = createApp(env, { logRequests: false });
  const send = () => request(unavailable).post('/api/v1/reports').set('Origin', origin).set('X-Requested-With', 'ClaimBack').set('Cookie', actors.stranger.cookie);
  const result = await send().send({ ...payload, category: 'other', title: 'Synthetic fallback item' }).expect(201);
  assert.equal(result.body.data.report.analysis.status, 'unavailable');
  let upload = send(); for (const [key, value] of Object.entries(payload)) upload = upload.field(key, value);
  await upload.attach('images', image, { filename: 'synthetic.png', contentType: 'image/png' }).expect(503);
});

let claimId, competingId;
it('records interest once and keeps recipient notifications private', async () => {
  await Report.updateOne({ _id: lostId }, { $unset: { matchesCheckedAt: 1 } });
  const response = await call('owner', 'get', `/reports/${lostId}/matches`).expect(200);
  const id = response.body.data[0].id;
  await call('stranger', 'post', `/reports/matches/${id}/interest`).send({}).expect(404);
  await call('owner', 'post', `/reports/matches/${id}/interest`).send({}).expect(200);
  await call('owner', 'post', `/reports/matches/${id}/interest`).send({}).expect(200);
  const notices = await Notification.find({ recipient: actors.finder.user._id, kind: 'interest' });
  assert.equal(notices.length, 1);
  await call('stranger', 'patch', `/notifications/${notices[0].id}/read`).send({}).expect(404);
  await call('finder', 'patch', `/notifications/${notices[0].id}/read`).send({}).expect(200);
});
it('accepts private claims, restricts evidence to claimant/admin, and locks reports', async () => {
  const evidence = 'Synthetic ownership evidence: private embroidered initials inside pocket.';
  await call('finder', 'post', '/claims').send({ reportId: foundId, privateEvidence: evidence }).expect(409);
  await call('owner', 'post', '/claims').send({ reportId: lostId, privateEvidence: evidence }).expect(409);
  const result = await call('owner', 'post', '/claims').send({ reportId: foundId, lostReportId: lostId, privateEvidence: evidence }).expect(201);
  claimId = result.body.data.id;
  await call('owner', 'post', '/claims').send({ reportId: foundId, privateEvidence: evidence }).expect(409);
  competingId = (await call('stranger', 'post', '/claims').send({ reportId: foundId, privateEvidence: 'Synthetic competing private evidence for test only.' }).expect(201)).body.data.id;
  await call('finder', 'get', `/claims/${claimId}`).expect(404);
  await call('stranger', 'get', `/claims/${claimId}`).expect(404);
  const detail = await call('owner', 'get', `/claims/${claimId}`).expect(200);
  assert.equal(detail.body.data.privateEvidence, evidence);
  assert.equal(detail.body.data.contacts, undefined);
  const review = await call('admin', 'get', `/claims/${claimId}`).expect(200);
  assert.equal(review.body.data.contacts.claimant.email, 'owner@example.test');
  const list = await call('admin', 'get', '/claims?scope=review').expect(200);
  assert.ok(list.body.data.items.every((c) => c.privateEvidence === undefined));
  const report = await Report.findById(foundId);
  await call('finder', 'patch', `/reports/${foundId}`).send({ revision: report.revision, title: 'Changing claimed item' }).expect(409);
  await call('finder', 'delete', `/reports/${foundId}`).send({}).expect(409);
  await call('finder', 'patch', `/reports/${foundId}/attributes`).send({ revision: report.revision, attributes: attrs }).expect(409);
  await call('owner', 'patch', `/claims/${claimId}`).send({ action: 'approve', reason: 'Attempting self approval' }).expect(403);
});
it('serializes concurrent human approvals, rejects competitors, records handover and history', async () => {
  const results = await Promise.all([claimId, competingId].map((id) => call('admin', 'patch', `/claims/${id}`).send({ action: 'approve', reason: 'Human reviewed synthetic evidence and verified ownership.' })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = await Claim.findOne({ report: foundId, status: 'approved' });
  assert.ok(winner);
  assert.equal(await Claim.countDocuments({ report: foundId, status: 'rejected' }), 1);
  assert.equal((await Report.findById(foundId)).status, 'reserved');
  await call('admin', 'patch', `/claims/${winner.id}`).send({ action: 'handover', reason: 'Synthetic handover confirmed by both participants.' }).expect(200);
  assert.equal((await Report.findById(foundId)).status, 'recovered');
  const detail = await call('admin', 'get', `/claims/${winner.id}`).expect(200);
  assert.deepEqual(detail.body.data.history.map((h) => h.status), ['pending', 'approved', 'handed_over']);
  await call('admin', 'patch', `/claims/${winner.id}`).send({ action: 'handover', reason: 'Repeated handover request' }).expect(409);
});
it('enforces admin boundaries, moderation and revokes suspended sessions', async () => {
  await call('owner', 'get', '/admin/stats').expect(403);
  await call('admin', 'get', '/admin/stats').expect(200);
  await call('admin', 'patch', `/admin/reports/${lostId}`).send({ moderation: 'hidden', reason: 'Synthetic moderation verification.' }).expect(200);
  await call(null, 'get', `/reports/${lostId}`).expect(404);
  await call('admin', 'patch', `/admin/reports/${lostId}`).send({ moderation: 'visible', reason: 'Synthetic verification complete.' }).expect(200);
  await call('admin', 'patch', `/admin/users/${actors.admin.user.id}`).send({ status: 'suspended' }).expect(409);
  await call('admin', 'patch', `/admin/users/${actors.stranger.user.id}`).send({ status: 'suspended' }).expect(200);
  await call('stranger', 'get', '/dashboard').expect(401);
  const dashboard = await call('finder', 'get', '/dashboard').expect(200);
  assert.equal(dashboard.body.data.reports.find((r) => r._id === 'found').recovered, 1);
});

it('updates a linked lost report in the same approval and recovery transaction', async () => {
  const found = await Report.create({ ...payload, owner: actors.finder.user._id });
  const lost = await Report.create({ ...payload, type: 'lost', owner: actors.owner.user._id });
  const claim = (await call('owner', 'post', '/claims').send({ reportId: found.id, lostReportId: lost.id, privateEvidence: 'Synthetic linked recovery evidence inside the bag.' }).expect(201)).body.data;
  await call('admin', 'patch', `/claims/${claim.id}`).send({ action: 'approve', reason: 'Synthetic evidence verified independently.' }).expect(200);
  assert.equal((await Report.findById(lost.id)).status, 'reserved');
  await call('admin', 'patch', `/claims/${claim.id}`).send({ action: 'handover', reason: 'Synthetic return confirmed by both participants.' }).expect(200);
  assert.equal((await Report.findById(lost.id)).status, 'recovered');
  assert.equal((await Report.findById(found.id)).status, 'recovered');
});
it('supports withdrawal, owner deletion, and hides deleted reports from public queries', async () => {
  const report = await Report.create({ ...payload, owner: actors.finder.user._id });
  const claim = (await call('owner', 'post', '/claims').send({ reportId: report.id, privateEvidence: 'Synthetic evidence for a withdrawn ownership claim.' }).expect(201)).body.data;
  await call('finder', 'patch', `/claims/${claim.id}`).send({ action: 'withdraw', reason: 'Not my claim to withdraw.' }).expect(404);
  await call('owner', 'patch', `/claims/${claim.id}`).send({ action: 'withdraw', reason: 'Synthetic item is not mine after checking.' }).expect(200);
  await call('finder', 'delete', `/reports/${report.id}`).send({}).expect(200);
  await call(null, 'get', `/reports/${report.id}`).expect(404);
  assert.ok((await Report.findById(report.id)).deletedAt);
});
it('caches semantic scores, shares concurrent work and excludes stale candidate revisions', async () => {
  const source = await Report.create({ ...payload, type: 'lost', category: 'keys', owner: actors.owner.user._id });
  const candidate = await Report.create({ ...payload, category: 'keys', owner: actors.finder.user._id });
  let calls = 0;
  const matching = createMatching({ rank: async (s, candidates) => { calls++; return candidates.map((c) => ({ id: c.id || String(c._id), score: 90, explanation: 'Synthetic semantic similarity.' })); } });
  const [first, second] = await Promise.all([matching(source), matching(source)]);
  assert.equal(calls, 1); assert.equal(first[0].method, 'gemini'); assert.equal(second.length, first.length);
  await Report.updateOne({ _id: source.id }, { $unset: { matchesCheckedAt: 1 } });
  await matching(await Report.findById(source.id)); assert.equal(calls, 1, 'unchanged scores reused even after discovery refresh');
  await Report.updateOne({ _id: candidate.id }, { $inc: { revision: 1 } });
  assert.ok((await matching(await Report.findById(source.id))).every((m) => m.report.id !== candidate.id), 'the changed candidate is not shown with a stale score');
});
it('cleans up successfully uploaded assets when a later upload fails', async () => {
  const removed = []; let attempt = 0;
  const failureApp = createApp(env, { logRequests: false, services: { ...services, images: { upload: async () => { if (++attempt === 2) throw new Error('synthetic provider failure'); return { url: 'https://example.com/image.jpg', publicId: 'synthetic-orphan' }; }, remove: async (items) => removed.push(...items) } } });
  let upload = request(failureApp).post('/api/v1/reports').set('Origin', origin).set('X-Requested-With', 'ClaimBack').set('Cookie', actors.owner.cookie);
  for (const [key, value] of Object.entries(payload)) upload = upload.field(key, value);
  await upload.attach('images', image, 'one.png').attach('images', image, 'two.png').expect(500);
  assert.deepEqual(removed.map((i) => i.publicId), ['synthetic-orphan']);
});
