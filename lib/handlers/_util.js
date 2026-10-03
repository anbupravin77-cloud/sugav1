/* Shared hardening helpers for the handlers (kept inside lib/handlers).
   - pathParam: id extraction that survives both the local server (real path) and
     the Vercel dynamic-route wrappers (req.query populated, path may be rewritten).
   - isCaseId / isUserId: strict id formats so a hostile id can never reach the
     store layer (assertSafePath would otherwise turn it into a 500).
   - withLock: per-key in-process mutex so concurrent read-modify-write on the
     same record (notes vs status vs plan) cannot silently drop entries.
   - tooMany / limiterKey: rate limiting that does not trust a client-forgeable
     X-Forwarded-For when running outside Vercel, and never wipes all buckets.
   - ensureActiveUser: a deactivated account must lose access immediately,
     not when its 12h JWT expires. */
import { db } from '../db.js';
import { sendJson, getUrl } from '../http.js';

/* ---------- URL params ---------- */
export function pathParam(req, index, name) {
  let v = null;
  try {
    const parts = getUrl(req).pathname.split('/').filter(Boolean);
    if (parts.length > index) v = decodeURIComponent(parts[index]);
  } catch { v = null; }
  // Vercel dynamic routes: prefer the parsed route param when the path segment
  // is missing or is the literal "[id]" placeholder after an internal rewrite.
  if ((!v || v.includes('[')) && req.query && typeof req.query[name] === 'string') {
    v = req.query[name];
  }
  return v;
}

export const isCaseId = (v) => typeof v === 'string' && /^c_[A-Za-z0-9]{6,64}$/.test(v);
export const isUserId = (v) => typeof v === 'string' && /^u_[A-Za-z0-9]{6,64}$/.test(v);

/* ---------- per-key async mutex (single-instance best effort) ---------- */
const locks = new Map();
export async function withLock(key, fn) {
  while (locks.has(key)) await locks.get(key);
  let release;
  const held = new Promise((r) => { release = r; });
  locks.set(key, held);
  try {
    return await fn();
  } finally {
    locks.delete(key);
    release();
  }
}

/* ---------- rate limiting ---------- */
const buckets = new Map();
export function tooMany(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now - b.start > b.windowMs) buckets.delete(k);
    }
    while (buckets.size > 5000) buckets.delete(buckets.keys().next().value);
  }
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return false;
  }
  b.count += 1;
  return b.count > max;
}

export function limiterKey(req) {
  // On Vercel the platform sets x-forwarded-for; anywhere else the header is
  // attacker-controlled, so only the socket address may be trusted.
  if (process.env.VERCEL) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* ---------- body reading ----------
   http.js readJson() destroys the socket on an oversized body, which kills the
   connection before the 413 can be written (client sees a reset, not an error).
   This variant pauses the stream, lets the 413 flush, then closes. */
export function readJsonSafe(req, res, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const badBody = () => Object.assign(new Error('Invalid JSON body.'), { status: 400 });
    if (req.body !== undefined && req.body !== null) {
      // Vercel may have pre-parsed the body
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(String(req.body) || '{}')); }
      catch { return reject(badBody()); }
    }
    let size = 0;
    let overflowed = false;
    const chunks = [];
    req.on('data', (c) => {
      if (overflowed) return;
      size += c.length;
      if (size > limitBytes) {
        overflowed = true;
        req.pause();
        if (res) {
          res.setHeader('connection', 'close');
          res.once('finish', () => { try { req.destroy(); } catch { /* already gone */ } });
        }
        reject(Object.assign(new Error('Body too large.'), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (overflowed) return;
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(badBody()); }
    });
    req.on('error', (e) => { if (!overflowed) reject(e); });
  });
}

/* ---------- live account check ---------- */
export async function ensureActiveUser(session, res) {
  const u = await db.get('users/' + session.uid + '.json');
  if (!u || u.active === false) {
    sendJson(res, 403, { error: 'This account has been deactivated.' });
    return null;
  }
  return u;
}
