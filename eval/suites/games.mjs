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
}
