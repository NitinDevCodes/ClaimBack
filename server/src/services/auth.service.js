import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export const SESSION_COOKIE = 'claimback_session';
const durations = { '1h': 3600000, '8h': 28800000, '1d': 86400000, '7d': 604800000 };
export const tokenOptions = { algorithm: 'HS256', issuer: 'claimback-api', audience: 'claimback-web' };
// Equal-cost comparison when an email does not exist; this value is not a credential.
const dummyHash = await bcrypt.hash('not-a-real-account-password', 12);

export function cookieOptions(env) {
  return { httpOnly: true, secure: env.production, sameSite: env.COOKIE_CROSS_SITE === 'true' ? 'none' : 'lax', path: '/api/v1' };
}

export function setSession(res, user, env) {
  const token = jwt.sign({ version: user.tokenVersion ?? 0 }, env.JWT_SECRET, { ...tokenOptions, subject: user._id.toString(), expiresIn: env.JWT_EXPIRES_IN });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(env), maxAge: durations[env.JWT_EXPIRES_IN] });
}

export async function registerUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email, passwordHash, role: 'user' });
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !valid || user.status !== 'active') throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return user;
}
