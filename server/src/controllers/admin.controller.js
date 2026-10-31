import { z } from 'zod';
import { User, Report, Claim, Notification, Match } from '../models/index.js';
import { publicReport } from '../models/Report.js';
import { parse, idSchema, paginated, escapeRegex } from '../utils/query.js';
import { AppError } from '../utils/AppError.js';
export const admin = {
  async stats(req, res) {
    const [users, reports, claims, categories] = await Promise.all([User.countDocuments(), Report.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$type', total: { $sum: 1 } } }]), Claim.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]), Report.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$category', total: { $sum: 1 } } }, { $sort: { total: -1 } }])]);
    res.json({ success: true, data: { users, reports, claims, categories } });
  },
  async users(req, res) {
    const q = parse(z.string().max(100).default(''), req.query.q);
    const result = await paginated(User, q ? { $or: [{ email: { $regex: escapeRegex(q), $options: 'i' } }, { name: { $regex: escapeRegex(q), $options: 'i' } }] } : {}, req.query, 'name email role status createdAt');
    res.json({ success: true, data: result });
  },
  async userStatus(req, res) {
    const { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }).strict(), req.body);
    const id = parse(idSchema, req.params.id);
    // Admin privileges cannot be removed through the dashboard; prevents last-admin lockout.
    const user = await User.findOneAndUpdate({ _id: id, role: 'user' }, { $set: { status }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new AppError(409, 'USER_PROTECTED', 'Only regular user accounts can be suspended or reactivated here.');
    res.json({ success: true, data: { id: user.id, status: user.status } });
  },
  async reports(req, res) {
    const filter = { deletedAt: null };
    if (req.query.moderation) filter.moderation = parse(z.enum(['hidden', 'visible']), req.query.moderation);
    const result = await paginated(Report, filter, req.query);
    res.json({ success: true, data: { ...result, items: result.items.map((r) => ({ ...publicReport(r), moderation: r.moderation })) } });
  },
  async moderate(req, res) {
    const { moderation, reason } = parse(z.object({ moderation: z.enum(['visible', 'hidden']), reason: z.string().trim().min(5).max(300) }).strict(), req.body);
    const report = await Report.findOneAndUpdate({ _id: parse(idSchema, req.params.id), deletedAt: null }, { $set: { moderation }, $inc: { revision: 1 }, $unset: { matchesCheckedAt: 1 } }, { new: true });
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    await Match.deleteMany({ $or: [{ source: report._id }, { candidate: report._id }] });
    await Notification.create({ recipient: report.owner, kind: 'system', title: 'Report moderation update', message: `Your report is ${moderation}. ${reason}`, href: '/dashboard' });
    res.json({ success: true, data: { ...publicReport(report), moderation } });
  },
};
