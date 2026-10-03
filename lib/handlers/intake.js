/* POST /api/intake — PUBLIC: store a consultation submitted by the wizard. */
import { db, newCaseId, newRef } from '../db.js';
import {
  sendJson, methodNotAllowed, guard,
} from '../http.js';
import { tooMany, limiterKey, readJsonSafe } from './_util.js';
import { normaliseScreening, missingAnswers, evaluate, summarise } from '../screening.js';
import { getProtocol, isConfigured, buildDraft } from '../prescribing.js';

const GOALS = ['weight-loss', 'hair-growth', 'sexual-health'];

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function strArray(v, maxItems = 40, maxLen = 500) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean);
}

function conditionArray(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((c) => {
    if (c && typeof c === 'object') {
      return { code: c.code ? str(c.code, 20) : null, name: str(c.name, 500) };
    }
    return { code: null, name: str(c, 500) };
  }).filter((c) => c.name);
}

function bmiBandOf(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (tooMany('intake:' + limiterKey(req), 8, 60 * 60 * 1000)) {
      return sendJson(res, 429, {
        error: 'You have submitted several consultations recently. Please wait an hour and try again.',
      });
    }
    const body = await readJsonSafe(req, res);
    const bad = (msg) => sendJson(res, 400, { error: msg });

    const goal = String(body.goal || '');
    if (!GOALS.includes(goal)) return bad('Please choose a valid goal.');

    const name = str(body.name, 200).replace(/\s+/g, ' ');
    if (name.length < 2) return bad('Please enter your full name (at least 2 characters).');

    /* contact — how the doctor reaches the patient, so both are required */
    const email = str(body.email, 254).toLowerCase();
    if (!email) return bad('Please enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return bad('Please enter a valid email address.');

    const phone = str(body.phone, 40);
    const phoneDigits = phone.replace(/[^\d]/g, '');
    if (!phone) return bad('Please enter your phone number.');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return bad('Please enter a valid phone number, including the country code.');
    }

    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 18 || age > 100) {
      return bad(age < 18 ? 'You must be 18 or older to use this service.' : 'Age must be a whole number between 18 and 100.');
    }

    const sex = str(body.sex, 40);
    if (!sex) return bad('Please tell us your sex.');
    const sexDetail = str(body.sexDetail, 500);

    const cm = Number(body.height && body.height.cm);
    if (!Number.isFinite(cm) || cm < 100 || cm > 250) return bad('Height must be between 100 and 250 cm.');
    const kg = Number(body.weight && body.weight.kg);
    if (!Number.isFinite(kg) || kg < 30 || kg > 350) return bad('Weight must be between 30 and 350 kg.');

    const consents = body.consents || {};
    for (const c of ['accuracy', 'telehealth', 'privacy']) {
      if (consents[c] !== true) return bad('Missing required consent: consents.' + c + '.');
    }

    /* server-side BMI (never trust the client's number) */
    const m = cm / 100;
    const bmi = Math.round((kg / (m * m)) * 10) / 10;
    const bmiBand = bmiBandOf(bmi);
    let potentialLoss;
    if (bmi >= 25) {
      const lowKg = Math.round(0.10 * kg);
      let highKg = Math.round(Math.min(0.18 * kg, kg - 21 * m * m));
      if (highKg <= lowKg) highKg = lowKg + 2;
      potentialLoss = { lowKg, highKg };
    }

    /* ---- clinical screening (protocol steps 3–5), evaluated server-side ---- */
    const screening = normaliseScreening(body.screening, { sex });
    const unanswered = missingAnswers(screening, { sex });
    if (unanswered.length) {
      return bad('Please answer every medical screening question before submitting.');
    }
    const assessment = evaluate(screening, { sex });

    const now = new Date().toISOString();
    const theCase = {
      id: newCaseId(),
      ref: newRef(),
      status: 'new',
      priority: false,
      assignedTo: null,
      assignedName: null,
      intake: {
        goal,
        name,
        email,
        phone,
        age,
        sex,
        ...(sexDetail ? { sexDetail } : {}),
        height: { cm },
        weight: { kg },
        bmi,
        bmiBand,
        ...(potentialLoss ? { potentialLoss } : {}),
        conditions: conditionArray(body.conditions),
        noConditions: !!body.noConditions,
        surgical: str(body.surgical, 4000),
        family: strArray(body.family),
        familyDetail: str(body.familyDetail, 4000),
        medications: strArray(body.medications),
        noMedications: !!body.noMedications,
        allergies: strArray(body.allergies),
        otherInfo: str(body.otherInfo, 4000),
        consents: { accuracy: true, telehealth: true, privacy: true },
        screening,
      },
      assessment,
      prescription: null,
      reviews: [],
      notes: [],
      plan: null,
      audit: [{ at: now, who: 'system', action: 'Consultation received' }],
      createdAt: now,
      updatedAt: now,
    };

    /* ---- protocol routing ---- */
    if (assessment.excluded) {
      theCase.status = 'excluded';
      theCase.priority = true;
      theCase.audit.push({ at: now, who: 'system', action: 'Excluded — ' + assessment.excluded.label });
    } else if (assessment.requiresPhysician) {
      theCase.priority = true;
      theCase.audit.push({ at: now, who: 'system', action: 'Flagged for physician consult — ' + summarise(assessment) });
    } else {
      /* No red flags: draft the first prescription from the standing protocol.
         It is a DRAFT — a physician must approve it before the patient gets it. */
      const protocol = await getProtocol();
      if (isConfigured(protocol)) {
        theCase.prescription = buildDraft(protocol, 0);
        theCase.audit.push({ at: now, who: 'system', action: 'Prescription drafted — awaiting physician approval' });
      } else {
        theCase.audit.push({ at: now, who: 'system', action: 'No red flags — prescribing protocol not configured, awaiting physician' });
      }
    }

    await db.put('cases/' + theCase.id + '.json', theCase);
    sendJson(res, 201, { ref: theCase.ref, id: theCase.id });
  });
}
