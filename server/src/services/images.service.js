import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { providerDiagnostic } from '../utils/providerDiagnostics.js';

export const uploadImages = multer({ storage: multer.memoryStorage(), limits: { files: 3, fileSize: 5 * 1024 * 1024, fields: 12, fieldSize: 12000, parts: 15 }, fileFilter(req, file, done) {
  done(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new AppError(400, 'INVALID_IMAGE', 'Upload JPEG, PNG or WebP images.'), true);
} }).array('images', 3);

export async function normalizeImages(files = []) {
  try {
    return await Promise.all(files.map(async (file) => {
      const input = sharp(file.buffer, { limitInputPixels: 20000000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('format');
      return input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    }));
  } catch { throw new AppError(400, 'INVALID_IMAGE', 'The image could not be decoded. Use a non-animated JPEG, PNG or WebP under 20 megapixels.'); }
}

export function createImageStore(env) {
  const enabled = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  const options = { cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true };
  return {
    enabled,
    async upload(buffer) {
      if (!enabled) throw new AppError(503, 'UPLOADS_UNAVAILABLE', 'Image storage is not configured. You can submit a text report or try again later.');
      try {
        const result = await new Promise((resolve, reject) => cloudinary.uploader.upload_stream({ ...options, resource_type: 'image', public_id: `claimback/${randomUUID()}`, overwrite: false, timeout: 20000 }, (error, value) => error ? reject(error) : resolve(value)).end(buffer));
        return { url: result.secure_url, publicId: result.public_id };
      } catch (error) { logger.error('image_upload_failed', providerDiagnostic(error)); throw new AppError(503, 'UPLOAD_FAILED', 'Image storage is temporarily unavailable. Please retry.'); }
    },
    async remove(images) {
      for (const image of images) {
        try { await cloudinary.uploader.destroy(image.publicId, { ...options, invalidate: true, timeout: 15000 }); }
        catch { logger.error('image_cleanup_failed', { retryRequired: true, assetId: image.publicId }); }
      }
    },
  };
}
