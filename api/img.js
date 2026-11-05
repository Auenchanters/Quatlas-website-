// Serves a dashboard photo link (OneDrive / Google Drive) as a resized WebP, so a photo works the moment
// it is saved, before the next build copies it onto the site. The CDN caches each result for a week.
import sharp from 'sharp';

const ALLOWED = /(^|\.)(1drv\.ms|1drv\.com|onedrive\.live\.com|livefilestore\.com|sharepoint\.com|svc\.ms|drive\.google\.com|googleusercontent\.com)$/;
const MAX_BYTES = 30 * 1024 * 1024;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

// Only the three widths the site asks for, so nobody can make the CDN cache (and sharp) work per pixel.
const WIDTHS = [400, 800, 1600];
export const widthFor = (w) => { const n = parseInt(w, 10); return Number.isFinite(n) ? WIDTHS.find((x) => x >= n) ?? 1600 : 800; };

// Reads a response body but gives up (null) the moment it passes max bytes, instead of downloading it all.
export async function readCapped(body, max) {
  const parts = [], reader = body.getReader();
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(parts);
    size += value.length;
    if (size > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
}

function source(u) {
  if (u.hostname === 'drive.google.com') {
    const id = u.pathname.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id');
    if (id) return new URL(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
  }
  return u;
}

export default async function handler(req, res) {
  let u;
  try { u = new URL(req.query.url); } catch { return res.status(400).send('Bad url'); }
  if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(400).send('Host not allowed');
  const width = widthFor(req.query.w);
  try {
    const r = await fetch(source(u), { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !ALLOWED.test(new URL(r.url).hostname) || !type.startsWith('image/')) return res.status(404).send('Not an image');
    if (+r.headers.get('content-length') > MAX_BYTES) return res.status(413).send('Too large');
    const buf = await readCapped(r.body, MAX_BYTES);
    if (!buf) return res.status(413).send('Too large');
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return res.send(out);
  } catch {
    return res.status(502).send('Could not fetch the photo');
  }
}
