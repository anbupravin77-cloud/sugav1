/* POST /api/cases/<id>/prescription — draft, approve, or discard a prescription.
   A draft NEVER reaches the patient until a physician approves it. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import {
  pathParam, isCaseId, withLock, readJsonSafe, ensureActiveUser,
} from './_util.js';
import { getProtocol, isConfigured, buildDraft } from '../prescribing.js';

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const id = pathParam(req, 2, 'id');
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });

    const body = await readJsonSafe(req, res);
    const action = String(body.action || '');

    const updated = await withLock(id, async () => {
      const path = 'cases/' + id + '.json';
      const c = await db.get(path);
      if (!c) return { err: 404, msg: 'Case not found.' };

      /* doctors may only act on their own cases; admins on any */
      if (session.role !== 'admin' && c.assignedTo && c.assignedTo !== session.uid) {
        return { err: 403, msg: 'This case is assigned to someone else.' };
      }
      if (c.assessment && c.assessment.excluded) {
        return { err: 400, msg: 'This patient is excluded from treatment — no prescription can be issued.' };
      }

      const now = new Date().toISOString();
      c.audit = c.audit || [];

      if (action === 'draft') {
        const protocol = await getProtocol();
        if (!isConfigured(protocol)) {
          return { err: 400, msg: 'No prescribing protocol configured yet. Set the drug and dose ladder in Admin first.' };
        }
        const step = Number.isInteger(body.stepIndex) ? body.stepIndex : 0;
        c.prescription = buildDraft(protocol, step, {
          generatedBy: session.name,
          reason: 'Drafted by ' + session.name + '.',
        });
        c.audit.push({ at: now, who: session.name, action: 'drafted prescription #' + c.prescription.number });
      } else if (action === 'approve') {
        if (!c.prescription || c.prescription.status !== 'draft') {
          return { err: 400, msg: 'There is no draft prescription to approve.' };
        }
        c.prescription.status = 'approved';
        c.prescription.approvedBy = session.name;
        c.prescription.approvedAt = now;
        c.status = 'plan_sent';
        /* next review is due one interval from approval */
        const days = c.prescription.reviewIntervalDays || 30;
        c.nextReviewDue = new Date(Date.now() + days * 86400000).toISOString();
        c.audit.push({
          at: now, who: session.name,
          action: 'approved prescription #' + c.prescription.number + ' (' + c.prescription.drug + ' ' + c.prescription.dose + ')',
        });
      } else if (action === 'discard') {
        if (!c.prescription) return { err: 400, msg: 'There is no prescription on this case.' };
        const n = c.prescription.number;
        c.prescription = null;
        c.audit.push({ at: now, who: session.name, action: 'discarded prescription draft #' + n });
      } else {
        return { err: 400, msg: 'Unknown action.' };
      }

      c.updatedAt = now;
      await db.put(path, c);
      return { case: c };
    });

    if (updated.err) return sendJson(res, updated.err, { error: updated.msg });
    sendJson(res, 200, { case: updated.case });
  });
}
