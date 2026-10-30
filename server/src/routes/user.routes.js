import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { nameSchema } from './auth.routes.js';
import { updateProfile } from '../controllers/user.controller.js';

export function userRoutes(env) {
  const router = Router();
  router.patch('/me', authenticate(env), validate(z.object({ name: nameSchema }).strict()), updateProfile);
  return router;
}
