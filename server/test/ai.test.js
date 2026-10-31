import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createAI, itemContext } from '../src/services/ai.service.js';
import { normalizeImages } from '../src/services/images.service.js';
import sharp from 'sharp';
const env = { GEMINI_API_KEY: 'test-only', GEMINI_MODEL: 'test-only-model' };
const attrs = { object: 'Bag', category: 'bags', colours: ['green'], brand: '', characteristics: [], distinctiveFeatures: [], keywords: ['bag'], improvedDescription: 'Green bag.' };
it('sends inline normalized images and validates successful Gemini structured extraction', async () => {
  let received;
  const ai = createAI(env, { models: { generateContent: async (input) => { received = input; return { text: JSON.stringify(attrs) }; } } });
  const result = await ai.analyze({ title: 'Green bag', privateEvidence: 'NEVER_SEND', owner: 'NEVER_SEND' }, [Buffer.from('synthetic-normalized-image')]);
  assert.equal(result.status, 'complete'); assert.equal(result.object, 'Bag');
  assert.equal(received.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.equal(received.config.responseMimeType, 'application/json');
  assert.ok(received.config.responseJsonSchema);
  assert.ok(!JSON.stringify(received).includes('NEVER_SEND'));
  assert.equal(itemContext({ passwordHash: 'NEVER_SEND' }).passwordHash, undefined);
});
it('accepts only a complete unique candidate set with bounded similarity scores', async () => {
  const a = '111111111111111111111111', b = '222222222222222222222222';
  let output = { matches: [{ id: a, score: 87, explanation: 'Same appearance and location.' }, { id: b, score: 42, explanation: 'Only the category overlaps.' }] };
  const ai = createAI(env, { models: { generateContent: async () => ({ text: JSON.stringify(output) }) } });
  const candidates = [{ _id: a }, { _id: b }];
  assert.equal((await ai.rank({}, candidates))[0].score, 87);
  output.matches[1].id = a; assert.equal(await ai.rank({}, candidates), null);
  output.matches[1].id = '333333333333333333333333'; assert.equal(await ai.rank({}, candidates), null);
  output.matches[0].score = 101; assert.equal(await ai.rank({}, candidates), null);
});
it('returns explicit unavailable fallback on provider exceptions and oversized output', async () => {
  let ai = createAI(env, { models: { generateContent: async () => { throw new Error('sensitive-provider-error'); } } });
  assert.deepEqual(await ai.analyze({}), { status: 'unavailable' });
  ai = createAI(env, { models: { generateContent: async () => ({ text: 'x'.repeat(30001) }) } });
  assert.deepEqual(await ai.analyze({}), { status: 'unavailable' });
});
it('re-encodes image pixels, bounds dimensions, strips metadata and rejects disguised SVG', async () => {
  const original = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#3a4b25' } }).withMetadata().png().toBuffer();
  const [normalized] = await normalizeImages([{ buffer: original }]);
  const metadata = await sharp(normalized).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 1600); assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  await assert.rejects(normalizeImages([{ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>') }]), (e) => e.code === 'INVALID_IMAGE');
});
