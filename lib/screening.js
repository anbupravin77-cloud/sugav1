/* ============================================================
   Clinical screening rules — the single source of truth.
   Transcribed from the founding physician's written protocol
   (Adobe Scan, 27 Aug 2026). Steps 3–5.

   A ⚠️ answer routes the case to a PHYSICIAN CONSULT.
   Pregnancy EXCLUDES the patient from treatment entirely.

   Nothing here invents clinical policy: every rule below maps
   1:1 to a line in the protocol. Rules are evaluated on the
   SERVER so a tampered client can never clear a flag.
   ============================================================ */

export const YES = 'yes';
export const NO = 'no';
/* "Not sure" is offered only for family history, where patients genuinely
   may not know. It is treated as a flag, never as a clear answer. */
export const UNKNOWN = 'unknown';

/* Co-morbidities collected at Step 5 (recorded, not auto-flagged). */
export const COMORBIDS = [
  { key: 'type2-diabetes', label: 'Type 2 diabetes' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'hyperlipidemia', label: 'Hyperlipidemia' },
];

/* Complications of diabetes (protocol Step 5 a–d). */
export const DIABETES_COMPLICATIONS = [
  { key: 'kidney', label: 'Kidney problems' },
  { key: 'retinopathy', label: 'Visual problems (retinopathy)' },
  { key: 'heart-attack', label: 'Heart attack' },
  { key: 'stroke', label: 'Stroke' },
];

/* ---------- the ⚠️ rules, exactly as written ---------- */
const RULES = [
  {
    code: 'pregnant',
    appliesTo: (s, intake) => isFemale(intake),
    hit: (s) => s.pregnant === YES,
    label: 'Pregnant',
    why: 'Pregnancy excludes GLP-1 treatment — no prescription may be issued.',
    excludes: true,
  },
  {
    code: 'ocp',
    appliesTo: (s, intake) => isFemale(intake),
    hit: (s) => s.onOCP === YES,
    label: 'On oral contraception (OCP)',
    why: 'Oral contraceptive absorption may be affected — physician review required.',
  },
  {
    code: 'antiepileptics',
    appliesTo: () => true,
    hit: (s) => s.antiepileptics === YES,
    label: 'Taking antiepileptics (treatment for fits)',
    why: 'Antiepileptic therapy requires physician review before prescribing.',
  },
  {
    code: 'pancreatitis',
    appliesTo: () => true,
    hit: (s) => s.pancreatitis === YES,
    label: 'Pancreatitis or recurrent abdominal pain',
    why: 'History of pancreatitis or recurrent abdominal pain requires physician review.',
  },
  {
    code: 'family-mtc',
    appliesTo: () => true,
    hit: (s) => s.familyMTC === YES || s.familyMTC === UNKNOWN,
    label: 'Family history of medullary thyroid cancer',
    why: 'Reported or unconfirmed family history of medullary thyroid cancer requires physician review.',
  },
];

function isFemale(intake) {
  return String((intake && intake.sex) || '').toLowerCase() === 'female';
}

/* Normalise a raw screening payload into the stored shape. */
export function normaliseScreening(raw, intake) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const tri = (v) => (v === YES ? YES : v === NO ? NO : '');
  const triU = (v) => (v === UNKNOWN ? UNKNOWN : tri(v));
  const pick = (list, arr) => {
    if (!Array.isArray(arr)) return [];
    const allowed = new Set(list.map((x) => x.key));
    return arr.map(String).filter((k) => allowed.has(k));
  };
  const female = isFemale(intake);
  return {
    married: female ? tri(r.married) : '',
    onOCP: female ? tri(r.onOCP) : '',
    pregnant: female ? tri(r.pregnant) : '',
    antiepileptics: tri(r.antiepileptics),
    pancreatitis: tri(r.pancreatitis),
    comorbid: pick(COMORBIDS, r.comorbid),
    diabetesComplications: pick(DIABETES_COMPLICATIONS, r.diabetesComplications),
    familyMTC: triU(r.familyMTC),
  };
}

/* Which screening answers are mandatory for this patient. */
export function missingAnswers(screening, intake) {
  const s = screening || {};
  const required = ['antiepileptics', 'pancreatitis', 'familyMTC'];
  if (isFemale(intake)) required.push('married', 'onOCP', 'pregnant');
  return required.filter((k) => {
    if (k === 'familyMTC') return s[k] !== YES && s[k] !== NO && s[k] !== UNKNOWN;
    return s[k] !== YES && s[k] !== NO;
  });
}

/**
 * Evaluate the protocol.
 * → { flags:[{code,label,why}], requiresPhysician:bool, excluded:null|{code,label,why} }
 */
export function evaluate(screening, intake) {
  const s = screening || {};
  const flags = [];
  let excluded = null;

  for (const rule of RULES) {
    if (!rule.appliesTo(s, intake)) continue;
    if (!rule.hit(s)) continue;
    const flag = { code: rule.code, label: rule.label, why: rule.why };
    flags.push(flag);
    if (rule.excludes && !excluded) excluded = flag;
  }

  return {
    flags,
    requiresPhysician: flags.length > 0,
    excluded,
  };
}

/* Human-readable summary for the portal + audit trail. */
export function summarise(result) {
  if (!result) return '';
  if (result.excluded) return 'Excluded: ' + result.excluded.label;
  if (result.requiresPhysician) {
    return 'Physician consult required — ' + result.flags.map((f) => f.label).join('; ');
  }
  return 'No red flags — eligible for the standard protocol.';
}
