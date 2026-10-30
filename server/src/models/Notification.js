import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['match', 'interest', 'claim', 'recovery', 'system'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 500 },
  href: { type: String, maxlength: 200, validate: { validator: (value) => !value || /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(value), message: 'Only local application paths are allowed.' } },
  readAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ recipient: 1, readAt: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', schema);
