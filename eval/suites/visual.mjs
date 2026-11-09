// The home page's 3D plane as people see it, and what the first visit costs.
// The WebGL canvas is read back (preserveDrawingBuffer forced on for the test only) to find where the
// model's pixels are: it must stay wholly inside its panel through the fly-in and the slow turn, fill a
// fair share of it, sit near the centre, and not run under the panel's buttons. Exploded, every label
// must be inside the panel and clear of the others. Also: frame rate, first-visit bytes, and screenshots
// of every page for review (eval/reports/shots).
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { VIEWPORTS, ROUTES, MOTION, BUDGETS } from '../benchmark.mjs';
import { go } from './pages.mjs';

const KEEP_PIXELS = `{
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, o) { return get.call(this, type, /webgl/.test(type) ? { ...o, preserveDrawingBuffer: true } : o); };
}`;

// Bounding box of the model's pixels (alpha > 0), in CSS px relative to the panel, plus the panel's controls.
function modelBox() {
  const stage = document.querySelector('figure canvas')?.parentElement; if (!stage) return null;
  const c = stage.querySelector('canvas'), w = c.width, h = c.height;
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  const x = t.getContext('2d'); x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const s = c.clientWidth / w, r = stage.getBoundingClientRect();
  const rel = (e) => { const b = e.getBoundingClientRect(); return { x0: b.left - r.left, y0: b.top - r.top, x1: b.right - r.left, y1: b.bottom - r.top }; };
  const labels = [...stage.querySelectorAll('.plane-label')].filter((l) => +l.style.opacity > 0.5).map((l) => ({ text: l.textContent, ...rel(l) }));
  const controls = [...stage.parentElement.querySelectorAll(':scope > button, :scope > a')].map(rel);
  return { W: r.width, H: r.height, box: x1 < 0 ? null : { x0: x0 * s, y0: y0 * s, x1: (x1 + 1) * s, y1: (y1 + 1) * s }, labels, controls };
}

const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

export async function fps(page, ms = 3000) {
  return page.evaluate((ms) => new Promise((done) => {
    const d = []; let last = performance.now(); const end = last + ms;
    const f = (t) => { d.push(t - last); last = t; t < end ? requestAnimationFrame(f) : done(d); };
    requestAnimationFrame(f);
  }), ms).then((d) => {
    const s = d.slice(2).sort((a, b) => a - b), q = (p) => 1000 / s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { median: Math.round(q(0.5)), p5: Math.round(q(0.95)) };
  });
}

