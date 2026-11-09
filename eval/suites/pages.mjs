// Every public route, at every viewport, in both themes, in a real Chrome against the production build.
// Per load: no console errors, page errors or failed requests; no sideways scroll; no broken or oversized
// images; no axe violations; tiny layout shift while loading and scrolling; nothing left invisible after
// the scroll reveals; tap targets big enough on touch screens; every internal link lands on a real page.
// Then: client-side navigation speed, the phone menu, the theme cord, keyboard focus, reduced motion.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ROUTES, VIEWPORTS, PAGES, BUDGETS } from '../benchmark.mjs';

const require = createRequire(import.meta.url);
const AXE = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const IGNORED_HOSTS = /googletagmanager|google-analytics|analytics\.google/;
const quick = process.argv.includes('--quick');

// Load, then wait for the network to settle (bounded: a looping video never settles).
export async function go(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => {});
}

export function watch(page, base) {
  const log = { errors: [], failed: [], bytes: {}, sizes: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { const f = r.failure()?.errorText; if (!IGNORED_HOSTS.test(r.url()) && f !== 'net::ERR_ABORTED') log.failed.push(`${f} ${r.url()}`); });
  page.on('response', async (r) => {
    const url = r.url();
    if (r.status() >= 400 && !IGNORED_HOSTS.test(url)) log.failed.push(`${r.status()} ${url}`);
    const len = +(r.headers()['content-length'] ?? 0);
    const type = r.request().resourceType();
    log.bytes[type] = (log.bytes[type] ?? 0) + len;
    if (type === 'image' && url.startsWith(base)) log.sizes.push([len, url.replace(base, '')]);
  });
  return log;
}

// Scrolls the page top to bottom in viewport steps (driving the scroll reveals), then back to the top.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += innerHeight * 0.8) { window.scrollTo(0, y); await wait(140); }
    window.scrollTo(0, h()); await wait(700);
    // Reveals still playing are judged where they end up: wait for them (2 s at most).
    const finite = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity);
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => {}))), wait(2000)]);
  });
}

