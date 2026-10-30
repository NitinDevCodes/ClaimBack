import mongoose from 'mongoose';

export const categories = ['electronics', 'bags', 'wallets', 'keys', 'documents', 'jewellery', 'clothing', 'other'];
const boundedStrings = (max = 20) => ({ type: [{ type: String, maxlength: 120 }], default: [], validate: { validator: (value) => value.length <= max, message: 'Too many attributes.' } });
const imageSchema = new mongoose.Schema({
  url: { type: String, required: true, match: /^https:\/\//, maxlength: 2048 },
  publicId: { type: String, required: true, maxlength: 300 },
}, { _id: false });
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['lost', 'found'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: categories, required: true },
  colour: { type: String, trim: true, maxlength: 80 },
  location: { type: String, trim: true, required: true, maxlength: 200 },
  occurredAt: { type: Date, required: true },
  images: { type: [imageSchema], default: [], validate: { validator: (value) => value.length <= 3, message: 'Upload up to three images.' } },
  status: { type: String, enum: ['open', 'reserved', 'recovered', 'closed'], default: 'open' },
  moderation: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
  revision: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  matchesCheckedAt: Date,
  analysis: {
    status: { type: String, enum: ['pending', 'complete', 'unavailable', 'corrected'], default: 'pending' },
    object: { type: String, maxlength: 120 },
    category: { type: String, enum: categories },
    colours: boundedStrings(8),
    brand: { type: String, maxlength: 100 },
    characteristics: boundedStrings(),
    distinctiveFeatures: boundedStrings(),
    keywords: boundedStrings(),
    improvedDescription: { type: String, maxlength: 3000 },
    model: { type: String, maxlength: 100 },
    analyzedAt: Date,
    correctedAt: Date,
  },
}, { timestamps: true });
schema.index({ owner: 1, createdAt: -1 });
schema.index({ type: 1, status: 1, moderation: 1, category: 1, occurredAt: -1 });
schema.index({ location: 1, occurredAt: -1 });
schema.index({ title: 'text', description: 'text', 'analysis.keywords': 'text' });
export const Report = mongoose.model('Report', schema);

export function publicReport(report) {
  return {
    id: report._id.toString(), type: report.type, title: report.title,
    description: report.description, category: report.category, colour: report.colour,
    location: report.location, occurredAt: report.occurredAt,
    images: report.images.map((image) => ({ url: image.url })),
    status: report.status, createdAt: report.createdAt,
    analysis: report.analysis, revision: report.revision,
  };
}
