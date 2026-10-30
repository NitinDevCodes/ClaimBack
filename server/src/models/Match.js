import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
  score: { type: Number, min: 0, max: 100, required: true },
  explanation: { type: String, required: true, maxlength: 600 },
  method: { type: String, enum: ['gemini', 'fallback'], required: true },
  algorithmVersion: { type: String, required: true, maxlength: 30 },
  sourceRevision: { type: Number, default: 0 },
  candidateRevision: { type: Number, default: 0 },
  interestedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ source: 1, candidate: 1 }, { unique: true });
schema.index({ source: 1, score: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Match = mongoose.model('Match', schema);
