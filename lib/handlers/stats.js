/* GET /api/stats — admin dashboard metrics. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { getAllCases } from './cases.js';
import { ensureActiveUser } from './_util.js';

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const session = requireAuth(req, res, ['admin']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const cases = await getAllCases();

    const todayKey = new Date().toDateString();
    let newToday = 0;
    let waiting = 0;
    let inReview = 0;
    const byGoal = {};
    const byStatus = {};
    const planTimes = []; // hours createdAt → plan.at, over plan_sent/closed cases WITH a plan

    for (const c of cases) {
      if (new Date(c.createdAt).toDateString() === todayKey) newToday += 1;
      if (c.status === 'new') waiting += 1;
      if (c.status === 'in_review') inReview += 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      const goal = (c.intake || {}).goal || 'unknown';
      byGoal[goal] = (byGoal[goal] || 0) + 1;
      if ((c.status === 'plan_sent' || c.status === 'closed') && c.plan && c.plan.at) {
        planTimes.push((new Date(c.plan.at) - new Date(c.createdAt)) / 3600000);
      }
    }

    const avgHoursToPlan = planTimes.length
      ? Math.round((planTimes.reduce((a, b) => a + b, 0) / planTimes.length) * 10) / 10
      : null;
    const pctWithin24h = planTimes.length
      ? Math.round((planTimes.filter((h) => h <= 24).length / planTimes.length) * 100)
      : null;

    /* per-doctor load */
    const files = await db.list('users/');
    const perDoctor = [];
    for (let i = 0; i < files.length; i += 25) {
      const batch = await Promise.all(files.slice(i, i + 25).map((f) => db.get(f.path)));
      for (const u of batch) {
        if (!u) continue;
        let open = 0;
        let planSentTotal = 0;
        for (const c of cases) {
          if (c.assignedTo !== u.id) continue;
          if (c.status === 'in_review' || c.status === 'awaiting_patient') open += 1;
          if (c.plan && (c.status === 'plan_sent' || c.status === 'closed')) planSentTotal += 1;
        }
        perDoctor.push({ id: u.id, name: u.name, open, planSentTotal });
      }
    }

    sendJson(res, 200, {
      newToday, waiting, inReview, avgHoursToPlan, pctWithin24h, byGoal, byStatus, perDoctor,
    });
  });
}
