/* ============================================================
   Gemini — used to WRITE PROSE ONLY.

   Hard boundary, enforced by design:
     • The model NEVER chooses a drug, a dose, or eligibility.
     • Those come from lib/screening.js (deterministic rules) and
       the physician-configured ladder in lib/prescribing.js.
     • The model only turns decisions that have ALREADY been made
       into readable text, which a doctor then edits and approves.

   The API key lives in GEMINI_API_KEY (server-side only). It is
   never sent to the browser and never committed.
   ============================================================ */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

export function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

/** Low-level call. Returns plain text, or throws with a friendly message. */
export async function generate(prompt, { system, maxTokens = 900, timeoutMs = 20000 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw Object.assign(new Error('AI drafting is not configured.'), { status: 503 });
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: maxTokens,
      /* 2.5-flash "thinks" by default and spends the output budget doing it,
         which truncates short letters mid-sentence. This is straightforward
         prose writing, so reasoning is turned off. */
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [],
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(ENDPOINT + encodeURIComponent(MODEL) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw Object.assign(new Error('The drafting service did not respond. Please try again.'), { status: 504 });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    /* Never leak the key or the raw upstream error to the client. */
    console.error('[gemini]', res.status, (await res.text()).slice(0, 300));
    const msg = res.status === 429
      ? 'The drafting service is rate-limited right now. Please try again shortly.'
      : 'The drafting service could not complete that request.';
    throw Object.assign(new Error(msg), { status: 502 });
  }

  const data = await res.json();
  const cand = (data.candidates || [])[0];
  const text = ((cand && cand.content && cand.content.parts) || [])
    .map((p) => p.text || '').join('').trim();
  if (!text) {
    throw Object.assign(new Error('The drafting service returned nothing usable.'), { status: 502 });
  }
  /* A half-written clinical letter is worse than none — surface it rather than
     letting a doctor paste a sentence that stops mid-thought. */
  const truncated = cand.finishReason === 'MAX_TOKENS';
  return { text, truncated };
}

/* ---------- prompt builders ---------- */

const GUARD = [
  'You are a medical scribe assisting a licensed physician at a telehealth clinic.',
  'You DO NOT make clinical decisions. You never choose, suggest, change or question a drug,',
  'a dose, or whether a patient is eligible for treatment. Those decisions are already made',
  'by the physician and are given to you as fixed facts — reproduce them exactly as written,',
  'never alter a number, and never introduce a drug or dose that is not in the facts.',
  'If information is missing, say so plainly rather than inventing it.',
  'Write in plain British English, warm and factual, no marketing language, no emoji.',
].join(' ');

/** A short clinical summary of the intake, for the doctor reading the chart. */
export function summaryPrompt(c) {
  const i = c.intake || {};
  const s = i.screening || {};
  const a = c.assessment || {};
  const lines = [
    'Summarise this patient intake for the reviewing doctor in 3-5 short sentences.',
    'Lead with the reason for consultation and anything clinically significant.',
    'Do not recommend treatment. Do not mention any drug or dose.',
    '',
    'INTAKE',
    '- Goal: ' + (i.goal || '-'),
    '- Age/sex: ' + (i.age || '-') + ' / ' + (i.sex || '-'),
    '- BMI: ' + (i.bmi || '-') + ' (' + (i.bmiBand || '-') + ')',
    '- Conditions: ' + (i.noConditions ? 'none reported' : ((i.conditions || []).map((x) => x.name).join(', ') || '-')),
    '- Medications: ' + (i.noMedications ? 'none' : ((i.medications || []).join(', ') || '-')),
    '- Allergies: ' + ((i.allergies || []).join(', ') || '-'),
    '- Surgical history: ' + (i.surgical || '-'),
    '- Family history: ' + ((i.family || []).join(', ') || '-') + (i.familyDetail ? ' (' + i.familyDetail + ')' : ''),
    '- Protocol screening: epilepsy treatment=' + (s.antiepileptics || '-') +
      ', pancreatitis/abdominal pain=' + (s.pancreatitis || '-') +
      ', family medullary thyroid cancer=' + (s.familyMTC || '-') +
      (i.sex === 'Female' ? ', pregnant=' + (s.pregnant || '-') + ', on OCP=' + (s.onOCP || '-') : ''),
    '- Co-morbidities: ' + ((s.comorbid || []).join(', ') || '-'),
    '- Diabetes complications: ' + ((s.diabetesComplications || []).join(', ') || '-'),
    '- Patient note: ' + (i.otherInfo || '-'),
    '- Screening outcome (already decided): ' + (a.excluded ? 'EXCLUDED — ' + a.excluded.label
      : a.requiresPhysician ? 'physician consult required — ' + (a.flags || []).map((f) => f.label).join('; ')
      : 'no red flags'),
  ];
  return lines.join('\n');
}

/** A plain-language letter to the patient about a plan the doctor has ALREADY decided. */
export function planPrompt(c) {
  const i = c.intake || {};
  const rx = c.prescription;
  const a = c.assessment || {};
  const facts = [];

  facts.push('- Patient first name: ' + String(i.name || '').split(' ')[0]);
  facts.push('- Reason for consultation: ' + (i.goal || '-'));

  if (a.excluded) {
    facts.push('- DECISION (fixed): treatment is NOT being prescribed because: ' + a.excluded.label + '.');
    facts.push('- Explain this kindly, say the doctor will discuss safe alternatives, and do not name any drug.');
  } else if (a.requiresPhysician) {
    facts.push('- DECISION (fixed): the doctor needs to review some answers before deciding on treatment: ' +
      (a.flags || []).map((f) => f.label).join('; ') + '.');
    facts.push('- Explain that this is a normal safety check, that the doctor will be in touch, and do not name any drug or dose.');
  } else if (rx) {
    facts.push('- DECISION (fixed, reproduce exactly): medicine = "' + rx.drug + '", dose = "' + rx.dose + '".');
    if (rx.instructions) facts.push('- How to take it (fixed): ' + rx.instructions);
    facts.push('- Possible mild side effects to mention: ' + (rx.minorSideEffects || []).join(', ') + '.');
    facts.push('- Urgent advice to include verbatim in its own sentence: "' + (rx.urgentAdvice || '') + '"');
    facts.push('- Follow-up to include: ' + (rx.reviewInstruction || ''));
    facts.push('- Do not state any dose other than the one above. Do not suggest changing the dose.');
  } else {
    facts.push('- DECISION (fixed): no prescription has been issued yet; the doctor is still reviewing.');
    facts.push('- Do not name any drug or dose.');
  }

  return [
    'Write a short message from the doctor to the patient, about 120-180 words.',
    'Address them by first name. Explain what happens next in plain language.',
    'Do not add a subject line, letterhead, or signature block.',
    '',
    'FACTS (do not contradict or extend these):',
  ].concat(facts).join('\n');
}

export const SYSTEM = GUARD;
