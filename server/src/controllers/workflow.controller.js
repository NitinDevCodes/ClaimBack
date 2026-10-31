import { z } from 'zod';
import { Claim, Report, User, Notification, Match } from '../models/index.js';
import { publicReport } from '../models/Report.js';
import { parse, idSchema, paginated } from '../utils/query.js';
import { AppError } from '../utils/AppError.js';
import { submitClaim, transitionClaim } from '../services/claims.service.js';

function claimView(c) { return { id: String(c._id), reportId: String(c.report), status: c.status, createdAt: c.createdAt, handoverAt: c.handoverAt, ...(c.privateEvidence !== undefined && { privateEvidence: c.privateEvidence }), ...(c.history && { history: c.history.map((h) => ({ status: h.status, reason: h.reason, at: h.at })) }) }; }
export const workflow = {
  async submit(req, res) {
    const fields = parse(z.object({ reportId: idSchema, lostReportId: idSchema.optional(), privateEvidence: z.string().trim().min(20).max(5000) }).strict(), req.body);
    const claim = await submitClaim(req.user, fields.reportId, fields.privateEvidence, fields.lostReportId);
    res.status(201).json({ success: true, data: claimView(claim) });
  },
  async claims(req, res) {
    const filters = req.user.role === 'admin' && req.query.scope === 'review' ? {} : { claimant: req.user._id };
    if (req.query.status) filters.status = parse(z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'handed_over']), req.query.status);
    const result = await paginated(Claim, filters, req.query);
    res.json({ success: true, data: { ...result, items: result.items.map(claimView) } });
  },
  async claim(req, res) {
    const filter = { _id: parse(idSchema, req.params.id), ...(req.user.role !== 'admin' && { claimant: req.user._id }) };
    const claim = await Claim.findOne(filter).select('+privateEvidence +history');
    if (!claim) throw new AppError(404, 'NOT_FOUND', 'Claim not found.');
    const report = await Report.findById(claim.report);
    let contacts;
    if (req.user.role === 'admin') {
      const [claimant, finder] = await Promise.all([User.findById(claim.claimant).select('name email'), report ? User.findById(report.owner).select('name email') : null]);
      contacts = { claimant: claimant ? { name: claimant.name, email: claimant.email } : null, finder: finder ? { name: finder.name, email: finder.email } : null };
    }
    res.json({ success: true, data: { ...claimView(claim), lostReportId: claim.lostReport?.toString(), report: report ? publicReport(report) : null, ...(contacts && { contacts }) } });
  },
  async transition(req, res) {
    const { action, reason } = parse(z.object({ action: z.enum(['approve', 'reject', 'withdraw', 'handover']), reason: z.string().trim().min(5).max(1000) }).strict(), req.body);
    res.json({ success: true, data: claimView(await transitionClaim(req.user, parse(idSchema, req.params.id), action, reason)) });
  },
  async dashboard(req, res) {
    const owner = req.user._id;
    const [reports, claims, notifications, recent, suggested] = await Promise.all([
      Report.aggregate([{ $match: { owner, deletedAt: null } }, { $group: { _id: '$type', total: { $sum: 1 }, recovered: { $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0] } } } }]),
      Claim.aggregate([{ $match: { claimant: owner } }, { $group: { _id: '$status', total: { $sum: 1 } } }]),
      Notification.countDocuments({ recipient: owner, readAt: null }),
      Report.find({ owner, deletedAt: null }).sort({ createdAt: -1 }).limit(6),
      Report.find({ owner, deletedAt: null, status: 'open', moderation: 'visible' }).select('_id title').sort({ updatedAt: -1 }).limit(6),
    ]);
    const matches = await Match.find({ source: { $in: suggested.map((r) => r._id) }, expiresAt: { $gt: new Date() } }).sort({ score: -1 }).limit(12).populate('source candidate');
    res.json({ success: true, data: { reports, claims, unreadNotifications: notifications, recent: recent.map((r) => ({ ...publicReport(r), moderation: r.moderation })), matches: matches.filter((m) => m.source && m.candidate && !m.candidate.deletedAt && m.candidate.moderation === 'visible' && m.candidate.status === 'open' && m.sourceRevision === m.source.revision && m.candidateRevision === m.candidate.revision).slice(0, 6).map((m) => ({ id: m.id, sourceId: m.source.id, sourceTitle: m.source.title, score: m.score, explanation: m.explanation, method: m.method, report: publicReport(m.candidate) })) } });
  },
  async notifications(req, res) {
    const result = await paginated(Notification, { recipient: req.user._id }, req.query, '-recipient');
    res.json({ success: true, data: { ...result, unread: await Notification.countDocuments({ recipient: req.user._id, readAt: null }) } });
  },
  async readNotification(req, res) {
    parse(z.object({}).strict(), req.body);
    if (req.params.id === 'all') await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    else {
      const result = await Notification.findOneAndUpdate({ _id: parse(idSchema, req.params.id), recipient: req.user._id }, { $set: { readAt: new Date() } });
      if (!result) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
    }
    res.json({ success: true, data: { read: true } });
  },
};
