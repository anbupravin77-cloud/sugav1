/* POST /api/cases/<id>/notes — add a private clinical note. */
import crypto from 'node:crypto';
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

    const id = pathParam(req, 2, 'id'); // api/cases/<id>/notes
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });
    const key = 'cases/' + id + '.json';

    const body = await readJsonSafe(req, res);
    const text = String(body.text || '').trim();
    if (text.length < 1 || text.length > 4000) {
      return sendJson(res, 400, { error: 'Note must be between 1 and 4000 characters.' });
    }

    await withLock(key, async () => {
      const c = await db.get(key);
      if (!c) return sendJson(res, 404, { error: 'Case not found.' });

      /* non-admins may not write on a case assigned to someone else */
      if (session.role !== 'admin' && c.assignedTo && c.assignedTo !== session.uid) {
        return sendJson(res, 403, { error: 'This case is assigned to ' + (c.assignedName || 'someone else') + '.' });
      }

      const now = new Date().toISOString();
      c.notes = c.notes || [];
      c.notes.push({
        id: 'n_' + crypto.randomBytes(6).toString('hex'),
        authorId: session.uid,
        authorName: session.name,
        text,
        at: now,
      });
      c.audit = c.audit || [];
      c.audit.push({ at: now, who: session.name, action: 'added a note' });
      c.updatedAt = now;

      await db.put(key, c);
      sendJson(res, 200, c);
    });
  });
}
