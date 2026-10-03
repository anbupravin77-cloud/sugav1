/* /api/auth/(login|logout|me|change-password) — session management. */
import { db } from '../db.js';
import {
  hashPassword, verifyPassword, signSession,
  sessionCookie, clearSessionCookie, requireAuth,
} from '../auth.js';
import {
  sendJson, methodNotAllowed, guard,
} from '../http.js';
import { publicUser } from './setup.js';
import { pathParam, tooMany, limiterKey, withLock, ensureActiveUser, readJsonSafe } from './_util.js';

async function findUserByEmail(email) {
  const files = await db.list('users/');
  for (const f of files) {
    const u = await db.get(f.path);
    if (u && String(u.email).toLowerCase() === email) return u;
  }
  return null;
}

/* Constant-work decoy so a login against an unknown email costs the same
   scrypt time as a real one (no email enumeration by timing). */
let DECOY_HASH = null;
function decoyHash() {
  if (!DECOY_HASH) DECOY_HASH = hashPassword('decoy-' + Math.random());
  return DECOY_HASH;
}

export default async function handler(req, res) {
  await guard(res, async () => {
    const tail = pathParam(req, 2, 'action');

    if (tail === 'login') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const body = await readJsonSafe(req, res);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
      const password = String(body.password || '');
      /* two buckets: per-source (spoof-resistant key) AND per-target email,
         so forging headers cannot buy unlimited guesses at one account */
      const ipHit = tooMany('login:ip:' + limiterKey(req), 10, 15 * 60 * 1000);
      const emailHit = email && tooMany('login:email:' + email, 10, 15 * 60 * 1000);
      if (ipHit || emailHit) {
        return sendJson(res, 429, { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
      }
      const user = email ? await findUserByEmail(email) : null;
      const ok = user ? verifyPassword(password, user.passHash) : verifyPassword(password, decoyHash());
      if (!user || !ok) {
        return sendJson(res, 401, { error: 'Email or password is incorrect.' });
      }
      if (!user.active) {
        return sendJson(res, 403, { error: 'This account has been deactivated.' });
      }
      res.setHeader('Set-Cookie', sessionCookie(signSession(user)));
      return sendJson(res, 200, {
        user: publicUser(user),
        mustChangePassword: !!user.mustChangePassword,
      });
    }

    if (tail === 'logout') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      res.setHeader('Set-Cookie', clearSessionCookie());
      return sendJson(res, 200, { ok: true });
    }

    if (tail === 'me') {
      if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
      const session = requireAuth(req, res);
      if (!session) return;
      const live = await ensureActiveUser(session, res);
      if (!live) return;
      return sendJson(res, 200, { user: publicUser(live), mustChangePassword: !!live.mustChangePassword });
    }

    if (tail === 'change-password') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const session = requireAuth(req, res);
      if (!session) return;
      if (tooMany('chpass:' + session.uid, 10, 15 * 60 * 1000)) {
        return sendJson(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
      }
      const body = await readJsonSafe(req, res);
      const current = String(body.current || '');
      const next = String(body.next || '');
      if (next.length < 10 || next.length > 200) {
        return sendJson(res, 400, { error: 'New password must be between 10 and 200 characters.' });
      }
      const key = 'users/' + session.uid + '.json';
      return withLock(key, async () => {
        const user = await db.get(key);
        if (!user) return sendJson(res, 401, { error: 'Not signed in.' });
        if (user.active === false) return sendJson(res, 403, { error: 'This account has been deactivated.' });
        if (!verifyPassword(current, user.passHash)) {
          return sendJson(res, 400, { error: 'Current password is incorrect.' });
        }
        user.passHash = hashPassword(next);
        user.mustChangePassword = false;
        await db.put(key, user);
        return sendJson(res, 200, { ok: true });
      });
    }

    sendJson(res, 404, { error: 'No such endpoint.' });
  });
}
