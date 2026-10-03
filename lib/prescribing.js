/* ============================================================
   Prescribing protocol — the doctor-configured drug menu, the
   dose ladder used at each monthly review, and the counselling
   text printed on every prescription.

   IMPORTANT: no drug or dose is invented here. The ladder ships
   EMPTY and must be configured by the clinic's physician in
   Admin → Prescribing protocol before the system will draft
   anything. Until then, eligible cases simply wait for a doctor.

   The counselling text below is transcribed verbatim from the
   founding physician's written protocol (Step 6).
   ============================================================ */

import { db } from './db.js';

const PROTOCOL_PATH = 'config/protocol.json';

/* Step 6, as written: "Print in the prescription for possible minor side effects…" */
export const DEFAULT_PROTOCOL = {
  drug: '',                 // e.g. the GLP-1 the clinic prescribes
  doseLadder: [],           // ordered steps: [{ label, instructions }]
  reviewIntervalDays: 30,   // "Review after 1 month"
  minorSideEffects: [
    'Abdominal pain',
    'Diarrhoea',
    'Constipation',
    'Fullness of the abdomen',
    'Loss of appetite',
  ],
  urgentAdvice:
    'Return quickly if you notice any severe itching, palpitations or giddiness.',
  reviewInstruction:
    'Review after 1 month with your weight, pulse and blood pressure.',
  updatedAt: null,
  updatedBy: null,
};

export async function getProtocol() {
  const saved = await db.get(PROTOCOL_PATH);
  if (!saved) return { ...DEFAULT_PROTOCOL };
  return { ...DEFAULT_PROTOCOL, ...saved };
}

export async function saveProtocol(next, who) {
  const current = await getProtocol();
  const merged = {
    ...current,
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: who || null,
  };
  await db.put(PROTOCOL_PATH, merged);
  return merged;
}

/** A protocol can only draft prescriptions once a drug and at least one dose step exist. */
export function isConfigured(protocol) {
  return !!(protocol && protocol.drug && Array.isArray(protocol.doseLadder) && protocol.doseLadder.length);
}

/**
 * Build the next prescription DRAFT for a case.
 * `stepIndex` is 0 for the first prescription, then 1, 2 … as doses escalate.
 * Every draft requires a physician's approval before it reaches the patient.
 */
export function buildDraft(protocol, stepIndex, opts = {}) {
  if (!isConfigured(protocol)) return null;
  const idx = Math.max(0, Math.min(stepIndex, protocol.doseLadder.length - 1));
  const step = protocol.doseLadder[idx];
  return {
    status: 'draft',              // draft → approved (a doctor must approve)
    number: idx + 1,              // 1st prescription, 2nd, …
    stepIndex: idx,
    atLastStep: idx >= protocol.doseLadder.length - 1,
    drug: protocol.drug,
    dose: step.label,
    instructions: step.instructions || '',
    minorSideEffects: protocol.minorSideEffects.slice(),
    urgentAdvice: protocol.urgentAdvice,
    reviewInstruction: protocol.reviewInstruction,
    reviewIntervalDays: protocol.reviewIntervalDays,
    generatedAt: new Date().toISOString(),
    generatedBy: opts.generatedBy || 'system',
    reason: opts.reason || 'No red flags on screening — drafted from the standing protocol.',
    approvedBy: null,
    approvedAt: null,
  };
}
