import mongoose from 'mongoose';
import { Claim } from '../models/Claim.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';

async function transaction(operation) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => operation(session)); }
  finally { await session.endSession(); }
}
const conflict = (message) => new AppError(409, 'CLAIM_CONFLICT', message);
async function notice(session, recipient, title, message, href, kind = 'claim') {
  await Notification.create([{ recipient, title, message, href, kind }], { session });
}
export async function submitClaim(user, reportId, privateEvidence, lostReportId) {
  return transaction(async (session) => {
    // All claim/report transitions write the report, serializing competing operations.
    const report = await Report.findOneAndUpdate({ _id: reportId, owner: { $ne: user._id }, type: 'found', status: 'open', moderation: 'visible', deletedAt: null }, { $inc: { revision: 1 } }, { new: true, session });
    if (!report) throw conflict('This found report is unavailable or belongs to you.');
    if (lostReportId && !await Report.exists({ _id: lostReportId, owner: user._id, type: 'lost', status: 'open', deletedAt: null }).session(session)) throw conflict('The linked lost report must be your own open report.');
    const [claim] = await Claim.create([{ report: report._id, lostReport: lostReportId, claimant: user._id, privateEvidence, history: [{ actor: user._id, status: 'pending', reason: 'Claim submitted.' }] }], { session });
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').limit(100).session(session);
    for (const admin of admins) await notice(session, admin._id, 'Ownership claim awaiting review', `A claim was submitted for “${report.title}”. Review the private evidence.`, `/claims/${claim._id}`);
    await notice(session, report.owner, 'A claim was submitted', `A private ownership claim for “${report.title}” is awaiting administrator review.`, `/reports/${report._id}`);
    return claim;
  });
}
export async function transitionClaim(user, claimId, action, reason) {
  return transaction(async (session) => {
    const claim = await Claim.findById(claimId).select('+history').session(session);
    if (!claim || (action === 'withdraw' && String(claim.claimant) !== String(user._id))) throw new AppError(404, 'NOT_FOUND', 'Claim not found.');
    if (action !== 'withdraw' && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'An administrator must review this claim.');
    const nextStatus = { approve: 'approved', reject: 'rejected', withdraw: 'withdrawn', handover: 'handed_over' }[action];
    if (claim.status !== (action === 'handover' ? 'approved' : 'pending')) throw conflict('This claim has already changed. Reload it before continuing.');
    const report = await Report.findOne({ _id: claim.report, deletedAt: null }).session(session);
    if (!report) throw conflict('The report is unavailable.');
    if (action !== 'withdraw' && [claim.claimant, report.owner].some((id) => String(id) === String(user._id))) throw new AppError(403, 'INDEPENDENT_REVIEW_REQUIRED', 'A different administrator must review claims involving their own items or evidence.');
    if (action === 'approve' && (report.status !== 'open' || report.moderation !== 'visible')) throw conflict('Only a visible, open report can be reserved.');
    if (action === 'handover' && report.status !== 'reserved') throw conflict('The report is not reserved for handover.');
    const update = { $inc: { revision: 1 } };
    if (action === 'approve') update.$set = { status: 'reserved' };
    if (action === 'handover') update.$set = { status: 'recovered' };
    await Report.updateOne({ _id: report._id }, update, { session });
    if (claim.lostReport && ['approve', 'handover'].includes(action)) {
      const linked = await Report.updateOne({ _id: claim.lostReport, owner: claim.claimant, type: 'lost', deletedAt: null, status: action === 'approve' ? 'open' : 'reserved' }, { $set: { status: action === 'approve' ? 'reserved' : 'recovered' }, $inc: { revision: 1 } }, { session });
      if (!linked.modifiedCount) throw conflict('The linked lost report changed or is reserved by another claim.');
    }
    claim.status = nextStatus;
    claim.history.push({ actor: user._id, status: nextStatus, reason });
    if (action !== 'withdraw') claim.reviewedBy = user._id;
    if (action === 'handover') claim.handoverAt = new Date();
    await claim.save({ session });
    if (action === 'approve') {
      const competitors = await Claim.find({ report: report._id, _id: { $ne: claim._id }, status: 'pending' }).session(session);
      await Claim.updateMany({ report: report._id, _id: { $ne: claim._id }, status: 'pending' }, { $set: { status: 'rejected', reviewedBy: user._id }, $push: { history: { actor: user._id, status: 'rejected', reason: 'Another claim was approved after human review.', at: new Date() } } }, { session });
      for (const other of competitors) await notice(session, other.claimant, 'Claim reviewed', 'Another ownership claim was approved after human review.', `/claims/${other._id}`);
    }
    for (const recipient of [claim.claimant, report.owner]) await notice(session, recipient, action === 'handover' ? 'Recovery recorded' : 'Claim updated', `The claim for “${report.title}” is now ${nextStatus.replaceAll('_', ' ')}.`, String(recipient) === String(claim.claimant) ? `/claims/${claim._id}` : `/reports/${report._id}`, action === 'handover' ? 'recovery' : 'claim');
    return claim;
  });
}
