import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12, 'Use at least 12 characters.').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Use at most 72 UTF-8 bytes.');
export const nameSchema = z.string().trim().min(2, 'Use at least 2 characters.').max(80);
export const registerSchema = z.object({ name: nameSchema, email, password }).strict();
const loginSchema = z.object({ email, password: z.string().min(1).max(256).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.') }).strict();

export function authRoutes(env) {
  const router = Router();
  const controller = authController(env);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Please try again in 15 minutes.')) });
  router.post('/register', limiter, validate(registerSchema), controller.register);
  router.post('/login', limiter, validate(loginSchema), controller.login);
  router.post('/logout', authenticate(env), controller.logout);
  router.get('/me', authenticate(env), controller.me);
  return router;
}
