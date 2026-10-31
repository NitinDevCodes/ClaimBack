import { parseEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { databaseDiagnostic } from './utils/databaseDiagnostics.js';

async function start() {
  const env = parseEnv();
  logger.info('ai_configuration', { configured: Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL), model: env.GEMINI_MODEL, keySuffix: env.GEMINI_API_KEY.slice(-4) });
  if (env.ephemeralSecret) logger.info('temporary_session_key', { message: 'Set JWT_SECRET in server/.env to keep sessions valid across restarts.' });
  try { await connectDatabase(env); }
  catch (error) {
    logger.error('database_connection_failed', databaseDiagnostic(error));
    if (env.production) throw error;
    // A collection/index failure can occur after the socket connects. Do not
    // advertise readiness or serve data without successful initialization.
    await disconnectDatabase();
  }
  const app = createApp(env);
  const server = app.listen(env.PORT, () => logger.info('server_listening', { port: env.PORT, environment: env.NODE_ENV }));
  server.on('error', (error) => { logger.error('server_error', { code: error.code }); process.exit(1); });
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server_stopping', { signal });
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try { await disconnectDatabase(); clearTimeout(timeout); process.exit(0); }
      catch { process.exit(1); }
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  logger.error('startup_failed', { errorType: error.name, message: 'Check server environment variables and database connectivity. See README.md.' });
  process.exitCode = 1;
});
