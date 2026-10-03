/* POST /api/cases/<id>/plan — record the treatment plan; moves status to plan_sent. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { pathParam, isCaseId, withLock, ensureActiveUser, readJsonSafe } from './_util.js';

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const id = pathParam(req, 2, 'id'); // api/cases/<id>/plan
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });
    const key = 'cases/' + id + '.json';

    const body = await readJsonSafe(req, res);
    const text = String(body.text || '').trim();
    if (text.length < 10 || text.length > 8000) {
      return sendJson(res, 400, { error: 'Plan must be between 10 and 8000 characters.' });
    }

    await withLock(key, async () => {
      const c = await db.get(key);
      if (!c) return sendJson(res, 404, { error: 'Case not found.' });

      if (session.role !== 'admin' && c.assignedTo !== session.uid) {
        return sendJson(res, 403, { error: 'You can only record a plan on cases assigned to you.' });
      }
      if (c.status === 'closed' && session.role !== 'admin') {
        return sendJson(res, 403, { error: 'Only an admin can reopen a closed case.' });
      }

      const now = new Date().toISOString();
      c.plan = { text, authorName: session.name, at: now };
      c.status = 'plan_sent';
      c.audit = c.audit || [];
      c.audit.push({ at: now, who: session.name, action: 'recorded the plan' });
      c.updatedAt = now;

      await db.put(key, c);
      sendJson(res, 200, c);
    });
  });
}
