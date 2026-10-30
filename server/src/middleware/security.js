import { AppError } from '../utils/AppError.js';

export const protectMutation = (origins) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!origins.includes(req.get('origin')) || req.get('x-requested-with') !== 'ClaimBack') {
    return next(new AppError(403, 'ORIGIN_REJECTED', 'This request did not come from an allowed application origin.'));
  }
  const reportUpload = ['POST', 'PATCH'].includes(req.method) && /^\/reports(?:\/[a-f0-9]{24})?$/i.test(req.path) && req.is('multipart/form-data');
  if (!req.is('application/json') && !reportUpload) return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json for this endpoint.'));
  next();
};

export const requireDatabase = (getStatus) => (req, res, next) => {
  if (getStatus() !== 'connected') return next(new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is not connected. Please try again later.'));
  next();
};
