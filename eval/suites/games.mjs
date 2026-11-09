// Both hangar games, played by script in the production build: they draw, start, respond to input,
// pause and resume, end with a score card, start again, hold frame rate, and never log an error.
import path from 'node:path';
import { MOTION } from '../benchmark.mjs';
import { watch } from './pages.mjs';
import { fps } from './visual.mjs';
import { go } from './pages.mjs';

const KEEP_PIXELS = `{
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, o) { return get.call(this, type, /webgl/.test(type) ? { ...o, preserveDrawingBuffer: true } : o); };
}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A cheap fingerprint of the game canvas, and how much of it isn't one flat colour.
function canvasPrint() {
  const c = document.querySelector('canvas[role="img"]') ?? document.querySelector('section canvas');
  if (!c) return null;
  const t = document.createElement('canvas'); t.width = 64; t.height = 36;
  const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 36);
  const d = x.getImageData(0, 0, 64, 36).data; let sum = 0; const seen = new Set();
  for (let i = 0; i < d.length; i += 4) { sum += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + i; seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
  return { sum, colours: seen.size };
}
const text = () => document.querySelector('section')?.innerText ?? '';
// The same fingerprint from a screenshot of the canvas's box: a WebGPU canvas reads back blank after it is shown.
async function screenPrint(page) {
  const box = await (await page.$('canvas[role="img"]'))?.boundingBox();
  if (!box) return null;
  const b64 = await page.screenshot({ clip: box, type: 'jpeg', quality: 70, encoding: 'base64' });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
    const t = document.createElement('canvas'); t.width = 64; t.height = 36;
    const x = t.getContext('2d'); x.drawImage(img, 0, 0, 64, 36);
    const d = x.getImageData(0, 0, 64, 36).data; let sum = 0; const seen = new Set();
    for (let i = 0; i < d.length; i += 4) { sum += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + i; seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); }
    return { sum, colours: seen.size };
  }, b64);
}

export async function run({ check, base, launch, here }) {
  const shot = (page, name) => page.screenshot({ path: path.join(here, 'reports', 'shots', `game-${name}.jpg`), type: 'jpeg', quality: 70 });
  const browser = await launch();
  try {
    // --- Payload Run ---
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const log = watch(page, base);
      await go(page, base + '/hangar/payload-run');
      await page.waitForSelector('canvas[role="img"]', { timeout: 15000 });
      await sleep(500);
      const a = await page.evaluate(canvasPrint);
      check('games', 'Payload Run: ready screen draws a scene', a?.colours > 20, a?.colours, '>20 colours');
      check('games', 'Payload Run: ready card shown', /Ready for takeoff/.test(await page.evaluate(text)), 'ready', 'ready');

      await page.keyboard.down('Space'); await sleep(400); await page.keyboard.up('Space');
      const flying = await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Pause'));
      check('games', 'Payload Run: Space starts a flight', flying, flying, true);
      await page.keyboard.press('Escape'); await sleep(300);
      check('games', 'Payload Run: Esc pauses', /Paused/.test(await page.evaluate(text)), 'paused', 'paused');
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Resume')?.click());
      await sleep(200);
      // Measure while flying: pulse Space to hold altitude, as a player would.
      let pulsing = true;
      const pulse = (async () => { while (pulsing) { await page.keyboard.down('Space'); await sleep(110); await page.keyboard.up('Space'); await sleep(150); } })();
      const f = await fps(page, 2500);
      await shot(page, 'payload-desktop');
      const b = await page.evaluate(canvasPrint);
      pulsing = false; await pulse;
      const still = await page.evaluate(() => !![...document.querySelectorAll('button')].find((x) => x.textContent === 'Pause'));
      check('games', `Payload Run: ≥ ${MOTION.fps} fps while flying`, still && f.median >= MOTION.fps && f.p5 >= MOTION.fpsP5, `${f.median}/${f.p5}${still ? '' : ' (crashed while measuring)'}`, `${MOTION.fps}/${MOTION.fpsP5}`);
      check('games', 'Payload Run: the scene moves', b && a && b.sum !== a.sum, 'changed', 'changed');
      // Hands off: the plane sinks and crashes; a score card follows.
      const t0 = Date.now(); let over = false;
      while (Date.now() - t0 < 30000) { if (/Flown/.test(await page.evaluate(text))) { over = true; break; } await sleep(250); }
      check('games', 'Payload Run: a crash ends the flight with a score card', over, over ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : 'no card', 'card');
      await page.keyboard.down('Space'); await sleep(200); await page.keyboard.up('Space'); await sleep(300);
      const again = await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Pause'));
      check('games', 'Payload Run: Space flies again after a crash', again, again, true);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Pause')?.click());
      await sleep(200);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Leave the game')?.click());
      await sleep(300);
      check('games', 'Payload Run: Leave returns to the ready card', /Ready for takeoff/.test(await page.evaluate(text)), 'ready', 'ready');
      check('games', 'Payload Run: no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));
      await page.close();
    }

    // Payload Run on a phone: tap to start, the game fills the screen.
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const log = watch(page, base);
      await go(page, base + '/hangar/payload-run');
      const c = await page.waitForSelector('canvas[role="img"]');
      const box = await c.boundingBox();
      await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2); await sleep(300); await page.touchscreen.touchEnd();
      await sleep(300);
      const ok = await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Pause'));
      check('games', 'Payload Run (phone): a tap starts a flight', ok, ok, true);
      await sleep(600); await shot(page, 'payload-phone');
      check('games', 'Payload Run (phone): no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));
      await page.close();
    }

    // --- Dogfight ---
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.evaluateOnNewDocument(KEEP_PIXELS);
      const log = watch(page, base);
      await go(page, base + '/hangar/dogfight');
      await page.waitForSelector('canvas[role="img"]', { timeout: 20000 });
      await sleep(1500);
      const a = await page.evaluate(canvasPrint);
      check('games', 'Dogfight: menu draws the 3D scene', a?.colours > 20, a?.colours, '>20 colours');
      await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Take off')?.click());
      await sleep(800);
      const playing = await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Pause'));
      check('games', 'Dogfight: Take off starts a sortie', playing, playing, true);
      const f = await fps(page, 3000);
      await shot(page, 'dogfight-desktop');
      check('games', `Dogfight: ≥ ${MOTION.fps} fps in flight`, f.median >= MOTION.fps && f.p5 >= MOTION.fpsP5, `${f.median}/${f.p5}`, `${MOTION.fps}/${MOTION.fpsP5}`);
      // Fly: climb, bank, fire guns and a missile.
      await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.keyboard.down('Space');
      await sleep(1500);
      await page.keyboard.press('KeyF');
      await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW'); await page.keyboard.up('Space');
      await sleep(500);
      const b = await page.evaluate(canvasPrint);
      check('games', 'Dogfight: the view moves in flight', b && a && b.sum !== a.sum, 'changed', 'changed');
      await page.keyboard.press('Escape'); await sleep(400);
      check('games', 'Dogfight: Esc pauses', /Paused/.test(await page.evaluate(text)), 'paused', 'paused');
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Resume')?.click());
      await sleep(400);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Pause')?.click());
      await sleep(200);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent === 'Leave the game')?.click());
      await sleep(400);
      check('games', 'Dogfight: Leave returns to the menu', await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Take off')), 'menu', 'menu');
      // Leaving the page frees the 3D context; ten round trips must not exhaust WebGL.
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => document.querySelector('a[href="/hangar"]')?.click()); await sleep(300);
        await page.evaluate(() => document.querySelector('a[href="/hangar/dogfight"]')?.click()); await sleep(700);
      }
      const lost = log.errors.filter((e) => /context|WebGL/i.test(e));
      check('games', 'Dogfight: 10 visits in a row keep WebGL healthy', !lost.length, lost.length, 0, lost.slice(0, 2).join(' | '));
      check('games', 'Dogfight: no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // Dogfight on a phone: the touch stick and fire buttons show, fit the screen and are thumb-sized.
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const log = watch(page, base);
      await go(page, base + '/hangar/dogfight');
      await page.waitForSelector('canvas[role="img"]', { timeout: 20000 });
      const take = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Take off'));
      await take.tap();
      await sleep(1500);
      const ctl = await page.evaluate(() => [...document.querySelectorAll('button, [aria-hidden="true"].rounded-full')].filter((e) => /^(FIRE|MSL)$/.test(e.textContent.trim()) || e.matches('.rounded-full.size-32'))
        .map((e) => { const r = e.getBoundingClientRect(); return { name: e.textContent.trim() || 'stick', w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
      const bad = ctl.filter((c) => !c.inside || c.w < 44 || c.h < 44);
      check('games', 'Dogfight (phone): stick, FIRE and MSL shown, on screen, ≥ 44 px', ctl.length === 3 && !bad.length, `${ctl.length} controls${bad.length ? ', ' + bad.map((c) => c.name).join(' ') + ' off/small' : ''}`, '3 ok');
      const fireBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'FIRE'));
      if (fireBtn) { const b = await fireBtn.boundingBox?.(); if (b) { await page.touchscreen.touchStart(b.x + b.width / 2, b.y + b.height / 2); await sleep(600); await page.touchscreen.touchEnd(); } }
      await shot(page, 'dogfight-phone');
      check('games', 'Dogfight (phone): no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await extreme({ check, base, launch, shot: (page, name) => page.screenshot({ path: path.join(here, 'reports', 'shots', `game-${name}.jpg`), type: 'jpeg', quality: 70 }) });
}

// Dogfight Extreme (WebGPU, a worker and WASM, in waves), chosen from the Graphics setting. Played
// where this Chrome offers WebGPU; elsewhere it must fall back to Base with a note. ?bench lets the
// script read the wave and skip through waves (window.__extreme), since a script can't win dogfights.
async function extreme({ check, base, launch, shot }) {
  const browser = await launch({ args: ['--enable-unsafe-webgpu'] });
  const click = (page, label) => page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l)?.click(), label);
  const has = (page, label) => page.evaluate((l) => !![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l), label);
  const hud = (page) => page.evaluate(() => window.__extreme?.hud() ?? null);
  const until = async (page, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(250); } return null; };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.evaluateOnNewDocument(KEEP_PIXELS);
    const log = watch(page, base);
    await go(page, base + '/hangar/dogfight?bench');
    await page.waitForSelector('canvas[role="img"]', { timeout: 20000 });
    const gpu = await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()));
    await click(page, 'Extreme');
    const loaded = await until(page, () => page.evaluate(() => (document.querySelector('canvas[role="img"]')?.getAttribute('aria-label') ?? '').includes('Extreme') && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Take off')), 25000);
    const pressed = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Extreme')?.getAttribute('aria-pressed'));
    if (!gpu) {
      const note = /needs WebGPU/.test(await page.evaluate(text));
      check('games', 'Extreme: without WebGPU, falls back to Base with a note', note && !loaded, note ? 'note' : 'no note', 'note');
      return;
    }
    check('games', 'Extreme: the Graphics setting loads it (WebGPU)', !!loaded && pressed === 'true', loaded ? 'loaded' : 'not loaded', 'loaded');
    if (!loaded) return;
    await sleep(1500);
    const a = await screenPrint(page);
    check('games', 'Extreme: menu draws the 3D scene', a?.colours > 20, a?.colours, '>20 colours');
    await click(page, 'Take off');
    const first = await until(page, () => hud(page), 8000);
    check('games', 'Extreme: Take off starts wave 1 (the worker and WASM run)', first?.wave === 1 && (await has(page, 'Pause')), first ? `wave ${first.wave}` : 'no state', 'wave 1');
    const f = await fps(page, 3000);
    await shot(page, 'extreme-desktop');
    check('games', `Extreme: ≥ ${MOTION.fps} fps in flight`, f.median >= MOTION.fps && f.p5 >= MOTION.fpsP5, `${f.median}/${f.p5}`, `${MOTION.fps}/${MOTION.fpsP5}`);
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.keyboard.down('Space');
    await sleep(1500);
    await page.keyboard.press('KeyF');
    await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW'); await page.keyboard.up('Space');
    await sleep(500);
    const b = await screenPrint(page);
    check('games', 'Extreme: the view moves in flight', b && a && b.sum !== a.sum, 'changed', 'changed');
    // Skip through waves 1–3 (the enemies die by the normal rules); wave 4 must arrive and fight.
    const seen = [];
    for (let n = 1; n <= 3; n++) {
      const fighting = await until(page, async () => { const h = await hud(page); return h?.wave === n && h.phase === 'fight' && h.left > 0 && h; }, 9000);
      if (!fighting) break;
      seen.push(`${n}:${fighting.left}`);
      await page.evaluate(() => window.__extreme.clearWave());
    }
    const four = await until(page, async () => { const h = await hud(page); return h?.wave === 4 && h.phase === 'fight' && h; }, 12000);
    check('games', 'Extreme: waves advance (1 → 4) with more jets', !!four && four.left > 3, `${seen.join(' ')}${four ? ` 4:${four.left}` : ' (stuck)'}`, 'reaches wave 4');
    await shot(page, 'extreme-wave4');
    await page.keyboard.press('Escape'); await sleep(400);
    const paused = /Paused/.test(await page.evaluate(text)) && (await has(page, 'Base')) && (await has(page, 'Extreme'));
    check('games', 'Extreme: Esc pauses, with the Graphics setting', paused, paused ? 'paused' : 'no', 'paused');
    await click(page, 'Resume'); await sleep(400);
    await click(page, 'Pause'); await sleep(200);
    await click(page, 'Leave the game'); await sleep(400);
    check('games', 'Extreme: Leave returns to the menu', await has(page, 'Take off'), 'menu', 'menu');
    // The choice is remembered; leaving frees the GPU device and the worker, ten times over.
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => document.querySelector('a[href="/hangar"]')?.click()); await sleep(300);
      await page.evaluate(() => document.querySelector('a[href="/hangar/dogfight"]')?.click()); await sleep(1200);
    }
    const again = await until(page, () => page.evaluate(() => (document.querySelector('canvas[role="img"]')?.getAttribute('aria-label') ?? '').includes('Extreme') && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Take off')), 15000);
    const lost = log.errors.filter((e) => /context|WebGL|WebGPU|device/i.test(e));
    check('games', 'Extreme: remembered, and 10 visits in a row keep the GPU healthy', !!again && !lost.length, `${again ? 'extreme' : 'not restored'}, ${lost.length} GPU errors`, 'extreme, 0', lost.slice(0, 2).join(' | '));
    await click(page, 'Base');
    const backToBase = await until(page, () => page.evaluate(() => document.querySelector('canvas[role="img"]')?.getAttribute('aria-label') === 'Dogfight, a 3D air combat game' && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Take off')), 10000);
    check('games', 'Extreme: switching back gives Base', !!backToBase, backToBase ? 'base' : 'no', 'base');
    check('games', 'Extreme: no errors', !log.errors.length, log.errors.length, 0, log.errors.slice(0, 3).join(' | '));
    await page.close();

    // On a phone: the touch controls show and fit.
    const phone = await browser.newPage();
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await phone.evaluateOnNewDocument(() => { try { localStorage.setItem('dogfight-graphics', 'extreme'); } catch { /* */ } });
    const plog = watch(phone, base);
    await go(phone, base + '/hangar/dogfight?bench');
    await until(phone, () => phone.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Take off') && (document.querySelector('canvas[role="img"]')?.getAttribute('aria-label') ?? '').includes('Extreme')), 25000);
    const take = await phone.evaluateHandle(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Take off'));
    await take.tap(); await sleep(1500);
    const ctl = await phone.evaluate(() => [...document.querySelectorAll('button, [aria-hidden="true"].rounded-full')].filter((e) => /^(FIRE|MSL)$/.test(e.textContent.trim()) || e.matches('.rounded-full.size-32'))
      .map((e) => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    check('games', 'Extreme (phone): stick, FIRE and MSL shown, on screen, ≥ 44 px', ctl.length === 3 && ctl.every(Boolean), `${ctl.filter(Boolean).length}/3`, '3 ok');
    await shot(phone, 'extreme-phone');
    check('games', 'Extreme (phone): no errors', !plog.errors.length, plog.errors.length, 0, plog.errors.slice(0, 3).join(' | '));
    await phone.close();
  } finally {
    await browser.close();
  }
}
