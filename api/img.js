// Serves a dashboard photo link (OneDrive / Google Drive) as a resized WebP, so a photo works the moment
// it is saved, before the next build copies it onto the site. The CDN caches each result for a week.
import sharp from 'sharp';

const ALLOWED = /(^|\.)(1drv\.ms|1drv\.com|onedrive\.live\.com|livefilestore\.com|sharepoint\.com|svc\.ms|drive\.google\.com|googleusercontent\.com)$/;
const MAX_BYTES = 30 * 1024 * 1024;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

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
  const width = Math.min(1600, Math.max(64, parseInt(req.query.w, 10) || 800));
  try {
    const r = await fetch(source(u), { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !ALLOWED.test(new URL(r.url).hostname) || !type.startsWith('image/')) return res.status(404).send('Not an image');
    if (+r.headers.get('content-length') > MAX_BYTES) return res.status(413).send('Too large');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).send('Too large');
    const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return res.send(out);
  } catch {
    return res.status(502).send('Could not fetch the photo');
  }
}
