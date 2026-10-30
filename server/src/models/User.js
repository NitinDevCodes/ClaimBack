import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

export const User = mongoose.model('User', schema);
export function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}
