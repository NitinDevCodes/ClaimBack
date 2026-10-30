import mongoose from 'mongoose';
const states = ['pending', 'approved', 'rejected', 'withdrawn', 'handed_over'];
const historySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: states, required: true },
  reason: { type: String, maxlength: 1000 },
  at: { type: Date, default: Date.now },
}, { _id: false });
const schema = new mongoose.Schema({
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  privateEvidence: { type: String, required: true, minlength: 20, maxlength: 5000, select: false },
  status: { type: String, enum: states, default: 'pending' },
  history: { type: [historySchema], default: [], select: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  handoverAt: Date,
}, { timestamps: true });
schema.index({ claimant: 1, createdAt: -1 });
schema.index({ report: 1, status: 1 });
schema.index({ report: 1, claimant: 1 }, { unique: true });
schema.index({ report: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['approved', 'handed_over'] } } });
export const Claim = mongoose.model('Claim', schema);
