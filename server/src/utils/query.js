import mongoose from 'mongoose';
import { z } from 'zod';
import { AppError } from './AppError.js';
export const idSchema = z.string().refine((v) => mongoose.isObjectIdOrHexString(v), 'Invalid identifier.');
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Check the submitted fields.', result.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })));
  return result.data;
}
export function pageQuery(query) {
  return parse(z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(12) }), query);
}
export async function paginated(model, filter, query, projection) {
  const { page, limit } = pageQuery(query);
  const [items, total] = await Promise.all([model.find(filter).select(projection || '').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
