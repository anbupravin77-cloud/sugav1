/* Suga.health — LOCAL server: static site + /api routes → lib/handlers.
   Run:  node server.local.js   → http://localhost:4180
   Uses on-disk FileStore at ./.localdata (encrypted with DATA_KEY from .env.local). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/* tiny .env.local loader (never overrides already-set vars) */
try {
  const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env.local — dev defaults apply */ }
process.env.LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(ROOT, '.localdata');
delete process.env.VERCEL; // never select the Blob driver locally

const PORT = Number(process.env.PORT || 4180);

/* ---------- API routes (same handler modules the Vercel wrappers use) ---------- */
const routes = [
  ['POST', /^\/api\/setup$/, () => import('./lib/handlers/setup.js')],
  ['*',    /^\/api\/auth\/(login|logout|me|change-password)$/, () => import('./lib/handlers/auth.js')],
  ['POST', /^\/api\/intake$/, () => import('./lib/handlers/intake.js')],
  ['*',    /^\/api\/cases\/[^/]+\/notes$/, () => import('./lib/handlers/notes.js')],
  ['*',    /^\/api\/cases\/[^/]+\/plan$/, () => import('./lib/handlers/plan.js')],
  ['*',    /^\/api\/cases\/[^/]+\/prescription$/, () => import('./lib/handlers/prescription.js')],
  ['*',    /^\/api\/cases\/[^/]+\/review$/, () => import('./lib/handlers/review.js')],
  ['*',    /^\/api\/cases\/[^/]+\/ai-draft$/, () => import('./lib/handlers/ai-draft.js')],
  ['*',    /^\/api\/protocol$/, () => import('./lib/handlers/protocol.js')],
  ['*',    /^\/api\/cases\/[^/]+$/, () => import('./lib/handlers/case-detail.js')],
  ['*',    /^\/api\/cases$/, () => import('./lib/handlers/cases.js')],
  ['*',    /^\/api\/doctors\/[^/]+$/, () => import('./lib/handlers/doctors.js')],
  ['*',    /^\/api\/doctors$/, () => import('./lib/handlers/doctors.js')],
  ['GET',  /^\/api\/stats$/, () => import('./lib/handlers/stats.js')],
];

/* ---------- static files ---------- */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const BLOCKED_SEGMENTS = new Set(['lib', 'api', 'node_modules', '.localdata', '.vercel']);
const BLOCKED_FILES = new Set(['server.local.js', 'package.json', 'package-lock.json']);

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
  const segments = path.relative(ROOT, file).split(path.sep);
  const denied = segments.some((s) => s.startsWith('.')) ||
    BLOCKED_SEGMENTS.has(segments[0]) ||
    BLOCKED_FILES.has(segments[segments.length - 1]) ||
    file.toLowerCase().endsWith('.md');
  if (denied) { res.statusCode = 404; res.setHeader('content-type', 'text/plain'); return res.end('Not found'); }
  if (!path.extname(file) && !fs.existsSync(file)) file += '.html'; // clean-url parity with Vercel
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; res.setHeader('content-type', 'text/plain'); return res.end('Not found'); }
    res.setHeader('content-type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname.startsWith('/api/')) {
    for (const [method, re, load] of routes) {
      if (re.test(pathname) && (method === '*' || method === req.method)) {
        try {
          const mod = await load();
          return await mod.default(req, res);
        } catch (e) {
          console.error('[route]', pathname, e);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify({ error: 'Something went wrong on our side.' }));
        }
      }
    }
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'No such endpoint.' }));
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log('Suga.health local server → http://localhost:' + PORT);
  console.log('  site     http://localhost:' + PORT + '/');
  console.log('  portal   http://localhost:' + PORT + '/portal/login.html');
  console.log('  data dir ' + process.env.LOCAL_DATA_DIR + (process.env.DATA_KEY ? ' (encrypted)' : ' (PLAINTEXT — no DATA_KEY)'));
});
