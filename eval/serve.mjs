// Serves dist/ the way Vercel does, so measurements match production: clean URLs, the SPA rewrite to
// /app, the redirects and headers from vercel.json, and brotli/gzip on text (Vercel's CDN compresses).
// node serve.mjs [port]   (default 4400)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(SITE, process.env.EVAL_DIST ?? 'dist'); // EVAL_DIST=dist-prof: an unminified build, for profiling
const cfg = JSON.parse(await readFile(path.join(SITE, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.txt': 'text/plain', '.ico': 'image/x-icon', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const TEXT = /^(text\/|application\/(json|xml|manifest))|svg/;
const toRe = (src) => new RegExp(`^${src.replace(/\(\.\*\)/g, '(.*)')}$`);
const cache = new Map();

async function file(p) {
  try { const s = await stat(p); if (s.isFile()) return p; } catch { /* not there */ }
  return null;
}

async function resolve(url) {
  const clean = decodeURIComponent(url.split('?')[0]).replace(/\/+$/, '') || '/';
  if (clean.includes('..')) return null;
  const base = path.join(DIST, clean);
  return (await file(base)) ?? (await file(base + '.html')) ?? (await file(path.join(base, 'index.html')));
}

export function start(port = 4400) {
  const server = http.createServer(async (req, res) => {
    const url = req.url;
    for (const r of cfg.redirects ?? []) if (url.split('?')[0] === r.source) { res.writeHead(r.permanent ? 308 : 307, { Location: r.destination }); return res.end(); }
    let p = await resolve(url), status = 200;
    if (!p && !url.startsWith('/api/')) p = await file(path.join(DIST, 'app.html')); // the SPA rewrite
    if (!p) { res.writeHead(404); return res.end('not found'); }
    const type = TYPES[path.extname(p)] ?? 'application/octet-stream';
    const headers = { 'Content-Type': type };
    for (const h of cfg.headers ?? []) if (toRe(h.source).test(url.split('?')[0])) for (const { key, value } of h.headers) headers[key] = value;
    headers['Cache-Control'] ??= 'public, max-age=0, must-revalidate';
    let body = await readFile(p);
    const enc = req.headers['accept-encoding'] ?? '';
    if (TEXT.test(type) && body.length > 1024) {
      const key = p + (enc.includes('br') ? ':br' : enc.includes('gzip') ? ':gz' : '');
      if (enc.includes('br')) { body = cache.get(key) ?? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }); headers['Content-Encoding'] = 'br'; }
      else if (enc.includes('gzip')) { body = cache.get(key) ?? gzipSync(body, { level: 9 }); headers['Content-Encoding'] = 'gzip'; }
      cache.set(key, body);
      headers.Vary = 'Accept-Encoding';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2] ?? 4400);
  await start(port);
  console.log(`dist on http://localhost:${port}`);
}
