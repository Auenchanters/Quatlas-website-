// What can be judged without a browser: unit tests, the prerendered HTML of every public page, chunk
// sizes, and the crawl files.
import { execSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { brotliCompressSync } from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROUTES } from '../benchmark.mjs';

export async function run({ check, site }) {
  // Unit tests (games' rules, stats, the image relay, motion gate…).
  let out = '', ok = true;
  try { out = execSync('npm test 2>&1', { cwd: site, encoding: 'utf8' }); } catch (e) { out = e.stdout ?? String(e); ok = false; }
  const pass = +(out.match(/[#ℹ] pass (\d+)/)?.[1] ?? 0), fail = +(out.match(/[#ℹ] fail (\d+)/)?.[1] ?? 0);
  check('static', 'unit tests pass', ok && fail === 0 && pass > 0, `${pass} pass / ${fail} fail`, 'all pass', ok ? '' : out.split('\n').filter((l) => /not ok|Error/.test(l)).slice(0, 8).join(' | '));

  // Prerendered pages: real content, unique title, description, one h1, a canonical link and social cards.
  const dist = path.join(site, 'dist'), titles = new Map();
  for (const r of ROUTES) {
    const file = path.join(dist, r, 'index.html');
    let html;
    try { html = await readFile(file, 'utf8'); } catch { check('static', `${r}: prerendered`, false, 'missing', 'dist' + r + '/index.html'); continue; }
    // The root is followed by the after-first-paint loader script (scripts/prerender.mjs).
    const body = html.match(/<div id="root"[^>]*>([\s\S]*)<\/div>(?:<script>[\s\S]*?<\/script>)?\s*<\/body>/)?.[1] ?? '';
    const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = html.match(/<title>([^<]*)<\/title>/g) ?? [];
    const h1 = (body.match(/<h1[\s>]/g) ?? []).length;
    const desc = html.match(/<meta name="description" content="([^"]*)"/g) ?? [];
    const problems = [
      text.length < 200 && `only ${text.length} chars of text`,
      title.length !== 1 && `${title.length} <title>`,
      desc.length !== 1 && `${desc.length} descriptions`,
      h1 !== 1 && `${h1} h1`,
      !/<link rel="canonical"/.test(html) && 'no canonical',
      !/property="og:title"/.test(html) && 'no og:title',
      !/property="og:image"/.test(html) && 'no og:image',
      // React outlines a big <Suspense> boundary into a hidden block a script moves in later: the page
      // paints without it first, then jumps.
      /<div hidden id="S:\d+"/.test(html) && 'content outlined by Suspense (paints late, shifts the page)',
    ].filter(Boolean);
    check('static', `${r}: prerendered HTML complete`, !problems.length, problems.length, 0, problems.join(', '));
    const t = title[0]?.replace(/<\/?title>/g, '');
    if (t) titles.set(t, [...(titles.get(t) ?? []), r]);
  }
  const dupes = [...titles].filter(([, rs]) => rs.length > 1);
  check('static', 'every page has its own <title>', !dupes.length, dupes.length, 0, dupes.map(([t, rs]) => `"${t}": ${rs.join(' ')}`).join('; '));

  // Chunks: none so big it stalls a phone. Brotli bytes, as served.
  const assets = path.join(dist, 'assets');
  const big = [];
  for (const f of await readdir(assets)) {
    if (!/\.(js|css)$/.test(f)) continue;
    const br = brotliCompressSync(await readFile(path.join(assets, f))).length;
    if (br > 160_000) big.push(`${f} ${(br / 1000).toFixed(0)} kB`);
  }
  check('static', 'no JS/CSS chunk over 160 kB brotli', !big.length, big.length, 0, big.join(', '));

  // Crawl files: robots.txt must not hide public pages, and a sitemap lists them.
  const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8').catch(() => '');
  // Disallow is a plain prefix match: "Disallow: /team" also hides /team/pilots.
  const blocked = ROUTES.filter((r) => robots.split('\n').some((l) => { const d = l.match(/^Disallow:\s*(\S+)/i)?.[1]; return d && r.startsWith(d); }));
  check('static', 'robots.txt blocks no public page', !blocked.length, blocked.length, 0, blocked.join(' '));
  const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8').catch(() => '');
  const { META } = await import(pathToFileURL(path.join(site, 'src', 'content', 'meta.js')).href);
  const missing = ROUTES.filter((r) => !META[r]?.noindex && !sitemap.includes(`${r === '/' ? '' : r}</loc>`));
  check('static', 'sitemap.xml lists every public page', sitemap && !missing.length, sitemap ? missing.length : 'no sitemap', 0, missing.join(' '));
  check('static', 'robots.txt points to the sitemap', /Sitemap:\s*https?:\/\//i.test(robots), /Sitemap:/i.test(robots), true);

}
