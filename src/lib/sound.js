// Quiet audio notes for clicks, scrolling and form submits, made in code with earshot
// (github.com/Leonxlnx/earshot), all tuned to A:
//   click  ui_pop/soft at A4                                  -30 LUFS
//   tick   pro_hover_tick/soft, one per 160 px scrolled       -36 LUFS
//   submit pluck/kalimba_soft E5 then A5, 90 ms apart          -28 LUFS
// Levels are baked into public/sfx/*.mp3, so everything plays at unity gain.
// Nothing loads until the first tap or key: browsers only allow audio after a gesture.

const FILES = { click: '/sfx/click.mp3', tick: '/sfx/tick.mp3', submit: '/sfx/submit.mp3' };
const KEY = 'sound';
const CLICKABLE = 'a[href], button, [role="switch"], [role="button"], summary, select, input[type="checkbox"], input[type="radio"]';
const subs = new Set();

let ctx = null;
let ready = null; // resolves once the buffers are decoded
let buffers = {};

export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const onSoundChange = (f) => (subs.add(f), () => subs.delete(f));
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not remembered in private mode */ }
  subs.forEach((f) => f(on));
}

function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ready; }
  ctx = new AudioContext();
  ready = Promise.all(Object.entries(FILES).map(async ([k, url]) => {
    buffers[k] = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  })).catch(() => {});
  return ready;
}

// Slight pitch variation, so repeats don't sound like a machine.
function play(name, spread = 0) {
  if (!buffers[name] || !soundOn()) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = 1 + (Math.random() - 0.5) * spread;
  src.connect(ctx.destination);
  src.start();
}

export function initSounds() {
  addEventListener('pointerdown', unlock, { capture: true, passive: true });
  addEventListener('keydown', unlock, { capture: true, passive: true });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest?.(CLICKABLE);
    if (!el || el.disabled || el.type === 'submit') return; // a submit button gets the submit note instead
    await unlock(); // the very first click waits the few ms it takes to decode
    play('click', 0.06);
  }, true);

  // Fires for a submit button and for Enter in a field alike.
  document.addEventListener('submit', async () => { await unlock(); play('submit'); }, true);

  let lastY = scrollY, travelled = 0, lastTick = 0;
  addEventListener('scroll', () => {
    travelled += Math.abs(scrollY - lastY);
    lastY = scrollY;
    const now = performance.now();
    if (!ctx || travelled < 160 || now - lastTick < 55) return; // scrolling alone can't start audio
    travelled = 0;
    lastTick = now;
    play('tick', 0.1);
  }, { passive: true });
}