// Everything measured in the page after it has loaded and been scrolled.
function inspect(mobile) {
  // Sections far from the screen are skipped by content-visibility and have no boxes: render them all to measure.
  const all = document.createElement('style'); all.textContent = '*{content-visibility:visible!important}'; document.head.append(all);
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // Visually hidden on purpose (screen-reader text, a skip link until focused): not a layout problem.
  const srOnly = (el) => !!el.closest('.sr-only') || (getComputedStyle(el).clipPath !== 'none' && el.getBoundingClientRect().width <= 1);
  const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
  const out = {};
  // Sideways scroll and who causes it.
  const W = document.documentElement.clientWidth;
  out.overflow = document.documentElement.scrollWidth - W;
  out.wide = out.overflow > 0 ? [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 && vis(e) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(desc) : [];
  // Images.
  const imgs = [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight * 3);
  out.broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.currentSrc || i.src).slice(0, 5);
  out.oversized = imgs.filter((i) => vis(i) && i.naturalWidth > 0).map((i) => {
    const need = i.getBoundingClientRect().width * devicePixelRatio, ratio = i.naturalWidth / need;
    return ratio > 2.2 && i.naturalWidth > 600 ? `${(i.currentSrc || i.src).split('/').pop()} ${i.naturalWidth}px for ${Math.round(need)}px` : null;
  }).filter(Boolean).slice(0, 5);
  // Content the reveals left hidden: text-bearing elements still faded out or clipped after the full scroll.
  out.hidden = [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main img, main a.btn')].filter((e) => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
    // Out of sight inside a scroller (a photo further along a sideways strip) reveals when scrolled to: skip it.
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      if (!/auto|scroll|hidden/.test(getComputedStyle(a).overflowX)) continue;
      const q = a.getBoundingClientRect();
      if (r.right <= q.left || r.left >= q.right) return false;
      break;
    }
    let o = 1; for (let n = e; n && n !== document.body; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    const s = getComputedStyle(e);
    return o < 0.9 || s.visibility === 'hidden' || /inset\((?!0(px|%)? 0(px|%)? 0(px|%)? 0)/.test(s.clipPath);
  }).slice(0, 5).map((e) => { e.setAttribute('data-eval-hidden', ''); return desc(e) + ' "' + (e.textContent || e.alt || '').trim().slice(0, 40) + '"'; });
  // Text cut off by its own box (not deliberate ellipsis).
  out.clipped = [...document.querySelectorAll('main *')].filter((e) => {
    if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || srOnly(e)) return false;
    const s = getComputedStyle(e);
    if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' || !/hidden|clip/.test(s.overflowX + s.overflowY)) return false;
    return e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 4;
  }).slice(0, 5).map((e) => desc(e) + ' "' + e.textContent.trim().slice(0, 40) + '"');
  // Text pushed outside the nearest ancestor that hides overflow (a tile, a card): partly or wholly unseen.
  for (const e of document.querySelectorAll('main *')) {
    if (out.clipped.length >= 8 || !vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (e.closest('[aria-hidden="true"], .roll') || srOnly(e)) continue;
    const r = e.getBoundingClientRect();
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (!/hidden|clip/.test(s.overflowX + s.overflowY)) continue;
      const q = a.getBoundingClientRect();
      if (r.right > q.right + 1 || r.left < q.left - 1 || r.bottom > q.bottom + 1 || r.top < q.top - 1) out.clipped.push(desc(e) + ' "' + e.textContent.trim().slice(0, 30) + '" outside ' + desc(a));
      break;
    }
  }
  // Touch targets (WCAG 2.2 2.5.8): 24 px, unless inline in a sentence.
  // Links in running text look like links without hovering: underlined, or clearly another colour.
  const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  out.plainLinks = [...document.querySelectorAll('main p a:not(.btn)')].filter((a) => vis(a) && !srOnly(a) && a.parentElement.textContent.trim().length > a.textContent.trim().length + 3)
    .filter((a) => !getComputedStyle(a).textDecorationLine.includes('underline') && ratio(getComputedStyle(a).color, getComputedStyle(a.parentElement).color) < 3)
    .slice(0, 4).map((a) => `"${a.textContent.trim().slice(0, 30)}"`);
  // A short button label broken over two lines ("Take / flight") reads as a layout bug.
  for (const b of document.querySelectorAll('.btn, button, [role="tab"]')) {
    const t = b.textContent.trim();
    if (!vis(b) || srOnly(b) || !t || t.split(/\s+/).length > 3 || t.length > 28) continue;
    // Text boxes that overlap vertically share a line (a small count beside a label is on the same line).
    const boxes = [], walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.nodeValue.trim() || n.parentElement.closest('.sr-only')) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width > 1) boxes.push([q.top, q.bottom]);
    }
    let lines = 0, bottom = -Infinity;
    for (const [t, btm] of boxes.sort((x, y) => x[0] - y[0])) { if (t >= bottom - 2) lines++; bottom = Math.max(bottom, btm); }
    if (lines > 1) out.clipped.push(`${desc(b)} "${t}" wraps onto ${lines} lines`);
  }
  // Touch targets, WCAG 2.2 2.5.8: at least 24 × 24 px, or spaced so a 24 px circle on each one's centre
  // touches no other target (and no other small target's circle); links inside a sentence are exempt.
  // A target under something else at this scroll position (the sticky header over a footer link) is not
  // measured: there it can't be tapped at all, and the page scrolls it clear.
  const covered = (e) => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const top = document.elementFromPoint(x, y); return top && !e.contains(top) && !top.contains(e); };
  const targets = mobile ? [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary')].filter((e) => vis(e) && !srOnly(e) && !covered(e)) : [];
  const rects = targets.map((e) => e.getBoundingClientRect());
  const small = (r) => r.width < 24 || r.height < 24;
  const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  const gap = (c, r) => Math.hypot(Math.max(r.left - c[0], 0, c[0] - r.right), Math.max(r.top - c[1], 0, c[1] - r.bottom));
  out.small = targets.filter((e, i) => {
    const r = rects[i];
    if (!small(r)) return false;
    const p = e.parentElement, inline = getComputedStyle(e).display === 'inline' && p && p.textContent.trim().length > e.textContent.trim().length + 10;
    if (inline) return false;
    const c = centre(r);
    return rects.some((q, j) => j !== i && !targets[j].contains(e) && !e.contains(targets[j]) && (gap(c, q) < 12 || (small(q) && Math.hypot(c[0] - centre(q)[0], c[1] - centre(q)[1]) < 24)));
  }).slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return `${desc(e)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 25)}" ${Math.round(r.width)}×${Math.round(r.height)}`; });
  out.links = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h.startsWith('/') || h.startsWith('#')))];
  out.cls = window.__cls ?? 0;
  out.longest = window.__long ?? 0;
  out.h1 = document.querySelector('h1')?.textContent.trim();
  all.remove();
  return out;
}

