import { publicUser } from '../models/User.js';

export async function updateProfile(req, res) {
  req.user.name = req.validated.name;
  await req.user.save();
  res.json({ success: true, data: { user: publicUser(req.user) } });
}
