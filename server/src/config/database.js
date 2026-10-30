import mongoose from 'mongoose';
import { setServers } from 'node:dns/promises';
import { logger } from '../utils/logger.js';

mongoose.set('bufferCommands', false);
// Models are imported before a connection exists. Do not auto-create collections
// during import when buffering is disabled; initialize them after connecting.
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

export function databaseStatus() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
}

export async function connectDatabase(env) {
  if (!env.MONGODB_URI) {
    logger.info('database_not_configured', { message: 'Set MONGODB_URI in server/.env. Data endpoints return 503 until connected.' });
    return;
  }
  // Explicit opt-in for environments whose default resolver rejects Atlas SRV/TXT.
  // This affects Node's DNS resolver in this process only, never Windows settings.
  if (env.databaseDnsServers?.length) {
    setServers(env.databaseDnsServers);
    logger.info('database_dns_configured', { resolverCount: env.databaseDnsServers.length, scope: 'backend_process' });
  }
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
    autoCreate: false,
    autoIndex: false,
  });
  if (!env.production) {
    for (const model of Object.values(mongoose.models)) {
      await model.createCollection();
      await model.createIndexes();
    }
  }
  logger.info('database_connected');
}

export async function disconnectDatabase() { await mongoose.disconnect(); }
