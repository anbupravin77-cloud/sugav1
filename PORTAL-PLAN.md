# Suga.health Care Platform — Backend + Doctor Portal Plan

Client approved the "Annotated Chart" design. This phase turns the demo into a working system:
real intake storage, an admin dashboard, and per-doctor logins. LOCAL-FIRST: everything runs and
is tested on the local machine (Node server + on-disk database) before anything touches Vercel.

## 1. What a reviewing doctor actually needs (jobs-to-be-done)

1. **"Show me what's waiting"** — an inbox of new consultations, newest + oldest-waiting visible,
   with the 24-hour review promise tracked per case (SLA timer; >18h amber, >24h red).
2. **"Let me triage in 5 seconds per case"** — worklist cards surface the decision-relevant facts
   without opening the chart: goal, age/sex, BMI + category, red-flag conditions (e.g. CAD, CKD,
   prior stroke, T1D), allergy count, medication count.
3. **"Give me the whole chart, organized like a chart"** — the case view renders the intake in
   clinical order (ID → vitals/body → conditions with ICD codes → meds → allergies → surgical →
   family → patient note), with automatic highlights: BMI band, drug-allergy overlap warnings,
   contraindication flags per goal (e.g. weight-loss + MTC/MEN2 history, ED meds + nitrates).
4. **"Let me own a case"** — claim/release; nobody double-works a patient. Admin can reassign.
5. **"Let me think in writing"** — private clinical notes timeline on every case (who/when).
6. **"Let me answer the patient"** — a plan composer with per-goal starting templates; sending the
   plan moves the case forward. (MVP records the plan + marks status; actual email/SMS = phase 2.)
7. **"Never lose the trail"** — every action audited (claimed, status change, note, plan) with
   author + timestamp, visible on the case.
8. **Status model**: `new → in_review → plan_sent → closed`, plus `awaiting_patient` side-state
   and a priority flag. Simple enough to live in a tab bar.

## 2. What the admin (the client) needs

- **Overview**: new today / waiting count / avg time-to-plan / % within 24h; split by goal;
  open load per doctor.
- **Doctors management**: add doctor (name, email, specialties = which goals they cover),
  temp password generated once, activate/deactivate, reset password. Roles: `admin`, `doctor`
  (admin can also review cases).
- **All cases** view with filters + reassignment.

## 3. Architecture (local-first, Vercel-ready)

```
SUGA HELATH/
├── api/                    ← thin Vercel wrappers (deploy phase) re-exporting handlers
├── lib/
│   ├── db.js               ← storage driver: FileStore (./.localdata) | BlobStore (Vercel, later)
│   │                          AES-256-GCM encryption at rest in BOTH drivers (DATA_KEY)
│   ├── auth.js             ← scrypt password hashing, HS256 JWT (node:crypto only), cookie session
│   ├── http.js             ← json body/reply helpers, method guard, naive rate limit
│   └── handlers/           ← ALL endpoint logic (framework-agnostic (req,res)):
│       setup.js  auth.js  intake.js  cases.js  case-detail.js  notes.js  plan.js
│       doctors.js  stats.js
├── server.local.js         ← plain Node http server: static site + /api/* routes → handlers
├── portal/
│   ├── portal.css          ← dashboard skin of the approved design system (chart-cards, stamps)
│   ├── portal.js           ← API client, session guard, shared UI helpers (SLA, flags, badges)
│   ├── login.html          ← doctors + admin sign-in (role-routed)
│   ├── index.html          ← the worklist (tabs: Inbox / Mine / All / Done; filters; SLA)
│   ├── case.html           ← the chart view + action rail (claim, status, notes, plan)
│   └── admin.html          ← overview stats + doctors management + all cases
└── assets/consult.js       ← wizard now POSTs to /api/intake (keeps localStorage backup)
```

- **Zero npm dependencies for local run** (node:crypto, node:http, node:fs only).
  `@vercel/blob` is needed only at deploy phase.
- **Auth**: httpOnly cookie JWT, 12h expiry; `requireAuth` on every non-public endpoint;
  role checks server-side. Passwords scrypt-hashed. First admin created once via
  `POST /api/setup` guarded by SETUP_KEY (already generated).
- **Data at rest**: every record AES-256-GCM encrypted with DATA_KEY before hitting disk/Blob.
- **IDs**: cases `c_<epochms><rand>` (pathname-sortable = newest first), ref `SH-XXXXXX` shown
  to patients; users `u_<rand>`.

## 4. API contract

| Method+Path | Auth | Purpose |
|---|---|---|
| POST /api/setup | SETUP_KEY, only when 0 users | create first admin |
| POST /api/auth/login | public | {email,password} → session cookie + {user} |
| POST /api/auth/logout | session | clear cookie |
| GET  /api/auth/me | session | {user} |
| POST /api/auth/change-password | session | {current,next} |
| POST /api/intake | public (rate-limited) | store consultation → {ref} |
| GET  /api/cases?status&goal&q&mine&limit | doctor/admin | worklist summaries |
| GET  /api/cases/:id | doctor/admin | full chart |
| PATCH /api/cases/:id | doctor/admin | {action: claim/release/status/priority/assign} |
| POST /api/cases/:id/notes | doctor/admin | {text} → note added |
| POST /api/cases/:id/plan | doctor/admin | {text} → plan recorded, status plan_sent |
| GET/POST /api/doctors, PATCH /api/doctors/:id | admin | manage doctors |
| GET  /api/stats | admin | dashboard metrics |

## 5. Test plan (local, before any deploy)

Scripted + browser E2E on `node server.local.js` (port 4180):
setup admin → login → add doctor → login as doctor → submit real consultation from the
public wizard → case appears in Inbox with SLA + flags → claim → note → plan → status flow →
admin stats reflect it → auth negatives (wrong password, doctor hitting admin API, no session).

## 6. Deploy phase (LATER, after local sign-off)

Blob store `suga-health-db` (private) already created + linked; JWT_SECRET / DATA_KEY /
SETUP_KEY already in Vercel env. Deploy = add `api/` wrappers + `@vercel/blob` driver,
`vercel deploy --prod`, run setup once against prod, hand over admin credentials.

## 7. Honest limitations (to tell the client)

- MVP is not formally HIPAA-audited infrastructure (encryption at rest + TLS + private store
  are in place; a BAA-backed stack is a future step if required).
- Plan delivery to the patient (email/SMS) is phase 2 — MVP records the plan in the system.
- Password reset is admin-mediated (no self-serve email reset yet).
