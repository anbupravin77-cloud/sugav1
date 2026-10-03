/* /api/doctors (GET list, POST create) + /api/doctors/<id> (PATCH) — admin only. */
import crypto from 'node:crypto';
import { db, newUserId } from '../db.js';
import { hashPassword, requireAuth } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { publicUser } from './setup.js';
import { getAllCases } from './cases.js';
import { pathParam, isUserId, withLock, ensureActiveUser, readJsonSafe } from './_util.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOALS = ['weight-loss', 'hair-growth', 'sexual-health'];
const TEMP_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function tempPassword(len = 12) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  return out;
}

function cleanSpecialties(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter((s) => GOALS.includes(s)).slice(0, 10);
}

async function allUsers() {
  const files = await db.list('users/');
  const out = [];
  for (let i = 0; i < files.length; i += 25) {
    const batch = await Promise.all(files.slice(i, i + 25).map((f) => db.get(f.path)));
    for (const u of batch) if (u) out.push(u);
  }
  return out;
}

export default async function handler(req, res) {
  await guard(res, async () => {
    const session = requireAuth(req, res, ['admin']);
    if (!session) return;
    if (!(await ensureActiveUser(session, res))) return;

    const id = pathParam(req, 2, 'id'); // api/doctors[/<id>]

    /* ---------- collection ---------- */
    if (!id) {
      if (req.method === 'GET') {
        const [users, cases] = await Promise.all([allUsers(), getAllCases()]);
        const openLoad = {};
        for (const c of cases) {
          if (c.assignedTo && (c.status === 'in_review' || c.status === 'awaiting_patient')) {
            openLoad[c.assignedTo] = (openLoad[c.assignedTo] || 0) + 1;
          }
        }
        return sendJson(res, 200, {
          users: users.map((u) => ({ ...publicUser(u), openLoad: openLoad[u.id] || 0 })),
        });
      }

      if (req.method === 'POST') {
        const body = await readJsonSafe(req, res);
        const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        const email = String(body.email || '').trim().toLowerCase();
        if (name.length < 2) return sendJson(res, 400, { error: 'Name must be at least 2 characters.' });
        if (!EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'A valid email address is required.' });

        /* create under a lock so two concurrent creates cannot race the
           duplicate-email check */
        return withLock('users:create', async () => {
          const users = await allUsers();
          if (users.some((u) => String(u.email).toLowerCase() === email)) {
            return sendJson(res, 409, { error: 'A user with that email already exists.' });
          }

          const pass = tempPassword();
          const user = {
            id: newUserId(),
            role: 'doctor',
            name,
            email,
            passHash: hashPassword(pass),
            specialties: cleanSpecialties(body.specialties),
            active: true,
            createdAt: new Date().toISOString(),
            mustChangePassword: true,
          };
          await db.put('users/' + user.id + '.json', user);
          return sendJson(res, 201, { user: publicUser(user), tempPassword: pass });
        });
      }

      return methodNotAllowed(res, ['GET', 'POST']);
    }

    /* ---------- /api/doctors/<id> ---------- */
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
    if (!isUserId(id)) return sendJson(res, 404, { error: 'No such user.' });
    const key = 'users/' + id + '.json';
    const body = await readJsonSafe(req, res);

    await withLock(key, async () => {
      const user = await db.get(key);
      if (!user) return sendJson(res, 404, { error: 'No such user.' });

      let newPass;

      if (body.active !== undefined) {
        if (user.id === session.uid && !body.active) {
          return sendJson(res, 400, { error: 'You cannot deactivate your own account.' });
        }
        user.active = !!body.active;
      }
      if (body.resetPassword === true) {
        newPass = tempPassword();
        user.passHash = hashPassword(newPass);
        user.mustChangePassword = true;
      }
      if (body.name !== undefined) {
        const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (name.length < 2) return sendJson(res, 400, { error: 'Name must be at least 2 characters.' });
        user.name = name;
      }
      if (body.specialties !== undefined) {
        user.specialties = cleanSpecialties(body.specialties);
      }

      await db.put(key, user);
      const out = { user: publicUser(user) };
      if (newPass) out.tempPassword = newPass;
      sendJson(res, 200, out);
    });
  });
}
