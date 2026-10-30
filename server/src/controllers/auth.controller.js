import { User, publicUser } from '../models/User.js';
import { cookieOptions, loginUser, registerUser, SESSION_COOKIE, setSession } from '../services/auth.service.js';

export const authController = (env) => ({
  async register(req, res) {
    const user = await registerUser(req.validated);
    setSession(res, user, env);
    res.status(201).json({ success: true, data: { user: publicUser(user) } });
  },
  async login(req, res) {
    const user = await loginUser(req.validated);
    setSession(res, user, env);
    res.json({ success: true, data: { user: publicUser(user) } });
  },
  async logout(req, res) {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.clearCookie(SESSION_COOKIE, cookieOptions(env));
    res.json({ success: true, data: { message: 'Signed out of all sessions.' } });
  },
  me(req, res) { res.json({ success: true, data: { user: publicUser(req.user) } }); },
});
