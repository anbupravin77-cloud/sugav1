/* GET /api/cases — worklist summaries with filters + status counts. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard, getUrl } from '../http.js';
import { ensureActiveUser } from './_util.js';

const FLAG_CODES = ['I25.10', 'I48.91', 'I63.9', 'N18.9', 'E10.9', 'Z86.711', 'B18.2'];
const STATUSES = ['new', 'in_review', 'awaiting_patient', 'plan_sent', 'excluded', 'closed'];

/* db.get in parallel batches so a big store doesn't open 1000 files at once */
export async function getAllCases() {
  const files = await db.list('cases/');
  files.sort((a, b) => (a.path < b.path ? 1 : a.path > b.path ? -1 : 0)); // newest first
  const out = [];
  for (let i = 0; i < files.length; i += 25) {
    const batch = await Promise.all(files.slice(i, i + 25).map((f) => db.get(f.path)));
    for (const c of batch) if (c) out.push(c);
  }
  return out;
}

function summarize(c) {
  const it = c.intake || {};
  const codes = (it.conditions || []).map((x) => x && x.code).filter(Boolean);
  return {
    id: c.id,
    ref: c.ref,
    status: c.status,
    priority: !!c.priority,
    assignedTo: c.assignedTo || null,
    assignedName: c.assignedName || null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    goal: it.goal,
    name: it.name,
    age: it.age,
    sex: it.sex,
    bmi: it.bmi,
    bmiBand: it.bmiBand,
    conditionCount: (it.conditions || []).length,
    allergyCount: (it.allergies || []).length,
    medicationCount: (it.medications || []).length,
    flags: FLAG_CODES.filter((f) => codes.includes(f)),
    noteCount: (c.notes || []).length,
    hasPlan: !!c.plan,
    /* protocol screening + prescribing state */
    requiresPhysician: !!(c.assessment && c.assessment.requiresPhysician),
    excluded: !!(c.assessment && c.assessment.excluded),
    protocolFlags: ((c.assessment && c.assessment.flags) || []).map((f) => f.label),
    rxStatus: (c.prescription && c.prescription.status) || null,
    rxNumber: (c.prescription && c.prescription.number) || null,
    reviewCount: (c.reviews || []).length,
  };
}

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const sp = getUrl(req).searchParams;
    const statusFilter = String(sp.get('status') || '')
      .split(',').map((s) => s.trim()).filter((s) => STATUSES.includes(s));
    const goal = String(sp.get('goal') || '').trim();
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const mine = sp.get('mine') === '1';
    let limit = parseInt(sp.get('limit') || '60', 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 60;
    if (limit > 200) limit = 200;

    const all = await getAllCases();

    /* counts over ALL cases (filters do not apply here) */
    const counts = { new: 0, in_review: 0, awaiting_patient: 0, plan_sent: 0, excluded: 0, closed: 0, mine: 0 };
    for (const c of all) {
      if (counts[c.status] !== undefined) counts[c.status] += 1;
      if (c.assignedTo === session.uid && (c.status === 'in_review' || c.status === 'awaiting_patient')) counts.mine += 1;
    }

    const cases = all.filter((c) => {
      if (statusFilter.length && !statusFilter.includes(c.status)) return false;
      if (goal && (c.intake || {}).goal !== goal) return false;
      if (mine && c.assignedTo !== session.uid) return false;
      if (q) {
        const name = String((c.intake || {}).name || '').toLowerCase();
        const ref = String(c.ref || '').toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    }).slice(0, limit).map(summarize);

    sendJson(res, 200, { cases, counts });
  });
}
