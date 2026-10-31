import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { databaseStatus } from './config/database.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { protectMutation, requireDatabase } from './middleware/security.js';
import { AppError } from './utils/AppError.js';
import { logger } from './utils/logger.js';
import { reportRoutes } from './routes/report.routes.js';
import { workflowRoutes } from './routes/workflow.routes.js';
import { requestRoute } from './utils/requestRoute.js';

export function createApp(env, { getDatabaseStatus = databaseStatus, logRequests = true, services = {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    if (logRequests) {
      const started = performance.now();
      res.on('finish', () => logger.info('http_request', { requestId: req.id, method: req.method, route: requestRoute(req), status: res.statusCode, durationMs: Math.round(performance.now() - started) }));
    }
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.origins.includes(origin)) return callback(null, true);
      callback(new AppError(403, 'ORIGIN_REJECTED', 'This application origin is not allowed.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  }));
  app.use('/api/v1', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/v1/health', (req, res) => res.json({ success: true, data: { service: 'ClaimBack API', status: 'ok', database: getDatabaseStatus() } }));
  app.get('/api/v1/health/ready', (req, res, next) => {
    if (getDatabaseStatus() !== 'connected') return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Database connection is required for account and report features.'));
    res.json({ success: true, data: { status: 'ready', database: 'connected' } });
  });
  app.use('/api/v1', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')) }));
  app.use('/api/v1', protectMutation(env.origins));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(cookieParser());
  app.use('/api/v1/auth', requireDatabase(getDatabaseStatus), authRoutes(env));
  app.use('/api/v1/users', requireDatabase(getDatabaseStatus), userRoutes(env));
  app.use('/api/v1/reports', requireDatabase(getDatabaseStatus), reportRoutes(env, services));
  app.use('/api/v1', requireDatabase(getDatabaseStatus), workflowRoutes(env));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
