/* Auth: scrypt password hashing + HS256 JWT sessions (node:crypto only). */
import crypto from 'node:crypto';

if (process.env.VERCEL && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in the deployment environment');
}
const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const COOKIE = 'suga_sess';
const SESSION_HOURS = 12;

/* ---------- passwords ---------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return 's2$' + salt.toString('hex') + '$' + hash.toString('hex');
}

export function verifyPassword(password, stored) {
  try {
    const [tag, saltHex, hashHex] = String(stored).split('$');
    if (tag !== 's2') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ---------- JWT (HS256) ---------- */
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function hmac(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

export function signSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.id, role: user.role, name: user.name, email: user.email,
    iat: now, exp: now + SESSION_HOURS * 3600,
  };
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  return head + '.' + body + '.' + hmac(head + '.' + body);
}

export function verifySessionToken(token) {
  try {
    const [head, body, sig] = String(token).split('.');
    if (!head || !body || !sig) return null;
    const expected = hmac(head + '.' + body);
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- cookies ---------- */
export function sessionCookie(token) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return COOKIE + '=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + SESSION_HOURS * 3600 + secure;
}
export function clearSessionCookie() {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return COOKIE + '=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' + secure;
}

export function getSession(req) {
  const cookies = String(req.headers.cookie || '');
  const m = cookies.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (m) {
    const s = verifySessionToken(m[1]);
    if (s) return s;
  }
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) return verifySessionToken(auth.slice(7));
  return null;
}

/* Send 401/403 and return null if not allowed; otherwise return the session. */
export function requireAuth(req, res, roles) {
  const session = getSession(req);
  if (!session) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Not signed in.' }));
    return null;
  }
  if (roles && roles.length && !roles.includes(session.role)) {
    res.statusCode = 403;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Not allowed for your role.' }));
    return null;
  }
  return session;
}
