/* GET/PUT /api/protocol — the clinic's prescribing protocol (admin only).
   The drug and dose ladder are clinical content: only a physician sets them. */
import { requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { ensureActiveUser, readJsonSafe, withLock } from './_util.js';
import { getProtocol, saveProtocol, isConfigured } from '../prescribing.js';

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

export default async function handler(req, res) {
  await guard(res, async () => {
    const session = requireAuth(req, res, ['admin']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    if (req.method === 'GET') {
      const p = await getProtocol();
      return sendJson(res, 200, { protocol: p, configured: isConfigured(p) });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJsonSafe(req, res);
      const bad = (m) => sendJson(res, 400, { error: m });

      const drug = str(body.drug, 200);

      let ladder = [];
      if (Array.isArray(body.doseLadder)) {
        ladder = body.doseLadder.slice(0, 20).map((s) => ({
          label: str(s && s.label, 120),
          instructions: str(s && s.instructions, 600),
        })).filter((s) => s.label);
      }
      if (drug && !ladder.length) return bad('Add at least one dose step for the drug.');
      if (!drug && ladder.length) return bad('Name the drug this dose ladder belongs to.');

      const interval = Number(body.reviewIntervalDays);
      if (body.reviewIntervalDays !== undefined && (!Number.isInteger(interval) || interval < 1 || interval > 365)) {
        return bad('Review interval must be between 1 and 365 days.');
      }

      let sideEffects;
      if (Array.isArray(body.minorSideEffects)) {
        sideEffects = body.minorSideEffects.slice(0, 30).map((x) => str(x, 200)).filter(Boolean);
      }

      const next = { drug, doseLadder: ladder };
      if (body.reviewIntervalDays !== undefined) next.reviewIntervalDays = interval;
      if (sideEffects) next.minorSideEffects = sideEffects;
      if (body.urgentAdvice !== undefined) next.urgentAdvice = str(body.urgentAdvice, 1000);
      if (body.reviewInstruction !== undefined) next.reviewInstruction = str(body.reviewInstruction, 1000);

      const saved = await withLock('protocol', () => saveProtocol(next, session.name));
      return sendJson(res, 200, { protocol: saved, configured: isConfigured(saved) });
    }

    return methodNotAllowed(res, ['GET', 'PUT', 'POST']);
  });
}
