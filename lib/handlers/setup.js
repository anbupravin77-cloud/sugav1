/* POST /api/setup — create the first admin (guarded by SETUP_KEY, only when 0 users). */
import crypto from 'node:crypto';
import { db, newUserId } from '../db.js';
import { hashPassword } from '../auth.js';
import { sendJson, methodNotAllowed, guard } from '../http.js';
import { withLock, tooMany, limiterKey, readJsonSafe } from './_util.js';

function setupKeyOk(given) {
  const expected = process.env.SETUP_KEY;
  if (!expected) return false; // no key configured → endpoint is disabled
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, email: u.email,
    specialties: u.specialties || [], active: !!u.active, createdAt: u.createdAt,
  };
}

export default async function handler(req, res) {
  await guard(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    if (tooMany('setup:' + limiterKey(req), 10, 15 * 60 * 1000)) {
      return sendJson(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
    }
    const body = await readJsonSafe(req, res);

    if (!setupKeyOk(body.setupKey)) {
      return sendJson(res, 403, { error: 'Invalid setup key.' });
    }

    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2) return sendJson(res, 400, { error: 'Name must be at least 2 characters.' });
    if (!EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'A valid email address is required.' });
    if (password.length < 10 || password.length > 200) {
      return sendJson(res, 400, { error: 'Password must be between 10 and 200 characters.' });
    }

    /* the 0-users check runs under the same lock as user creation so two
       concurrent setup calls cannot both pass it */
    await withLock('users:create', async () => {
      const existing = await db.list('users/');
      if (existing.length > 0) {
        return sendJson(res, 409, { error: 'Setup has already been completed.' });
      }

      const user = {
        id: newUserId(),
        role: 'admin',
        name,
        email,
        passHash: hashPassword(password),
        specialties: [],
        active: true,
        createdAt: new Date().toISOString(),
        mustChangePassword: false,
      };
      await db.put('users/' + user.id + '.json', user);
      sendJson(res, 200, { ok: true, user: publicUser(user) });
    });
  });
}
