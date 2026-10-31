// Dedicated ephemeral environment. Never reads the Atlas URI or seeds an existing database.
process.env.CI = 'true';
const { MongoMemoryReplSet } = await import('mongodb-memory-server');
const { default: mongoose } = await import('mongoose');
const { default: bcrypt } = await import('bcrypt');
const { createServer } = await import('vite');
const { fileURLToPath } = await import('node:url');
const { createApp } = await import('../src/app.js');
const { parseEnv } = await import('../src/config/env.js');
const models = await import('../src/models/index.js');
const { createMatching } = await import('../src/services/matching.service.js');
const { createAI } = await import('../src/services/ai.service.js');
const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const env = parseEnv({ NODE_ENV: 'test', PORT: 5001, CLIENT_ORIGIN: 'http://127.0.0.1:5174', JWT_SECRET: 'isolated-synthetic-demo-only-secret-123456789' });
await mongoose.connect(database.getUri('claimback_synthetic_demo'));
for (const model of Object.values(models)) { await model.createCollection(); await model.createIndexes(); }
const passwordHash = await bcrypt.hash('Synthetic-demo-only-2026!', 12);
const users = {};
for (const role of ['finder', 'owner', 'admin']) users[role] = await models.User.create({ name: `Synthetic ${role}`, email: `${role}@example.test`, passwordHash, role: role === 'admin' ? 'admin' : 'user' });
const item = { title: 'Green canvas backpack', description: 'A forest green canvas backpack with a brass zip, brown straps and an orange patch on the front pocket.', category: 'bags', colour: 'green', location: 'Campus library entrance', occurredAt: new Date(), analysis: { status: 'unavailable' } };
await models.Report.create({ ...item, owner: users.finder._id, type: 'found' });
const lost = await models.Report.create({ ...item, title: 'Lost green backpack near the library', owner: users.owner._id, type: 'lost' });
await createMatching(createAI(env))(lost);
const api = createApp(env).listen(5001, '127.0.0.1');
const root = fileURLToPath(new URL('../../client', import.meta.url));
const vite = await createServer({ root, configFile: `${root}/vite.config.js`, server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:5001' } } });
await vite.listen();
console.log('SYNTHETIC DEMO ONLY: http://127.0.0.1:5174 — ephemeral local replica set, never Atlas.');
console.log('Users: owner@example.test, finder@example.test, admin@example.test. Password: Synthetic-demo-only-2026!');
console.log('Gemini and Cloudinary are intentionally unconfigured here. Type stop to discard this test environment.');
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await vite.close(); await new Promise((resolve) => api.close(resolve)); await mongoose.disconnect(); await database.stop(); process.exit(0); }
process.stdin.on('data', (input) => { if (String(input).trim() === 'stop') stop(); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