const PRELUDE = (theme) => `
  try { localStorage.setItem('theme', '${theme}'); } catch {}
  window.__cls = 0; window.__long = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long = Math.max(window.__long, e.duration); }).observe({ type: 'longtask', buffered: true });`;

async function axe(page) {
  await page.evaluate(AXE);
  await page.evaluate(() => { const s = document.createElement('style'); s.id = 'eval-all'; s.textContent = '*{content-visibility:visible!important}'; document.head.append(s); });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    document.getElementById('eval-all')?.remove();
    return r.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')}`);
  });
}

export async function run({ check, base, launch }) {
  const browser = await launch();
  const links = new Set(), fails = {};
  const fail = (key, route, what) => ((fails[key] ??= []).push(`${route} ${what}`));
  const vps = quick ? VIEWPORTS.filter((v) => ['phone', 'desktop'].includes(v.name)) : VIEWPORTS;
  const themes = quick ? ['dark'] : ['dark', 'light'];
  try {
    for (const vp of vps) for (const theme of themes) {
      const ctx = await browser.createBrowserContext();
      let page = await ctx.newPage();
      const setup = async () => {
        await page.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
        await page.evaluateOnNewDocument(PRELUDE(theme));
      };
      await setup();
      const tag = `${vp.name}/${theme}`;
      for (const route of ROUTES) {
        const log = watch(page, base);
        try {
          await go(page, base + route);
        } catch (e) { fail('load', route, `${tag}: ${e.message}`); page.removeAllListeners(); page = await ctx.newPage(); await setup(); continue; }
        await new Promise((r) => setTimeout(r, 400));
        await scrollThrough(page);
        const r = await page.evaluate(inspect, !!vp.mobile);
        page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
        r.links.forEach((l) => links.add(l.startsWith('#') ? route + l : l));
        if (log.errors.length) fail('errors', route, `${tag}: ${log.errors.slice(0, 3).join(' | ')}`);
        if (log.failed.length) fail('requests', route, `${tag}: ${log.failed.slice(0, 3).join(' | ')}`);
        if (r.overflow > 0) fail('overflow', route, `${tag}: ${r.overflow}px by ${r.wide.join(', ')}`);
        if (r.broken.length) fail('broken', route, `${tag}: ${r.broken.join(', ')}`);
        if (r.oversized.length) fail('oversized', route, `${tag}: ${r.oversized.join(', ')}`);
        // Still hidden after the scroll: bring each into view and give it a moment. Only what stays invisible while
        // on screen is a fault (a block skipped past during a fast jump reveals when it is looked at).
        if (r.hidden.length) {
          const stuck = await page.evaluate(async () => {
            const out = [];
            for (const e of document.querySelectorAll('[data-eval-hidden]')) {
              e.scrollIntoView({ block: 'center' }); await new Promise((res) => setTimeout(res, 1500));
              let o = 1; for (let n = e; n && n !== document.body; n = n.parentElement) o *= +getComputedStyle(n).opacity;
              if (o < 0.9) out.push(e.tagName.toLowerCase() + ' "' + (e.textContent || e.alt || '').trim().slice(0, 40) + '"');
              e.removeAttribute('data-eval-hidden');
            }
            return out;
          });
          if (stuck.length) fail('hidden', route, `${tag}: ${stuck.join(', ')}`);
        }
        if (r.clipped.length) fail('clipped', route, `${tag}: ${r.clipped.join(', ')}`);
        if (r.small.length) fail('tap', route, `${tag}: ${r.small.join(', ')}`);
        if (r.plainLinks.length) fail('plainlinks', route, `${tag}: ${r.plainLinks.join(', ')}`);
        if (r.cls > PAGES.cls) fail('cls', route, `${tag}: ${r.cls.toFixed(3)}`);
        const cap = vp.name === 'phone' ? BUDGETS.image : vp.name === 'desktop' ? BUDGETS.imageDesktop : Infinity;
        for (const [len, url] of log.sizes) if (len > cap) fail('imgbytes', route, `${tag}: ${(len / 1000).toFixed(0)} kB ${url}`);
        if (['phone', 'desktop'].includes(vp.name)) {
          const v = await axe(page);
          if (v.length) fail('axe', route, `${tag}: ${v.join(' || ')}`);
        }
      }
      await ctx.close();
    }

    const gate = (key, name) => check('pages', name, !fails[key], fails[key]?.length ?? 0, 0, (fails[key] ?? []).slice(0, 12).join(' ;; '));
    gate('load', 'every page loads');
    gate('errors', 'no console or page errors');
    gate('requests', 'no failed requests');
    gate('overflow', 'no sideways scroll at any width');
    gate('broken', 'no broken images');
    gate('oversized', 'no image over 2.2× its displayed size');
    gate('imgbytes', `no image over ${BUDGETS.image / 1000} kB on a phone, ${BUDGETS.imageDesktop / 1000} kB on desktop`);
    gate('hidden', 'no content left invisible after scrolling');
    gate('clipped', 'no text cut off by its box');
    gate('tap', 'touch targets at least 24 px');
    gate('plainlinks', 'links in running text are distinguishable without hover (WCAG 1.4.1)');
    gate('cls', `layout shift ≤ ${PAGES.cls}`);
    gate('axe', 'axe: no accessibility violations (WCAG 2.2 AA + best practice), both themes');

    await links_(browser, base, [...links], check);
    await interactions(browser, base, check);
  } finally {
    await browser.close();
  }
}

