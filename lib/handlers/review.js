/* POST /api/cases/<id>/review — record a monthly review (protocol steps 6–7).

   History: any abdominal symptoms — if so, severe?
     severe  → physician consult for dosage review (no auto-escalation)
     not     → escalate the dose and draft the next prescription
   Then loop again next month. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import {
  pathParam, isCaseId, withLock, readJsonSafe, ensureActiveUser,
} from './_util.js';
import { getProtocol, isConfigured, buildDraft } from '../prescribing.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const id = pathParam(req, 2, 'id');
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });

    const body = await readJsonSafe(req, res);
    const hasSymptoms = body.abdominalSymptoms === true;
    const severe = body.severe === true;
    const notes = String(body.notes == null ? '' : body.notes).trim().slice(0, 4000);

    /* observations the protocol asks for at review: weight, pulse, BP */
    const weightKg = num(body.weightKg);
    const pulse = num(body.pulse);
    const bp = String(body.bp == null ? '' : body.bp).trim().slice(0, 20);
    if (weightKg !== null && (weightKg < 30 || weightKg > 350)) {
      return sendJson(res, 400, { error: 'Weight must be between 30 and 350 kg.' });
    }
    if (pulse !== null && (pulse < 25 || pulse > 220)) {
      return sendJson(res, 400, { error: 'Pulse must be between 25 and 220 bpm.' });
    }

    const result = await withLock(id, async () => {
      const path = 'cases/' + id + '.json';
      const c = await db.get(path);
      if (!c) return { err: 404, msg: 'Case not found.' };
      if (session.role !== 'admin' && c.assignedTo && c.assignedTo !== session.uid) {
        return { err: 403, msg: 'This case is assigned to someone else.' };
      }
      if (c.assessment && c.assessment.excluded) {
        return { err: 400, msg: 'This patient is excluded from treatment.' };
      }
      if (!c.prescription || c.prescription.status !== 'approved') {
        return { err: 400, msg: 'Approve a prescription before recording a review.' };
      }

      const now = new Date().toISOString();
      c.reviews = c.reviews || [];
      c.audit = c.audit || [];

      const review = {
        n: c.reviews.length + 1,
        at: now,
        by: session.name,
        abdominalSymptoms: hasSymptoms,
        severe: hasSymptoms ? severe : false,
        weightKg, pulse, bp,
        notes,
        outcome: '',
      };

      if (hasSymptoms && severe) {
        /* protocol: severe symptoms → physician consult for dosage review */
        review.outcome = 'physician-consult';
        c.status = 'in_review';
        c.priority = true;
        c.assessment = c.assessment || { flags: [], requiresPhysician: false, excluded: null };
        c.assessment.flags = (c.assessment.flags || []).concat([{
          code: 'review-severe-symptoms',
          label: 'Severe abdominal symptoms at review ' + review.n,
          why: 'Reported severe abdominal symptoms — dosage review required before escalation.',
        }]);
        c.assessment.requiresPhysician = true;
        c.audit.push({ at: now, who: session.name, action: 'review ' + review.n + ': severe symptoms — flagged for dosage review' });
      } else {
        /* protocol: escalate the dose and generate the next prescription */
        const protocol = await getProtocol();
        if (!isConfigured(protocol)) {
          return { err: 400, msg: 'No prescribing protocol configured — cannot escalate the dose.' };
        }
        const currentStep = c.prescription.stepIndex || 0;
        if (currentStep >= protocol.doseLadder.length - 1) {
          review.outcome = 'at-final-dose';
          c.status = 'in_review';
          c.audit.push({ at: now, who: session.name, action: 'review ' + review.n + ': already at the final dose step — physician decision needed' });
        } else {
          review.outcome = 'dose-escalated';
          c.prescription = buildDraft(protocol, currentStep + 1, {
            generatedBy: session.name,
            reason: 'Dose escalated at review ' + review.n + ' — no severe symptoms reported.',
          });
          c.status = 'in_review';
          c.audit.push({
            at: now, who: session.name,
            action: 'review ' + review.n + ': no severe symptoms — dose escalated, prescription #' + c.prescription.number + ' drafted',
          });
        }
      }

      c.reviews.push(review);
      c.lastReviewAt = now;
      c.nextReviewDue = null;
      c.updatedAt = now;
      await db.put(path, c);
      return { case: c, review };
    });

    if (result.err) return sendJson(res, result.err, { error: result.msg });
    sendJson(res, 200, { case: result.case, review: result.review });
  });
}