export async function run({ check, base, launch, here }) {
  const browser = await launch();
  const shots = path.join(here, 'reports', 'shots');
  await mkdir(shots, { recursive: true });
  try {
    const gpu = await (async () => {
      const p = await browser.newPage(); await p.goto('about:blank');
      const r = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return g ? g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER) : 'none'; });
      await p.close(); return r;
    })();
    console.log('  WebGL renderer:', gpu);

    // Placement through the fly-in and turn, per viewport.
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
      await page.evaluateOnNewDocument(KEEP_PIXELS);
      await go(page, base + '/');
      await page.waitForSelector('figure canvas', { timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2800)); // the fly-in
      const issues = new Set(); let minFill = 1, maxOff = 0, controlHit = 0;
      for (let i = 0; i < 8; i++) {
        const m = await page.evaluate(modelBox);
        if (!m?.box) { issues.add('model not drawn'); break; }
        const { W, H, box: b } = m, e = 1;
        if (b.x0 <= e || b.y0 <= e || b.x1 >= W - e || b.y1 >= H - e) issues.add(`clipped at the panel edge (${Math.round(b.x0)},${Math.round(b.y0)})–(${Math.round(b.x1)},${Math.round(b.y1)}) in ${Math.round(W)}×${Math.round(H)}`);
        minFill = Math.min(minFill, Math.max((b.x1 - b.x0) / W, (b.y1 - b.y0) / H)); // the limiting dimension: a tall panel can't be filled top to bottom
        maxOff = Math.max(maxOff, Math.abs((b.x0 + b.x1) / 2 - W / 2) / W, Math.abs((b.y0 + b.y1) / 2 - H / 2) / H);
        for (const c of m.controls) controlHit = Math.max(controlHit, overlap(b, c) / ((c.x1 - c.x0) * (c.y1 - c.y0) || 1));
        await new Promise((r) => setTimeout(r, 1500));
      }
      check('visual', `3D plane (${vp.name}): wholly inside its panel through the turn`, !issues.size, issues.size, 0, [...issues].join('; '));
      check('visual', `3D plane (${vp.name}): spans at least 60% of its panel's width or height`, minFill >= 0.6, +minFill.toFixed(2), '≥0.6');
      check('visual', `3D plane (${vp.name}): centred (off by ≤ 12%)`, maxOff <= 0.12, +maxOff.toFixed(2), '≤0.12');
      check('visual', `3D plane (${vp.name}): clear of the panel's buttons (≤ 15% under one)`, controlHit <= 0.15, +controlHit.toFixed(2), '≤0.15');
      await page.screenshot({ path: path.join(shots, `plane-${vp.name}.png`) });

      // Exploded with labels: click the aircraft's own button (keyboard path), wait for the parts to settle.
      await page.evaluate(() => document.querySelector('figure button[aria-pressed]')?.click());
      await new Promise((r) => setTimeout(r, 2200));
      const m = await page.evaluate(modelBox);
      const out = [];
      if (m?.box && (m.box.x0 <= 1 || m.box.y0 <= 1 || m.box.x1 >= m.W - 1 || m.box.y1 >= m.H - 1)) out.push('model clipped');
      for (const l of m?.labels ?? []) if (l.x0 < 0 || l.y0 < 0 || l.x1 > m.W || l.y1 > m.H) out.push(`label "${l.text}" outside`);
      const ls = m?.labels ?? [];
      for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) if (overlap(ls[i], ls[j]) > 0) out.push(`"${ls[i].text}" on "${ls[j].text}"`);
      if (ls.length < 6) out.push(`${ls.length} labels shown`);
      check('visual', `3D plane (${vp.name}) apart: parts and all 6 labels in view, no label on another`, !out.length, out.length, 0, out.join('; '));
      await page.screenshot({ path: path.join(shots, `plane-${vp.name}-apart.png`) });
      await page.close();
    }

    // Frame rate of the home plane (desktop size).
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await go(page, base + '/');
    await new Promise((r) => setTimeout(r, 3000));
    const f = await fps(page);
    check('visual', `home 3D plane: ≥ ${MOTION.fps} fps median, ≥ ${MOTION.fpsP5} at p5`, f.median >= MOTION.fps && f.p5 >= MOTION.fpsP5, `${f.median}/${f.p5}`, `${MOTION.fps}/${MOTION.fpsP5}`, gpu);
    await page.close();

    // Reduced motion draws the model once; a resize (a phone turning) must not leave the panel blank.
    const rm = await browser.newPage();
    await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rm.evaluateOnNewDocument(KEEP_PIXELS);
    await rm.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await go(rm, base + '/');
    await new Promise((r) => setTimeout(r, 1200));
    const before = await rm.evaluate(modelBox);
    await rm.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 1200));
    const after = await rm.evaluate(modelBox);
    check('visual', '3D plane with reduced motion: drawn, and redrawn after a resize', !!before?.box && !!after?.box, `${before?.box ? 'drawn' : 'blank'} → ${after?.box ? 'drawn' : 'blank'}`, 'drawn → drawn');
    await rm.close();

    // First visit to home on a phone: bytes by type, before any interaction. What the page itself loads is
    // what has arrived 2 s after the load event; the other pages' chunks are prefetched 3 s after it, so a
    // second visit watched for 7 s tells the prefetch apart.
    const visit = async (ms) => {
      const ctx = await browser.createBrowserContext();
      const p = await ctx.newPage();
      await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      // Bytes as transferred (Chrome's own count): a CDN streaming compressed files sends no content-length.
      const seen = new Map(), reqs = [], cdp = await p.createCDPSession();
      await cdp.send('Network.enable');
      cdp.on('Network.responseReceived', (e) => { if (e.response.url.startsWith(base)) seen.set(e.requestId, { url: e.response.url, type: e.type.toLowerCase(), head: e.response.encodedDataLength }); });
      cdp.on('Network.loadingFinished', (e) => { const r = seen.get(e.requestId); if (r) reqs.push({ ...r, n: e.encodedDataLength - r.head }); }); // body only, as the budgets were set
      await p.goto(base + '/', { waitUntil: 'load' });
      await new Promise((r) => setTimeout(r, ms));
      await ctx.close();
      return reqs;
    };
    const own = await visit(2000), all = await visit(7000);
    const source = await (await fetch(base + '/')).text(); // as served, before scripts add their own preloads
    const html = [...source.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => base + m[1]);
    const sum = (l) => l.reduce((a, r) => a + r.n, 0);
    const sizes = {};
    for (const r of own) sizes[r.type] = (sizes[r.type] ?? 0) + r.n;
    const js = own.filter((r) => r.type === 'script');
    const critical = sum(js.filter((r) => html.includes(r.url))), homeJs = sum(js), prefetch = sum(all.filter((r) => r.type === 'script')) - homeJs;
    const total = Object.values(sizes).reduce((a, b) => a + b, 0);
    const kb = (n) => `${(n / 1000).toFixed(0)} kB`;
    check('visual', `home first visit: render-blocking JS ≤ ${kb(BUDGETS.homeCriticalJs)}`, critical <= BUDGETS.homeCriticalJs, kb(critical), kb(BUDGETS.homeCriticalJs));
    check('visual', `home first visit: all of the home page's JS ≤ ${kb(BUDGETS.homeJs)}`, homeJs <= BUDGETS.homeJs, kb(homeJs), kb(BUDGETS.homeJs), js.sort((a, b) => b.n - a.n).slice(0, 6).map((r) => `${r.url.split('/').pop()} ${kb(r.n)}`).join(', '));
    check('visual', `home first visit: idle prefetch of other pages ≤ ${kb(BUDGETS.homePrefetch)}`, prefetch <= BUDGETS.homePrefetch, kb(prefetch), kb(BUDGETS.homePrefetch));
    check('visual', `home first visit: CSS ≤ ${kb(BUDGETS.homeCss)}`, (sizes.stylesheet ?? 0) <= BUDGETS.homeCss, kb(sizes.stylesheet ?? 0), kb(BUDGETS.homeCss));
    check('visual', `home first visit: fonts ≤ ${kb(BUDGETS.homeFonts)}`, (sizes.font ?? 0) <= BUDGETS.homeFonts, kb(sizes.font ?? 0), kb(BUDGETS.homeFonts));
    check('visual', `home first visit: total ≤ ${kb(BUDGETS.homeTotal)}`, total <= BUDGETS.homeTotal, kb(total), kb(BUDGETS.homeTotal), JSON.stringify(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, kb(v)]))));

    // Screenshots of every page, phone and desktop, for a human (or model) eye.
    for (const vp of VIEWPORTS.filter((v) => ['phone', 'desktop'].includes(v.name))) {
      const s = await browser.newPage();
      await s.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.mobile, deviceScaleFactor: 1 });
      await s.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      // A full-page capture doesn't count as on screen: render the sections content-visibility would skip.
      await s.evaluateOnNewDocument("addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*{content-visibility:visible!important}'; document.head.append(st); })");
      for (const route of ROUTES) {
        await go(s, base + route);
        // Scroll through first so lazy images are in, then back to the top.
        await s.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
        await s.waitForNetworkIdle({ idleTime: 400, timeout: 10000 }).catch(() => {});
        await s.screenshot({ path: path.join(shots, `${vp.name}${route.replace(/\//g, '_') || '_home'}.jpg`), fullPage: true, quality: 60, type: 'jpeg' });
      }
      await s.close();
    }
  } finally {
    await browser.close();
  }
}
