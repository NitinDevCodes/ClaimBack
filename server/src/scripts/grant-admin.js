import mongoose from 'mongoose';
import { parseEnv } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || process.argv[3] !== '--confirm') {
  console.error('Usage: npm run admin:grant -w server -- user@example.com --confirm');
  process.exitCode = 1;
} else {
  try {
    await connectDatabase(parseEnv());
    if (mongoose.connection.readyState !== 1) throw new Error('DatabaseUnavailable');
    const user = await User.findOneAndUpdate({ email, status: 'active' }, { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } });
    if (!user) throw new Error('ActiveAccountNotFound');
    console.log('Administrator role granted. Sign in again; previous sessions were revoked.');
  } catch { console.error('Could not grant administrator access. Verify the database connection and an existing active account.'); process.exitCode = 1; }
  finally { await disconnectDatabase(); }
}
