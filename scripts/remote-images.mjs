// Copies the photos the dashboard links to (gallery, sponsors, team) onto this site.
// OneDrive answers in 3–5 s per image; served from here they load like any local file.
// Writes public/img/r/<id>-<w>.webp, src/content/remote-images.json (URL → copy, or failed)
// and src/content/snapshot.json (the lists themselves).
// Already-copied URLs are skipped, so re-runs only fetch what's new. Photos added after a build
// still show: the site falls back to the original link until the next run.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const API = 'https://quatlasserver.vercel.app/api';
const OUT = 'public/img/r';
const MANIFEST = 'src/content/remote-images.json';
const SNAPSHOT = 'src/content/snapshot.json';
const WIDTHS = [400, 800, 1600];
// OneDrive refuses requests that don't look like a browser.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

const json = async (path) => (await fetch(API + path, { headers: HEADERS, signal: AbortSignal.timeout(30000) })).json();
const exists = (f) => access(f).then(() => true, () => false);
const id = (url) => createHash('sha1').update(url).digest('hex').slice(0, 12);

// Ask the host for a large rendition instead of the 6000 px original.
function source(url) {
  const u = new URL(url);
  if (u.host === 'drive.google.com') {
    const d = u.pathname.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id');
    if (d) return `https://drive.google.com/thumbnail?id=${d}&sz=w1600`;
  }
  if (u.host === '1drv.ms' && u.searchParams.has('width')) {
    u.searchParams.set('width', '1600');
    u.searchParams.set('height', '1600');
  }
  return u.href;
}

let manifest = {};
try { manifest = JSON.parse(await readFile(MANIFEST, 'utf8')); } catch { /* first run */ }

let urls;
try {
  const [gallery, sponsors, members] = await Promise.all([json('/gallery/images'), json('/spslist/items'), json('/members/memberData')]);
  urls = [...gallery.map((g) => g.img), ...sponsors.map((s) => s.img), ...members[0].teams.flatMap((t) => t.roleData.map((m) => m.img))];
  // The pages render this snapshot first (and prerender it), then refresh from the API.
  await writeFile(SNAPSHOT, JSON.stringify({ gallery, sponsors, members }));
  // The home stats strip only needs the roster size, so it gets this instead of the whole snapshot.
  // (Alumni don't count; same rule as isAlumni in src/content/teams.js.)
  const roster = members[0].teams.filter((t) => !/^alumi?ni$/i.test(t.roleName.trim())).reduce((n, t) => n + t.roleData.length, 0);
  await writeFile('src/content/counts.json', `${JSON.stringify({ members: roster })}\n`);
} catch (e) {
  console.warn(`remote-images: API unreachable (${e.message}); keeping the existing copies.`);
  process.exit(0);
}
urls = [...new Set(urls.filter((u) => /^https?:\/\//.test(u ?? '')))];
await mkdir(OUT, { recursive: true });

async function copy(url) {
  const name = id(url);
  const known = manifest[url];
  // Failures are retried every run: OneDrive sometimes answers 503 and recovers.
  if (known && !known.failed && (await exists(`${OUT}/${name}-${known.widths.at(-1)}.webp`))) return 'cached';
  try {
    const res = await fetch(source(url), { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(45000) });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
      // Only a page instead of an image, or a 404, means the link itself is dead.
      throw Object.assign(new Error(`${res.status} ${res.headers.get('content-type')}`), { dead: res.ok || res.status === 404 });
    }
    const img = sharp(Buffer.from(await res.arrayBuffer())).rotate();
    const { width, height } = await img.metadata();
    const widths = [...new Set(WIDTHS.filter((w) => w < width).concat(Math.min(width, 1600)))];
    for (const w of widths) await img.clone().resize({ width: w }).webp({ quality: 72 }).toFile(`${OUT}/${name}-${w}.webp`);
    const h = Math.round((height * Math.min(width, 1600)) / width);
    manifest[url] = { name, w: Math.min(width, 1600), h, widths };
    return 'copied';
  } catch (e) {
    // A dead link shows initials at once; anything else (5xx, timeout, a build server OneDrive won't
    // answer) is left out, so the site keeps loading it from the original host.
    if (e.dead) manifest[url] = { failed: String(e.message).slice(0, 80) };
    else delete manifest[url];
    return 'failed';
  }
}

// Six at a time: OneDrive is slow per request, not per byte.
const tally = { copied: 0, cached: 0, failed: 0 };
const queue = [...urls];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) tally[await copy(queue.shift())]++; }));
for (const u of Object.keys(manifest)) if (!urls.includes(u)) delete manifest[u]; // removed in the dashboard
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`remote-images: ${urls.length} links, ${tally.copied} copied, ${tally.cached} cached, ${tally.failed} failed`);
