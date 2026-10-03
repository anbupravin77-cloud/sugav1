/* HTTP helpers shared by every handler (framework-agnostic). */

export function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

export function methodNotAllowed(res, allow) {
  res.setHeader('allow', allow.join(', '));
  sendJson(res, 405, { error: 'Method not allowed.' });
}

/* Read + parse a JSON body with a hard size cap. Resolves {} for empty bodies. */
export function readJson(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      // Vercel may have pre-parsed the body
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(String(req.body) || '{}')); }
      catch { return reject(badBody()); }
    }
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { reject(Object.assign(new Error('Body too large.'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(badBody()); }
    });
    req.on('error', reject);
  });
}
const badBody = () => Object.assign(new Error('Invalid JSON body.'), { status: 400 });

export function getUrl(req) {
  return new URL(req.url, 'http://internal');
}

/* Naive in-memory rate limiter (best-effort; per server instance). */
const buckets = new Map();
export function rateLimited(key, max = 8, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return false;
  }
  b.count += 1;
  if (buckets.size > 5000) buckets.clear();
  return b.count > max;
}

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* Uniform error boundary for handlers. */
export async function guard(res, fn) {
  try {
    await fn();
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    if (status >= 500) console.error('[api]', e);
    sendJson(res, status, { error: status >= 500 ? 'Something went wrong on our side.' : e.message });
  }
}
