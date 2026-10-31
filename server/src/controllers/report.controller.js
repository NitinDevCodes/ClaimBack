import { z } from 'zod';
import mongoose from 'mongoose';
import { Report, categories, publicReport } from '../models/Report.js';
import { Claim } from '../models/Claim.js';
import { Match } from '../models/Match.js';
import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';
import { parse, idSchema, paginated, escapeRegex } from '../utils/query.js';
import { normalizeImages } from '../services/images.service.js';
import { attributesSchema } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';

const reportSchema = z.object({ type: z.enum(['lost', 'found']), title: z.string().trim().min(3).max(120), description: z.string().trim().min(10).max(3000), category: z.enum(categories), colour: z.string().trim().max(80).default(''), location: z.string().trim().min(2).max(200), occurredAt: z.coerce.date().refine((d) => d <= new Date(Date.now() + 86400000), 'Date cannot be in the future.') }).strict();
const editableSchema = reportSchema.omit({ type: true }).partial().extend({ colour: z.string().trim().max(80).optional(), revision: z.coerce.number().int().min(0), clearImages: z.enum(['true', 'false']).optional(), status: z.enum(['open', 'closed']).optional() }).strict();
const visible = { moderation: 'visible', deletedAt: null };
export async function ownedReport(req) {
  const report = await Report.findOne({ _id: parse(idSchema, req.params.id), owner: req.user._id, deletedAt: null });
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
  return report;
}
export function reportController({ ai, images, matching }) {
  return {
    async manage(req, res) { const report = await ownedReport(req); res.json({ success: true, data: { ...publicReport(report), moderation: report.moderation } }); },
    async access(req, res) { res.json({ success: true, data: { isOwner: Boolean(await Report.exists({ _id: parse(idSchema, req.params.id), owner: req.user._id, deletedAt: null })) } }); },
    async browse(req, res) {
      const filters = parse(z.object({ type: z.enum(['lost', 'found']).optional(), category: z.enum(categories).optional(), status: z.enum(['open', 'recovered', 'closed']).default('open'), q: z.string().trim().max(120).optional(), location: z.string().trim().max(100).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }), req.query);
      const { q, location, from, to, ...filter } = filters;
      if (q) filter.$text = { $search: q };
      if (location) filter.location = { $regex: escapeRegex(location), $options: 'i' };
      if (from || to) filter.occurredAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
      const result = await paginated(Report, { ...visible, ...filter }, req.query);
      res.json({ success: true, data: { ...result, items: result.items.map(publicReport) } });
    },
    async detail(req, res) {
      const report = await Report.findOne({ _id: parse(idSchema, req.params.id), ...visible });
      if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
      res.json({ success: true, data: publicReport(report) });
    },
    async mine(req, res) {
      const filters = parse(z.object({ type: z.enum(['lost', 'found']).optional(), status: z.enum(['open', 'closed', 'reserved', 'recovered']).optional() }), req.query);
      const result = await paginated(Report, { owner: req.user._id, deletedAt: null, ...filters }, req.query);
      res.json({ success: true, data: { ...result, items: result.items.map((r) => ({ ...publicReport(r), moderation: r.moderation })) } });
    },
    async create(req, res) {
      const fields = parse(reportSchema, req.body);
      const buffers = await normalizeImages(req.files);
      const uploaded = [];
      let report;
      try {
        for (const buffer of buffers) uploaded.push(await images.upload(buffer));
        const analysis = await ai.analyze(fields, buffers);
        report = await Report.create({ ...fields, owner: req.user._id, images: uploaded, analysis });
      } catch (error) { await images.remove(uploaded); throw error; }
      // The report is durable even if matching fails. Suggestions can be retried separately.
      let suggestions = [], matchingStatus = 'complete';
      try { suggestions = await matching(report); } catch { matchingStatus = 'unavailable'; logger.error('matching_failed', { retry: 'report_matches_endpoint' }); }
      res.status(201).json({ success: true, data: { report: publicReport(report), matches: suggestions, matchingStatus } });
    },
    async update(req, res) {
      const fields = parse(editableSchema, req.body);
      const report = await ownedReport(req);
      if (['reserved', 'recovered'].includes(report.status)) throw new AppError(409, 'REPORT_LOCKED', 'Reports in a recovery workflow cannot be edited.');
      const buffers = await normalizeImages(req.files);
      const uploaded = [];
      let updated;
      try {
        for (const buffer of buffers) uploaded.push(await images.upload(buffer));
        const { revision, clearImages, ...changes } = fields;
        if (uploaded.length || clearImages === 'true') changes.images = uploaded;
        changes.analysis = await ai.analyze({ ...report.toObject(), ...changes }, buffers);
        const session = await mongoose.startSession();
        try { await session.withTransaction(async () => {
          if (await Claim.exists({ report: report._id, status: { $in: ['pending', 'approved'] } }).session(session)) throw new AppError(409, 'REPORT_LOCKED', 'A report with active claims cannot be edited.');
          updated = await Report.findOneAndUpdate({ _id: report._id, revision, status: { $in: ['open', 'closed'] }, deletedAt: null }, { $set: changes, $inc: { revision: 1 }, $unset: { matchesCheckedAt: 1 } }, { new: true, runValidators: true, session });
          if (!updated) throw new AppError(409, 'CONFLICT', 'The report changed. Reload it before saving.');
          await Match.deleteMany({ $or: [{ source: report._id }, { candidate: report._id }] }).session(session);
        }); } finally { await session.endSession(); }
      } catch (error) { await images.remove(uploaded); throw error; }
      if (uploaded.length || fields.clearImages === 'true') await images.remove(report.images);
      res.json({ success: true, data: publicReport(updated) });
    },
    async correct(req, res) {
      const { revision, attributes } = parse(z.object({ revision: z.number().int().min(0), attributes: attributesSchema }).strict(), req.body);
      const report = await ownedReport(req);
      let updated;
      const session = await mongoose.startSession();
      try { await session.withTransaction(async () => {
        if (await Claim.exists({ report: report._id, status: { $in: ['pending', 'approved'] } }).session(session)) throw new AppError(409, 'REPORT_LOCKED', 'A report with active claims cannot be edited.');
        updated = await Report.findOneAndUpdate({ _id: report._id, revision, status: { $in: ['open', 'closed'] }, deletedAt: null }, { $set: { analysis: { ...attributes, status: 'corrected', correctedAt: new Date() } }, $inc: { revision: 1 }, $unset: { matchesCheckedAt: 1 } }, { new: true, runValidators: true, session });
        if (!updated) throw new AppError(409, 'CONFLICT', 'The report changed or is locked. Reload it.');
        await Match.deleteMany({ $or: [{ source: report._id }, { candidate: report._id }] }).session(session);
      }); } finally { await session.endSession(); }
      res.json({ success: true, data: publicReport(updated) });
    },
    async remove(req, res) {
      parse(z.object({}).strict(), req.body);
      const report = await ownedReport(req);
      const session = await mongoose.startSession();
      try { await session.withTransaction(async () => {
        if (await Claim.exists({ report: report._id, status: { $in: ['pending', 'approved', 'handed_over'] } }).session(session)) throw new AppError(409, 'REPORT_LOCKED', 'Reports with active claims or recovery history cannot be deleted. Close other reports instead.');
        const result = await Report.updateOne({ _id: report._id, revision: report.revision, status: { $in: ['open', 'closed'] } }, { $set: { deletedAt: new Date(), status: 'closed', images: [] }, $inc: { revision: 1 } }, { session });
        if (!result.modifiedCount) throw new AppError(409, 'CONFLICT', 'The report changed or is locked.');
        await Match.deleteMany({ $or: [{ source: report._id }, { candidate: report._id }] }).session(session);
      }); } finally { await session.endSession(); }
      await images.remove(report.images);
      res.json({ success: true, data: { deleted: true } });
    },
    async matches(req, res) { res.json({ success: true, data: await matching(await ownedReport(req)) }); },
    async interest(req, res) {
      parse(z.object({}).strict(), req.body);
      const match = await Match.findById(parse(idSchema, req.params.matchId)).populate('source candidate');
      if (!match?.source || !match.candidate || String(match.source.owner) !== String(req.user._id)) throw new AppError(404, 'NOT_FOUND', 'Match not found.');
      if ([match.source, match.candidate].some((r) => r.deletedAt || r.status !== 'open' || r.moderation !== 'visible') || match.expiresAt <= new Date() || match.sourceRevision !== match.source.revision || match.candidateRevision !== match.candidate.revision) throw new AppError(409, 'STALE_MATCH', 'This match is no longer available. Refresh suggestions.');
      const changed = await Match.updateOne({ _id: match._id, interestedBy: { $ne: req.user._id } }, { $addToSet: { interestedBy: req.user._id } });
      if (changed.modifiedCount) await Notification.create({ recipient: match.candidate.owner, kind: 'interest', title: 'Interest in your report', message: 'Someone has a potentially matching report. Ownership still requires a private claim and human review.', href: `/reports/${match.source._id}` });
      res.json({ success: true, data: { interested: true } });
    },
  };
}
