import { AppError } from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(new AppError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))));
  req.validated = result.data;
  next();
};
