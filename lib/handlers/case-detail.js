/* GET/PATCH /api/cases/<id> — full chart + workflow actions. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { pathParam, isCaseId, isUserId, withLock, ensureActiveUser, readJsonSafe } from './_util.js';

const STATUSES = ['new', 'in_review', 'awaiting_patient', 'plan_sent', 'excluded', 'closed'];

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'GET' && req.method !== 'PATCH') {
      return methodNotAllowed(res, ['GET', 'PATCH']);
    }
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const id = pathParam(req, 2, 'id'); // api/cases/<id>
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });
    const key = 'cases/' + id + '.json';

    if (req.method === 'GET') {
      const c = await db.get(key);
      if (!c) return sendJson(res, 404, { error: 'Case not found.' });
      return sendJson(res, 200, c);
    }

    const body = await readJsonSafe(req, res);
    const action = String(body.action || '');
    const isAdmin = session.role === 'admin';

    /* all mutations run under a per-case lock so concurrent writers
       (status vs note vs plan) can never drop each other's changes */
    await withLock(key, async () => {
      const c = await db.get(key);
      if (!c) return sendJson(res, 404, { error: 'Case not found.' });

      const now = new Date().toISOString();
      const audit = (what) => {
        c.audit = c.audit || [];
        c.audit.push({ at: now, who: session.name, action: what });
        c.updatedAt = now;
      };

      if (action === 'claim') {
        if (c.assignedTo && c.assignedTo !== session.uid) {
          return sendJson(res, 409, { error: 'Already claimed by ' + (c.assignedName || 'another doctor') + '.' });
        }
        c.assignedTo = session.uid;
        c.assignedName = session.name;
        if (c.status === 'new') c.status = 'in_review';
        audit('claimed the case');
        await db.put(key, c);
        return sendJson(res, 200, c);
      }

      /* every other action: non-admins may not touch a case assigned to someone else */
      if (!isAdmin && c.assignedTo && c.assignedTo !== session.uid) {
        return sendJson(res, 403, { error: 'This case is assigned to ' + (c.assignedName || 'someone else') + '.' });
      }

      if (action === 'release') {
        c.assignedTo = null;
        c.assignedName = null;
        if (c.status === 'in_review') c.status = 'new';
        audit('released the case');

      } else if (action === 'assign') {
        if (!isAdmin) return sendJson(res, 403, { error: 'Only an admin can assign cases.' });
        const doctorId = String(body.doctorId || '');
        if (!isUserId(doctorId)) return sendJson(res, 404, { error: 'No such doctor.' });
        const doctor = await db.get('users/' + doctorId + '.json');
        if (!doctor) return sendJson(res, 404, { error: 'No such doctor.' });
        if (!doctor.active) return sendJson(res, 400, { error: 'That account is deactivated.' });
        c.assignedTo = doctor.id;
        c.assignedName = doctor.name;
        if (c.status === 'new') c.status = 'in_review';
        audit('assigned the case to ' + doctor.name);

      } else if (action === 'status') {
        const next = String(body.status || '');
        if (!STATUSES.includes(next)) return sendJson(res, 400, { error: 'Invalid status.' });
        if (c.status === 'closed' && next !== 'closed' && !isAdmin) {
          return sendJson(res, 403, { error: 'Only an admin can reopen a closed case.' });
        }
        if (next === 'plan_sent' && !c.plan) {
          return sendJson(res, 400, { error: 'Record the plan first.' });
        }
        c.status = next;
        audit('changed status to ' + next);

      } else if (action === 'priority') {
        c.priority = !!body.priority;
        audit(c.priority ? 'marked the case priority' : 'removed the priority flag');

      } else {
        return sendJson(res, 400, { error: 'Unknown action.' });
      }

      await db.put(key, c);
      sendJson(res, 200, c);
    });
  });
}
