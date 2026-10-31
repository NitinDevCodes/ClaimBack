import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { uploadImages, createImageStore } from '../services/images.service.js';
import { createAI } from '../services/ai.service.js';
import { createMatching } from '../services/matching.service.js';
import { reportController } from '../controllers/report.controller.js';
import { AppError } from '../utils/AppError.js';
export function reportRoutes(env, services = {}) {
  const router = Router();
  const ai = services.ai || createAI(env);
  const controller = reportController({ ai, images: services.images || createImageStore(env), matching: services.matching || createMatching(ai) });
  const auth = authenticate(env);
  const expensive = rateLimit({ windowMs: 3600000, limit: 20, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Report and AI request limit reached. Try again in an hour.')) });
  router.get('/', controller.browse);
  router.get('/mine', auth, controller.mine);
  router.post('/', auth, expensive, uploadImages, controller.create);
  router.post('/matches/:matchId/interest', auth, controller.interest);
  router.get('/:id', controller.detail);
  router.get('/:id/manage', auth, controller.manage);
  router.get('/:id/access', auth, controller.access);
  router.patch('/:id', auth, expensive, uploadImages, controller.update);
  router.delete('/:id', auth, controller.remove);
  router.patch('/:id/attributes', auth, controller.correct);
  router.get('/:id/matches', auth, expensive, controller.matches);
  return router;
}
