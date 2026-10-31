// Explicit operator-run integration checks. Never run as part of npm test.
// Credentials/session state remain under ignored test-results; output is whitelisted.
import fs from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { parseEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User, Report, Claim, Match, Notification } from '../src/models/index.js';
import { providerDiagnostic } from '../src/utils/providerDiagnostics.js';
import { createImageStore } from '../src/services/images.service.js';

if (process.argv[3] !== '--confirm-live') throw new Error('Use: node server/scripts/verify-live-providers.js ACTION --confirm-live');
const action = process.argv[2];
const directory = 'test-results/live-provider';
const env = parseEnv();
const base = 'http://127.0.0.1:5173/api/v1';
const options = { cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true };
await fs.mkdir(directory, { recursive: true });
let state;
try { state = JSON.parse(await fs.readFile(`${directory}/state.json`, 'utf8')); } catch { state = null; }
const output = (data) => console.log(JSON.stringify(data));
const save = () => fs.writeFile(`${directory}/state.json`, JSON.stringify(state, null, 2));
async function record(key, value) { state.results[key] = value; await save(); output({ check: key, ...value }); }
async function api(role, method, path, body) {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}${path}`, { method, headers: { Origin: 'http://127.0.0.1:5173', 'X-Requested-With': 'ClaimBack', ...(role && state.actors[role]?.cookie ? { Cookie: state.actors[role].cookie } : {}), ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined && { body: multipart ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(120000) });
  const json = await response.json();
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('claimback_session='));
  if (cookie && role) state.actors[role].cookie = cookie.split(';')[0];
  state.requests.push({ method, path, status: response.status, requestId: response.headers.get('x-request-id') });
  await save();
  return { status: response.status, data: json.data, code: json.error?.code };
}
function expected(result, status) { if (result.status !== status) throw new Error(`ApplicationStatus:${result.status}:${result.code || 'unknown'}`); return result.data; }
async function connect() { if (mongoose.connection.readyState !== 1) await connectDatabase({ ...env, production: true }); if (mongoose.connection.name !== 'claimback') throw new Error('UnexpectedDatabase'); }
async function form(fields, image = true) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.append(key, String(value));
  if (image) result.append('images', new Blob([await fs.readFile(`${directory}/test-photo.jpg`)], { type: 'image/jpeg' }), 'public-sample-sneaker.jpg');
  return result;
}
async function storedImage(reportId) {
  await connect(); const report = await Report.findOne({ _id: reportId, owner: { $in: Object.values(state.actors).map((a) => a.id) } });
  if (!report) throw new Error('NotOwnedByVerification');
  const item = report.images[0];
  if (!item) return null;
  const resource = await cloudinary.api.resource(item.publicId, { ...options, resource_type: 'image' });
  const delivery = await fetch(item.url);
  return { publicId: item.publicId, url: item.url, stored: resource.public_id === item.publicId, deliveryStatus: delivery.status, format: resource.format, bytes: resource.bytes };
}
async function missingAsset(publicId) {
  try { await cloudinary.api.resource(publicId, { ...options, resource_type: 'image' }); return false; }
  catch (error) { if (error.http_code === 404 || error.error?.http_code === 404) return true; throw error; }
}
try {
  if (action === 'init') {
    if (state) throw new Error('VerificationAlreadyInitialized');
    expected(await (async () => { const r = await fetch(`${base}/health/ready`); return { status: r.status }; })(), 200);
    await connect();
    state = { run: `LIVE-VERIFY-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`, startedAt: new Date(), actors: {}, requests: [], results: {}, reports: {}, assets: [], baseline: {} };
    for (const model of [User, Report, Claim, Match, Notification]) state.baseline[model.collection.name] = await model.find({}).select('_id updatedAt').lean();
    if (await Report.countDocuments({ occurredAt: { $gte: new Date('2001-08-01'), $lte: new Date('2002-02-01') } })) throw new Error('SyntheticDateWindowNotIsolated');
    state.occurredAt = '2001-10-31';
    for (const role of ['owner', 'finder', 'admin']) {
      state.actors[role] = { email: `${state.run.toLowerCase()}-${role}@example.test`, password: randomBytes(24).toString('base64url') + 'A1!' };
      await save();
      const result = expected(await api(role, 'POST', '/auth/register', { name: `${state.run} ${role}`, email: state.actors[role].email, password: state.actors[role].password }), 201);
      state.actors[role].id = result.user.id; await save();
    }
    const actor = state.actors.admin;
    const promoted = await User.updateOne({ _id: actor.id, email: actor.email, role: 'user', createdAt: { $gte: new Date(state.startedAt) } }, { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } });
    if (promoted.modifiedCount !== 1) throw new Error('SyntheticAdminGuardFailed');
    expected(await api('admin', 'POST', '/auth/login', { email: actor.email, password: actor.password }), 200);
    await record('initialization', { database: mongoose.connection.name, syntheticAccounts: 3, run: state.run, isolatedHistoricalDate: state.occurredAt });
  } else if (!state) throw new Error('InitializeFirst');
  else if (action === 'refresh-sessions') {
    for (const [role, actor] of Object.entries(state.actors)) expected(await api(role, 'POST', '/auth/login', { email: actor.email, password: actor.password }), 200);
    await record('sessionsRefreshed', { accounts: 3 });
  } else if (['lost', 'found', 'disposable'].includes(action)) {
    if (state.reports[action]) throw new Error('ReportAlreadyCreated');
    const type = action === 'found' ? 'found' : 'lost';
    const role = action === 'found' ? 'finder' : 'owner';
    const result = expected(await api(role, 'POST', '/reports', await form({ type, title: `${state.run} ${action} white sneaker`, description: 'SYNTHETIC LIVE VERIFICATION ONLY. White lace-up sneaker with a blue inner lining, perforated toe, thick white sole and heel pull tab. Not a real lost item.', category: action === 'disposable' ? 'other' : 'clothing', colour: 'white blue', location: `${state.run} synthetic campus shoe display`, occurredAt: action === 'disposable' ? '1991-10-31' : state.occurredAt })), 201);
    state.reports[action] = result.report.id; await save();
    const asset = await storedImage(result.report.id); state.assets.push(asset); await save();
    await record(action, { reportId: result.report.id, analysis: result.report.analysis, matches: result.matches, matchingStatus: result.matchingStatus, cloudinary: asset });
  } else if (action === 'replace') {
    const id = state.reports.lost;
    const report = expected(await api('owner', 'GET', `/reports/${id}/manage`), 200);
    const before = await storedImage(id);
    const updated = expected(await api('owner', 'PATCH', `/reports/${id}`, await form({ revision: report.revision })), 200);
    const after = await storedImage(id); state.assets.push(after); await save();
    await record('replacement', { reportId: id, oldAssetRemoved: await missingAsset(before.publicId), newAssetDistinct: after.publicId !== before.publicId, colourPreserved: updated.colour === report.colour, cloudinary: after, analysis: updated.analysis.status });
  } else if (action === 'restore-colour') {
    const id = state.reports.lost; const report = expected(await api('owner', 'GET', `/reports/${id}/manage`), 200);
    const updated = expected(await api('owner', 'PATCH', `/reports/${id}`, { revision: report.revision, colour: 'white blue' }), 200);
    await record('syntheticColourRestored', { colour: updated.colour, reportId: id });
  } else if (action === 'rollback') {
    const id = state.reports.lost;
    const report = expected(await api('owner', 'GET', `/reports/${id}/manage`), 200);
    const before = await cloudinary.api.resources({ ...options, type: 'upload', prefix: 'claimback/', max_results: 500 });
    if (before.next_cursor) throw new Error('AssetSnapshotTooLarge');
    const result = await api('owner', 'PATCH', `/reports/${id}`, await form({ revision: Math.max(0, report.revision - 1) }));
    const after = await cloudinary.api.resources({ ...options, type: 'upload', prefix: 'claimback/', max_results: 500 });
    const afterReport = expected(await api('owner', 'GET', `/reports/${id}/manage`), 200);
    const ids = (list) => list.resources.map((r) => r.public_id).sort().join('|');
    await record('rollbackCleanup', { status: result.status, code: result.code, cloudinaryAssetsUnchanged: ids(before) === ids(after), reportImageUnchanged: report.images[0].url === afterReport.images[0].url, revisionUnchanged: report.revision === afterReport.revision });
  } else if (action === 'delete') {
    const id = state.reports.disposable; const asset = await storedImage(id);
    expected(await api('owner', 'DELETE', `/reports/${id}`, {}), 200);
    const publicResponse = await api(null, 'GET', `/reports/${id}`);
    await record('deletion', { reportId: id, cloudinaryAssetRemoved: await missingAsset(asset.publicId), publicStatus: publicResponse.status, publicCode: publicResponse.code });
  } else if (action === 'invalid-upload') {
    const body = await form({ type: 'lost', title: `${state.run} invalid upload`, description: 'Synthetic upload validation failure test only.', category: 'other', location: state.run, occurredAt: state.occurredAt }, false);
    body.append('images', new Blob([Buffer.from('not a real JPEG')], { type: 'image/jpeg' }), 'invalid.jpg');
    const result = await api('owner', 'POST', '/reports', body);
    await record('invalidUpload', { status: result.status, code: result.code });
  } else if (action === 'provider-reject') {
    try { await createImageStore(env).upload(Buffer.from('synthetic-invalid-image-payload')); throw new Error('UnexpectedProviderAcceptance'); }
    catch (error) { if (error.code !== 'UPLOAD_FAILED') throw error; await record('cloudinaryProviderFailure', { applicationStatus: error.status, applicationCode: error.code, description: 'Real Cloudinary rejected invalid image bytes; adapter returned a safe UPLOAD_FAILED error.' }); }
  } else if (action === 'claim') {
    const result = expected(await api('owner', 'POST', '/claims', { reportId: state.reports.found, lostReportId: state.reports.lost, privateEvidence: `${state.run} private synthetic evidence: invented verification-only marking beneath the insole. No real person's evidence.` }), 201);
    state.claimId = result.id; await save();
    const review = expected(await api('admin', 'GET', `/claims/${result.id}`), 200);
    const finder = await api('finder', 'GET', `/claims/${result.id}`);
    await record('claim', { claimId: result.id, status: result.status, adminCanReview: Boolean(review.privateEvidence), finderStatus: finder.status, finderCode: finder.code });
  } else if (['recover', 'verify-recovery'].includes(action)) {
    if (action === 'recover') {
      expected(await api('admin', 'PATCH', `/claims/${state.claimId}`, { action: 'approve', reason: `${state.run}: independent synthetic evidence review, no real ownership decision.` }), 200);
      expected(await api('admin', 'PATCH', `/claims/${state.claimId}`, { action: 'handover', reason: `${state.run}: simulated handover confirmed for integration verification only.` }), 200);
    }
    expected(await api('owner', 'POST', '/auth/login', { email: state.actors.owner.email, password: state.actors.owner.password }), 200);
    const detail = expected(await api('owner', 'GET', `/claims/${state.claimId}`), 200);
    const notices = expected(await api('owner', 'GET', '/notifications?limit=50'), 200);
    await connect();
    const reports = await Report.find({ _id: { $in: [state.reports.lost, state.reports.found] } }).select('_id status').lean();
    await record('recovery', { handover: detail.status, history: detail.history.map((h) => h.status), reports: reports.map((r) => ({ id: String(r._id), status: r.status })), notifications: notices.items.map((n) => ({ kind: n.kind, title: n.title })), persistedIn: mongoose.connection.name });
  } else if (action === 'retire-accounts') {
    await connect();
    let retired = 0;
    for (const actor of Object.values(state.actors)) {
      const result = await User.updateOne({ _id: actor.id, email: actor.email, createdAt: { $gte: new Date(state.startedAt) } }, { $set: { status: 'suspended', role: 'user' }, $inc: { tokenVersion: 1 } });
      retired += result.modifiedCount;
    }
    const verified = await User.countDocuments({ _id: { $in: Object.values(state.actors).map((actor) => actor.id) }, status: 'suspended', role: 'user' });
    if (verified !== 3) throw new Error('SyntheticRetirementVerificationFailed');
    for (const actor of Object.values(state.actors)) {
      delete actor.password;
      delete actor.cookie;
    }
    await record('syntheticAccountsRetired', { retired, verified, adminPrivilegeRemoved: true, sessionsRevoked: true, localCredentialsRemoved: true });
  } else if (action === 'diagnostics') {
    const anonymous = await api(null, 'GET', '/auth/me');
    const authenticated = await api('owner', 'GET', '/auth/me');
    const obsolete = await api(null, 'GET', '/healthz');
    await record('httpDiagnostics', { anonymousMe: { status: anonymous.status, code: anonymous.code }, authenticatedMe: { status: authenticated.status }, deliberatelyUnknownHealthz: { status: obsolete.status, code: obsolete.code } });
  } else if (action === 'audit') {
    await connect(); let unchanged = true; const collections = {};
    for (const model of [User, Report, Claim, Match, Notification]) {
      const previous = state.baseline[model.collection.name];
      const current = await model.find({ _id: { $in: previous.map((r) => r._id) } }).select('_id updatedAt').lean();
      const map = new Map(current.map((r) => [String(r._id), r.updatedAt?.toISOString()]));
      const intact = previous.every((r) => map.has(String(r._id)) && map.get(String(r._id)) === r.updatedAt);
      collections[model.collection.name] = { baselineCount: previous.length, unchanged: intact }; unchanged &&= intact;
    }
    await record('existingRecords', { unchanged, collections });
  } else throw new Error('UnknownAction');
} catch (error) {
  output({ check: action, failed: true, ...providerDiagnostic(error), ...(error.message?.startsWith('ApplicationStatus:') ? { application: error.message } : {}) });
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
