/* Storage driver: FileStore (local disk) now, BlobStore (Vercel) at deploy phase.
   Every record is AES-256-GCM encrypted with DATA_KEY before it is persisted. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAGIC = Buffer.from('SGE1');
const DATA_KEY = process.env.DATA_KEY && /^[0-9a-f]{64}$/i.test(process.env.DATA_KEY)
  ? Buffer.from(process.env.DATA_KEY, 'hex')
  : null;

function encrypt(plainText) {
  const plain = Buffer.from(plainText, 'utf8');
  if (!DATA_KEY) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DATA_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

function decrypt(buf) {
  if (buf.length < 4 || !buf.subarray(0, 4).equals(MAGIC)) return buf.toString('utf8');
  if (!DATA_KEY) throw new Error('encrypted record but DATA_KEY is not set');
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', DATA_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function assertSafePath(p) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(p) || p.includes('..') || p.startsWith('/')) {
    throw new Error('unsafe store path: ' + p);
  }
}

class FileStore {
  constructor() {
    this.root = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), '.localdata');
  }
  fp(p) { assertSafePath(p); return path.join(this.root, p); }
  async put(p, obj) {
    const file = this.fp(p);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, encrypt(JSON.stringify(obj)));
  }
  async get(p) {
    try {
      const buf = await fs.readFile(this.fp(p));
      return JSON.parse(decrypt(buf));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  async del(p) {
    try { await fs.unlink(this.fp(p)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  async list(prefix) {
    assertSafePath(prefix);
    const dir = path.join(this.root, prefix);
    const out = [];
    const walk = async (d) => {
      let entries;
      try { entries = await fs.readdir(d, { withFileTypes: true }); }
      catch (e) { if (e.code === 'ENOENT') return; throw e; }
      for (const en of entries) {
        const full = path.join(d, en.name);
        if (en.isDirectory()) await walk(full);
        else {
          const stat = await fs.stat(full);
          out.push({
            path: path.relative(this.root, full).split(path.sep).join('/'),
            uploadedAt: stat.mtime.toISOString(),
          });
        }
      }
    };
    await walk(dir);
    return out;
  }
}

class BlobStore {
  /* Deploy-phase driver — verified against @vercel/blob v2.6.1 private-store API.
     put(access:'private') stores an opaque octet blob; get(path,{access:'private'})
     returns {statusCode, stream} which we drain to a Buffer. Token read from
     BLOB_READ_WRITE_TOKEN (auto on Vercel; passed explicitly for safety). */
  async lib() { if (!this._lib) this._lib = await import('@vercel/blob'); return this._lib; }
  get token() { return process.env.BLOB_READ_WRITE_TOKEN; }
  async put(p, obj) {
    assertSafePath(p);
    const { put } = await this.lib();
    await put(p, encrypt(JSON.stringify(obj)), {
      access: 'private', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/octet-stream', token: this.token,
    });
  }
  async get(p) {
    assertSafePath(p);
    const { get } = await this.lib();
    try {
      const res = await get(p, { access: 'private', useCache: false, token: this.token });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
      return JSON.parse(decrypt(buf));
    } catch (e) {
      if (e && (e.name === 'BlobNotFoundError' || /not.?found/i.test(String(e.message)))) return null;
      throw e;
    }
  }
  async del(p) {
    assertSafePath(p);
    const { del } = await this.lib();
    try { await del(p, { token: this.token }); } catch { /* absent is fine */ }
  }
  async list(prefix) {
    const { list } = await this.lib();
    const out = [];
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000, token: this.token });
      for (const b of page.blobs) out.push({ path: b.pathname, uploadedAt: b.uploadedAt });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
}

const useBlob = process.env.DB_DRIVER === 'blob' ||
  (process.env.VERCEL && process.env.BLOB_READ_WRITE_TOKEN);

export const db = useBlob ? new BlobStore() : new FileStore();

/* id helpers — case ids sort newest-last by pathname (epoch ms prefix) */
export function newCaseId() {
  return 'c_' + Date.now().toString().padStart(14, '0') + crypto.randomBytes(4).toString('hex');
}
export function newUserId() { return 'u_' + crypto.randomBytes(8).toString('hex'); }
export function newRef() {
  return 'SH-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}