// Every internal link (and #anchor) found on any page lands on a real page and a real element.
async function links_(browser, base, links, check) {
  const page = await browser.newPage();
  const bad = [];
  for (const href of links) {
    const [p, hash] = href.split('#');
    await go(page, base + href).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    // A #link must not only exist: the page has to land on it (its top near the top of the window).
    const r = await page.evaluate((hash) => {
      const el = hash && document.getElementById(hash), top = el ? Math.round(el.getBoundingClientRect().top) : 0;
      return { missing: /not found/i.test(document.querySelector('h1')?.textContent ?? ''), anchor: !hash || !!el, top, landed: !hash || hash === 'main' || (top > -10 && top < 220) };
    }, hash);
    if (r.missing || !r.anchor || !r.landed) bad.push(href + (r.missing ? ' → not found' : !r.anchor ? ' → no #' + hash : ` → landed ${r.top}px off`));
  }
  check('pages', `all ${links.length} internal links and anchors resolve`, !bad.length, bad.length, 0, bad.join(', '));
  await page.close();
}

async function interactions(browser, base, check) {
  // Client-side navigation through the main menu: fast, error-free, focus and scroll reset.
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const log = watch(page, base);
  await go(page, base + '/');
  await new Promise((r) => setTimeout(r, 1500)); // idle prefetch of the page chunks
  const slow = [];
  for (const to of ['/about', '/team', '/achievements', '/events', '/gallery', '/support', '/contact', '/']) {
    // Scroll the way a reader does (a wheel, which the smooth scroller handles), then use the menu.
    await page.mouse.move(600, 400); await page.mouse.wheel({ deltaY: 500 }); await new Promise((r) => setTimeout(r, 700));
    // The pointer reaches the link a moment before the click, as a hand does.
    await page.hover(`nav a[href="${to}"]`).catch(() => {}); await new Promise((r) => setTimeout(r, 150));
    const ms = await page.evaluate(async (to) => {
      const before = document.querySelector('main h1')?.textContent;
      const a = [...document.querySelectorAll('nav a')].find((x) => x.getAttribute('href') === to);
      if (!a) return -1;
      const t = performance.now(); a.click();
      while (performance.now() - t < 5000) {
        await new Promise((r) => requestAnimationFrame(r));
        const h = document.querySelector('main h1'); if (h && h.textContent !== before && h.getBoundingClientRect().height) return performance.now() - t;
      }
      return 9999;
    }, to);
    const y = await page.evaluate(() => scrollY);
    if (ms < 0 || ms > 400 || y > 5) slow.push(`${to}: ${ms < 0 ? 'no nav link' : Math.round(ms) + ' ms'}${y > 5 ? `, left at y=${y}` : ''}`);
  }
  check('pages', 'menu navigation: new page in < 400 ms, scrolled to top', !slow.length, slow.length, 0, slow.join(', '));
  check('pages', 'menu navigation: no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));

  // Keyboard: the first Tab stops are visible and show a focus ring.
  await go(page, base + '/');
  const noRing = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      return { ring, seen: r.width > 0 && r.height > 0, name: e.tagName + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 25) };
    });
    if (f && (!f.ring || !f.seen)) noRing.push(f.name + (f.seen ? '' : ' (invisible)'));
  }
  check('pages', 'keyboard: every focused control shows a focus ring', !noRing.length, noRing.length, 0, noRing.join(', '));

  // Tab reaches every control on the page (nothing waiting to be revealed drops out of the order), and each
  // one is visible once it has focus (its reveal plays as focus scrolls it into view).
  const skipped = [];
  for (const route of ['/', '/support', '/contact']) {
    await go(page, base + route);
    await page.evaluate(() => { window.__seen = new Set(); document.addEventListener('focusin', (e) => window.__seen.add(e.target), true); });
    const unseen = [];
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press('Tab');
      // Past the last control, focus leaves the page (body): every stop has been visited.
      if (i > 0 && await page.evaluate(() => document.activeElement === document.body)) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => setTimeout(r, 1200));
    const r = await page.evaluate(() => {
      const all = [...document.querySelectorAll('main a[href], main button, main input:not([type=hidden]), main select, main textarea, main [tabindex="0"]')]
        .filter((e) => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && !e.closest('[aria-hidden="true"], [inert]')
          && !(e.closest('details:not([open])') && !e.closest('summary'))); // a closed answer's links open with it
      const opacity = (e) => { let o = 1; for (let n = e; n; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
      return {
        missed: all.filter((e) => !window.__seen.has(e)).slice(0, 5).map((e) => `${e.tagName} "${(e.textContent || e.name || e.getAttribute('aria-label') || '').trim().slice(0, 30)}"`),
        faint: [...window.__seen].filter((e) => e.closest('main') && opacity(e) < 0.9).slice(0, 5).map((e) => `${e.tagName} "${(e.textContent || e.name || '').trim().slice(0, 30)}"`),
      };
    });
    if (r.missed.length) skipped.push(`${route}: never focused ${r.missed.join(', ')}`);
    if (r.faint.length) unseen.push(`${route}: focused but invisible ${r.faint.join(', ')}`);
    skipped.push(...unseen);
  }
  check('pages', 'keyboard: Tab reaches every control, each visible once focused', !skipped.length, skipped.length, 0, skipped.join(' ;; '));

  // Theme cord flips the theme; the sound toggle doesn't throw.
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  const cord = await page.$('[aria-label*="theme" i], [aria-label*="light" i], [aria-label*="dark" i]');
  if (cord) { await cord.click(); await new Promise((r) => setTimeout(r, 900)); }
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  check('pages', 'theme control switches the theme', !!cord && before !== after, `${before} → ${after}`, 'flipped');
  await page.close();

  // Phone menu: opens, links work, Escape closes it.
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mlog = watch(m, base);
  await go(m, base + '/');
  const btn = await m.$('button[aria-controls="nav"]');
  await btn?.click(); await new Promise((r) => setTimeout(r, 300));
  const opened = await m.evaluate(() => getComputedStyle(document.getElementById('nav')).display !== 'none');
  await m.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 300));
  const escClosed = await m.evaluate(() => getComputedStyle(document.getElementById('nav')).display === 'none');
  check('pages', 'phone menu opens', opened, opened, true);
  check('pages', 'phone menu closes on Escape', escClosed, escClosed, true);
  if (!escClosed) await btn?.click();
  await btn?.click(); await new Promise((r) => setTimeout(r, 300));
  await m.evaluate(() => [...document.querySelectorAll('#nav a')].find((a) => a.getAttribute('href') === '/about')?.click());
  await new Promise((r) => setTimeout(r, 800));
  const went = await m.evaluate(() => location.pathname === '/about' && getComputedStyle(document.getElementById('nav')).display === 'none');
  check('pages', 'phone menu link navigates and closes the menu', went, went, true);
  check('pages', 'phone menu: no errors', !mlog.errors.length, mlog.errors.length, 0, mlog.errors.join(' | '));
  await m.close();

  // Text the reader hasn't scrolled to is the real text (screen readers, find in page read ahead of the
  // scroll): compare the live page's paragraphs below the fold with the prerendered HTML.
  const ahead = await browser.newPage();
  await ahead.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const garbled = [];
  for (const route of ROUTES) {
    await go(ahead, base + route);
    await new Promise((r) => setTimeout(r, 1500));
    const bad = await ahead.evaluate(async () => {
      const doc = new DOMParser().parseFromString(await (await fetch(location.pathname)).text(), 'text/html');
      const want = [...doc.querySelectorAll('main p, main h2, main h3, main li')].map((e) => e.textContent.trim());
      return [...document.querySelectorAll('main p, main h2, main h3, main li')].filter((e) => e.getBoundingClientRect().top > innerHeight * 1.3)
        .map((e) => e.textContent.trim()).filter((t) => t.length > 12 && !want.includes(t)).slice(0, 2);
    });
    if (bad.length) garbled.push(`${route}: "${bad.join('", "').slice(0, 120)}"`);
  }
  check('pages', 'text below the fold is the real text (not scrambled or placeholder)', !garbled.length, garbled.length, 0, garbled.join(' ;; '));
  await ahead.close();

  // Reduced motion: every page's content is visible without scrolling animations.
  const rm = await browser.newPage();
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const hiddenRm = [];
  for (const route of ROUTES) {
    await go(rm, base + route);
    const h = await rm.evaluate(inspect, false);
    if (h.hidden.length) hiddenRm.push(`${route}: ${h.hidden.join(', ')}`);
  }
  check('pages', 'reduced motion: all content visible with no scrolling', !hiddenRm.length, hiddenRm.length, 0, hiddenRm.join(' ;; '));
  await rm.close();
}
