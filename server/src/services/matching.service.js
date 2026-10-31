import { Report, publicReport } from '../models/Report.js';
import { Match } from '../models/Match.js';
import { Notification } from '../models/Notification.js';

const words = (value) => new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []);
const overlap = (a, b) => { const x = words(a); const y = words(b); return x.size && y.size ? [...x].filter((v) => y.has(v)).length / Math.max(x.size, y.size) : 0; };
export function fallbackScore(a, b) {
  const category = a.category === b.category ? 25 : 0;
  const colour = overlap(a.colour, b.colour) * 15;
  const location = overlap(a.location, b.location) * 15;
  const description = overlap(`${a.title} ${a.description} ${(a.analysis?.keywords || []).join(' ')}`, `${b.title} ${b.description} ${(b.analysis?.keywords || []).join(' ')}`) * 35;
  const days = Math.abs(new Date(a.occurredAt) - new Date(b.occurredAt)) / 86400000;
  const score = Math.round(category + colour + location + description + Math.max(0, 10 - days / 3));
  return { score, explanation: `${category ? 'Same category. ' : ''}${colour ? 'Colour overlaps. ' : ''}${location ? 'Location overlaps. ' : ''}${description ? 'Some item details overlap. ' : ''}Dates are ${Math.round(days)} days apart. Compare the details; similarity does not verify ownership.` };
}

export function createMatching(ai) {
  const running = new Map();
  async function calculate(source) {
    // Bounded candidate retrieval and one batch AI request, never all-pairs comparison.
    const pool = await Report.find({ type: source.type === 'lost' ? 'found' : 'lost', owner: { $ne: source.owner }, status: 'open', moderation: 'visible', deletedAt: null, ...(source.category !== 'other' && { category: { $in: [source.category, 'other'] } }),
      occurredAt: { $gte: new Date(new Date(source.occurredAt).getTime() - 90 * 86400000), $lte: new Date(new Date(source.occurredAt).getTime() + 90 * 86400000) },
    }).sort({ createdAt: -1 }).limit(100).lean();
    const candidates = pool.map((report) => ({ report, ...fallbackScore(source, report) })).sort((a, b) => b.score - a.score).slice(0, 8);
    const cache = await Match.find({ source: source._id, sourceRevision: source.revision, expiresAt: { $gt: new Date() } }).lean();
    const stale = candidates.filter((c) => !cache.some((m) => String(m.candidate) === String(c.report._id) && m.candidateRevision === c.report.revision));
    const ranked = stale.length ? await ai.rank(source, stale.map((c) => c.report)) : null;
    const now = new Date();
    for (const candidate of candidates) {
      if (!stale.includes(candidate)) continue;
      const semantic = ranked?.find((r) => r.id === String(candidate.report._id));
      const existing = await Match.findOne({ source: source._id, candidate: candidate.report._id });
      const record = { score: semantic ? Math.round(semantic.score * .7 + candidate.score * .3) : candidate.score,
        explanation: semantic?.explanation || candidate.explanation, method: semantic ? 'gemini' : 'fallback', algorithmVersion: 'hybrid-v1',
        sourceRevision: source.revision, candidateRevision: candidate.report.revision, expiresAt: new Date(now.getTime() + 86400000) };
      await Match.updateOne({ source: source._id, candidate: candidate.report._id }, { $set: record }, { upsert: true });
      if (!existing && record.score >= 40) await Notification.create({ recipient: source.owner, kind: 'match', title: 'A possible match', message: `New similarity suggestion for “${source.title}”.`, href: `/reports/${source._id}` });
    }
    await Report.updateOne({ _id: source._id, revision: source.revision }, { $set: { matchesCheckedAt: now } });
  }
  return async function matches(source) {
    if (source.status !== 'open' || source.moderation !== 'visible') return [];
    const key = String(source._id);
    if (!source.matchesCheckedAt || Date.now() - new Date(source.matchesCheckedAt) > 15 * 60000) {
      if (!running.has(key)) running.set(key, calculate(source).finally(() => running.delete(key)));
      await running.get(key);
    }
    const rows = await Match.find({ source: source._id, sourceRevision: source.revision, expiresAt: { $gt: new Date() } }).sort({ score: -1 }).limit(8).populate('candidate').lean();
    return rows.filter((m) => m.candidate && m.candidate.status === 'open' && m.candidate.moderation === 'visible' && !m.candidate.deletedAt && m.candidate.revision === m.candidateRevision).map((m) => ({ id: String(m._id), score: m.score, explanation: m.explanation, method: m.method, interested: m.interestedBy.some((id) => String(id) === String(source.owner)), report: publicReport(m.candidate) }));
  };
}
