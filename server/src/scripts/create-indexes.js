import mongoose from 'mongoose';
import { parseEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import '../models/index.js';
import { logger } from '../utils/logger.js';

try {
  const env = parseEnv();
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await connectDatabase(env);
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
    logger.info('indexes_created', { model: model.modelName });
  }
} catch (error) {
  logger.error('index_setup_failed', { errorType: error.name });
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
