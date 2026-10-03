# Suga.health

Doctor-led telehealth for **weight loss**, **hair growth**, and **sexual health** — a marketing
site, a patient intake form, and a private portal where physicians review and act on every case.

**Live:** https://suga-health-lilac.vercel.app
**Care portal:** https://suga-health-lilac.vercel.app/portal/login

---

## What's in here

| Area | Files |
|---|---|
| Public site | `index.html`, `weight-loss.html`, `hair-growth.html`, `sexual-health.html`, `about.html` |
| Patient intake | `consultation.html` + `assets/consult.js` (single-page form) |
| Doctor / admin portal | `portal/` (login, worklist, case chart, admin) |
| API | `lib/handlers/` (logic) + `api/` (thin Vercel wrappers) |
| Core | `lib/db.js` (encrypted storage), `lib/auth.js` (sessions), `lib/http.js` |
| Design system | `assets/styles.css`, self-hosted fonts in `assets/fonts/` |
| Local server | `server.local.js` |

No build step. No framework. Vanilla HTML/CSS/JS on the front end, plain Node ESM on the back.

## Run it locally

```bash
cp .env.example .env.local     # then fill in the three keys (see comments in the file)
node server.local.js           # http://localhost:4180
```

Local runs store data in `./.localdata` (git-ignored, encrypted with `DATA_KEY`).
No npm install is needed for local development — `@vercel/blob` is only used in cloud deploys.

Create the first admin account once:

```bash
curl -X POST http://localhost:4180/api/setup \
  -H "content-type: application/json" \
  -d '{"setupKey":"<SETUP_KEY>","name":"Admin","email":"you@example.com","password":"a-long-password"}'
```

Then sign in at `/portal/login.html`, and add doctors from **Admin → Care team**
(each gets a one-time temporary password and must change it at first sign-in).

## How the care flow works

1. A patient completes the consultation form → `POST /api/intake` stores an encrypted case.
2. The case lands in the doctor worklist as **New**, with a 24-hour review timer
   (amber at 18h, red at 24h) and triage flags: BMI band, red-flag conditions,
   medication–allergy overlaps, and goal-specific contraindications.
3. A doctor claims it (**In review**), writes clinical notes, and records a plan
   (**Plan sent**). Every action is written to a per-case audit trail.

## Security notes

- Patient records are **AES-256-GCM encrypted at rest** (`DATA_KEY`), on disk locally and in a
  private Vercel Blob store in production.
- Passwords are **scrypt**-hashed; sessions are HS256 JWTs in `HttpOnly` cookies (12h).
- Every non-public endpoint is role-checked server-side (`admin` / `doctor`);
  deactivating an account revokes access immediately.
- Login and intake are rate-limited; intake rejects under-18 submissions server-side.
- Secrets live only in environment variables — `.env.local` is git-ignored, and so is
  `.localdata/`. Never commit either.

> This is not a formally HIPAA-audited deployment. Encryption, access control and transport
> security are in place; a BAA-backed hosting arrangement would be a separate step if required.

## Deploying

```bash
npm install                    # @vercel/blob, needed for the cloud storage driver
vercel deploy --prod
```

`JWT_SECRET`, `DATA_KEY`, `SETUP_KEY` and `BLOB_READ_WRITE_TOKEN` must be set in the Vercel
project environment. Run `/api/setup` once against production to create the admin account.

---

© 2026 Suga.health
