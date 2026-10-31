// Operator-only diagnostics. Never print environment values, headers or API keys.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { lookup } from 'node:dns/promises';
import tls from 'node:tls';

const inheritedKey = process.env.GEMINI_API_KEY;
const file = await fs.readFile(new URL('../.env', import.meta.url), 'utf8');
const fileEnv = dotenv.parse(file);
const { parseEnv } = await import('../src/config/env.js');
const env = parseEnv();
const sdk = JSON.parse(await fs.readFile(new URL('../../node_modules/@google/genai/package.json', import.meta.url), 'utf8'));
const keys = [fileEnv.GEMINI_API_KEY, env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY].filter(Boolean);
function redact(value) {
  let text = String(value || '');
  for (const key of keys) text = text.split(key).join('[REDACTED]');
  return text.replace(/AIza[\w-]+/g, '[REDACTED]').replace(/([?&](?:key|api_key)=)[^&\s]+/gi, '$1[REDACTED]').slice(0,2000);
}
function output(data) { console.log(JSON.stringify(data)); }
const action = process.argv[2] || 'config';
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });
const endpoint = ai.apiClient.getBaseUrl();
const config = {
  envFile: 'server/.env', sdk: sdk.version, node: process.version,
  keyPresent: Boolean(env.GEMINI_API_KEY), keySuffix: env.GEMINI_API_KEY.slice(-4),
  fileKeySuffix: (fileEnv.GEMINI_API_KEY || '').slice(-4), fileMatchesEffective: fileEnv.GEMINI_API_KEY === env.GEMINI_API_KEY,
  inheritedGeminiKeyPresent: Boolean(inheritedKey), googleApiKeyPresent: Boolean(process.env.GOOGLE_API_KEY),
  duplicateGeminiKeyDefinitions: (file.match(/^\s*(?:export\s+)?GEMINI_API_KEY\s*=/gm) || []).length,
  model: env.GEMINI_MODEL, vertexAI: ai.vertexai,
  endpoint: endpoint === 'https://generativelanguage.googleapis.com/' ? endpoint : 'custom (redacted)', apiVersion: ai.apiClient.getApiVersion(),
  proxyConfigured: ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NODE_USE_ENV_PROXY'].filter((k) => Boolean(process.env[k])),
  baseOverrideConfigured: Boolean(process.env.GOOGLE_GEMINI_BASE_URL),
  explicitKeySelected: ai.apiKey === env.GEMINI_API_KEY,
};
output({ check: 'configuration', ...config });
if (action !== 'config') {
  if (process.argv[3] !== '--confirm-live') throw new Error('Live diagnostics require --confirm-live');
  if (config.endpoint !== 'https://generativelanguage.googleapis.com/') throw new Error('UnexpectedEndpointReviewRequired');
  if (!['text', 'rest', 'network', 'stream'].includes(action)) throw new Error('UnknownDiagnosticAction');
  const start = Date.now();
  try {
    if (action === 'network') {
      const addresses = await lookup('generativelanguage.googleapis.com', { all: true });
      const connection = await new Promise((resolve, reject) => {
        const socket = tls.connect({ host: 'generativelanguage.googleapis.com', port: 443, servername: 'generativelanguage.googleapis.com', rejectUnauthorized: true }, () => {
          const certificate = socket.getPeerCertificate();
          resolve({ authorized: socket.authorized, protocol: socket.getProtocol(), issuer: certificate.issuer?.O, subject: certificate.subject?.CN });
          socket.end();
        });
        socket.setTimeout(10000, () => socket.destroy(new Error('TLSProbeTimeout')));
        socket.on('error', reject);
      });
      const model = await ai.models.get({ model: env.GEMINI_MODEL });
      output({ check: 'network', success: true, resolvedAddressFamilies: [...new Set(addresses.map((a) => a.family))], tls: connection, model: model.name, supportedActions: model.supportedActions });
    } else if (action === 'stream') {
      const stream = await ai.models.generateContentStream({ model: env.GEMINI_MODEL, contents: 'Reply with exactly CLAIMBACK_OK.' });
      let text = '', chunks = 0;
      for await (const chunk of stream) { text += chunk.text || ''; chunks++; }
      output({ check: 'stream', success: Boolean(text), elapsedMs: Date.now()-start, text: redact(text), chunks });
    } else if (action === 'rest') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly CLAIMBACK_OK.' }] }] }), signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      output({ check: 'directRest', success: response.ok, status: response.status, elapsedMs: Date.now()-start,
        text: redact(data.candidates?.[0]?.content?.parts?.filter((p) => p.text).map((p) => p.text).join('')),
        error: data.error ? { code: data.error.code, status: data.error.status, message: redact(data.error.message), details: redact(JSON.stringify(data.error.details)) } : undefined,
        server: response.headers.get('server'), modelVersion: data.modelVersion });
      if (!response.ok) process.exitCode = 1;
    } else {
    const result = await ai.models.generateContent({ model: env.GEMINI_MODEL, contents: 'Reply with exactly CLAIMBACK_OK.' });
    output({ check: 'minimalText', success: Boolean(result.text), elapsedMs: Date.now()-start, text: redact(result.text), modelVersion: result.modelVersion, finishReasons: result.candidates?.map((c) => c.finishReason) });
    }
  } catch (error) {
    output({ check: action, success: false, elapsedMs: Date.now()-start, name: error.name, status: error.status, message: redact(error.message), causeCode: redact(error.cause?.code) });
    process.exitCode = 1;
  }
}
