import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'This API endpoint does not exist.'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof AppError ? error.status : 500;
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  let message = error instanceof AppError ? error.message : 'Something went wrong. Please try again.';
  if (error.type === 'entity.parse.failed') [status, code, message] = [400, 'INVALID_JSON', 'The request body must be valid JSON.'];
  if (error.type === 'entity.too.large') [status, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.'];
  if (error.code === 11000) [status, code, message] = [409, 'CONFLICT', 'An account with this email already exists.'];
  if (error.name === 'ValidationError') [status, code, message] = [400, 'VALIDATION_ERROR', 'Some fields are invalid.'];
  if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)) {
    [status, code, message] = [503, 'DATABASE_UNAVAILABLE', 'The database is unavailable. Please try again later.'];
  }
  if (status >= 500) logger.error('request_failed', { requestId: req.id, code, status, errorType: error.name });
  res.status(status).json({ success: false, error: { code, message, ...(error instanceof AppError && error.details ? { details: error.details } : {}), requestId: req.id } });
}
