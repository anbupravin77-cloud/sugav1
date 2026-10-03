/* POST /api/cases/<id>/ai-draft — AI-assisted drafting for the reviewing doctor.

   { kind: "summary" }  → a short clinical summary of the intake
   { kind: "letter"  }  → a plain-language message to the patient about the
                          plan the doctor has ALREADY decided

   The model never decides anything: it is handed the fixed decisions and asked
   to write them up. Nothing here changes the case — the doctor reads the draft,
   edits it, and saves it through the existing plan/notes endpoints. */
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import {
  pathParam, isCaseId, readJsonSafe, ensureActiveUser, tooMany, limiterKey,
} from './_util.js';
import { generate, summaryPrompt, planPrompt, SYSTEM, isConfigured } from '../gemini.js';

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = requireAuth(req, res, ['admin', 'doctor']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    if (!isConfigured()) {
      return sendJson(res, 503, { error: 'AI drafting is not configured on this server.' });
    }
    /* protect the shared free-tier quota from one busy account */
    if (tooMany('ai:' + session.uid, 30, 60 * 60 * 1000)) {
      return sendJson(res, 429, { error: 'You have used a lot of AI drafts this hour. Please try again later.' });
    }

    const id = pathParam(req, 2, 'id');
    if (!isCaseId(id)) return sendJson(res, 404, { error: 'Case not found.' });

    const body = await readJsonSafe(req, res);
    const kind = body.kind === 'letter' ? 'letter' : 'summary';

    const c = await db.get('cases/' + id + '.json');
    if (!c) return sendJson(res, 404, { error: 'Case not found.' });
    if (session.role !== 'admin' && c.assignedTo && c.assignedTo !== session.uid) {
      return sendJson(res, 403, { error: 'This case is assigned to someone else.' });
    }

    const out = await generate(kind === 'letter' ? planPrompt(c) : summaryPrompt(c), {
      system: SYSTEM,
      maxTokens: kind === 'letter' ? 900 : 600,
    });
    const text = out.text;

    /* Safety net: if the model wrote a letter, the drug and dose it names must be
       the ones the physician's ladder produced. Anything else is not shown. */
    const warnings = [];
    if (out.truncated) warnings.push('The draft was cut short — finish the last sentence before saving.');
    if (kind === 'letter' && c.prescription) {
      const dose = String(c.prescription.dose || '');
      const drug = String(c.prescription.drug || '');
      const lower = text.toLowerCase();
      if (drug && !lower.includes(drug.toLowerCase().split(/\s+/)[0])) {
        warnings.push('The draft does not name the prescribed medicine — check it before sending.');
      }
      if (dose && !lower.includes(dose.toLowerCase())) {
        warnings.push('The draft does not repeat the prescribed dose exactly — check it before sending.');
      }
    }

    sendJson(res, 200, {
      kind,
      text,
      warnings,
      notice: 'AI-generated draft. Read and edit it before saving — you are responsible for what is sent.',
    });
  });
}
