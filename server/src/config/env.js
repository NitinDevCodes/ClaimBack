import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  MONGODB_URI: z.string().default(''),
  MONGODB_DNS_SERVERS: z.string().default('').refine((value) => value === '' || value.split(',').every((server) => isIP(server.trim()) !== 0), 'Use comma-separated DNS resolver IP addresses.'),
  JWT_SECRET: z.string().default(''),
  JWT_EXPIRES_IN: z.enum(['1h', '8h', '1d', '7d']).default('1d'),
  COOKIE_CROSS_SITE: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
});

export function parseEnv(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment fields: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  const env = parsed.data;
  const production = env.NODE_ENV === 'production';
  const origins = env.CLIENT_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { const url = new URL(origin); return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin || (production && url.protocol !== 'https:'); }
    catch { return true; }
  })) throw new Error('CLIENT_ORIGIN must contain exact HTTP(S) origins, with HTTPS in production.');
  if (env.MONGODB_URI && !/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI)) throw new Error('MONGODB_URI must be a MongoDB connection string.');
  if (production && (!env.MONGODB_URI || !env.JWT_SECRET)) throw new Error('Production requires MONGODB_URI and JWT_SECRET.');
  if (env.JWT_SECRET && Buffer.byteLength(env.JWT_SECRET) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes.');
  if (env.COOKIE_CROSS_SITE === 'true' && !production) throw new Error('Cross-site cookies require the HTTPS production configuration.');
  return Object.freeze({
    ...env,
    origins,
    databaseDnsServers: env.MONGODB_DNS_SERVERS ? env.MONGODB_DNS_SERVERS.split(',').map((server) => server.trim()) : [],
    production,
    ephemeralSecret: !env.JWT_SECRET,
    JWT_SECRET: env.JWT_SECRET || randomBytes(48).toString('hex'),
  });
}
