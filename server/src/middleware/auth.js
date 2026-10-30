import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { SESSION_COOKIE, tokenOptions } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

export const authenticate = (env) => async (req, res, next) => {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: tokenOptions.issuer, audience: tokenOptions.audience }); }
  catch { throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.'); }
  if (!mongoose.isObjectIdOrHexString(payload.sub) || !Number.isInteger(payload.version)) throw new AppError(401, 'UNAUTHENTICATED', 'Your session is invalid.');
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.version) throw new AppError(401, 'UNAUTHENTICATED', 'Your session is no longer valid. Please sign in again.');
  req.user = user;
  next();
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
  next();
};
