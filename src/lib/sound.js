// Soft, low taps for clicks and form submits, made in code with earshot (github.com/Leonxlnx/earshot):
//   click   popin: a 120 Hz felt tap, no tick, rolled off above 2.6 kHz     -36 LUFS, 120 ms
//   submit  popin: the same tap twice, the second a little higher           -33 LUFS, 300 ms
// No sound on scroll: it was the one people found grating. Levels are baked into public/sfx/*.mp3.
// Nothing loads until the first tap or key: browsers only allow audio after a gesture.

const FILES = { click: '/sfx/click.mp3', submit: '/sfx/submit.mp3' };
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

export async function playSound(name) { await unlock(); play(name); }

export function initSounds() {
  // Opening the audio device can take ~200 ms: do it just after the first press, not inside it, so the
  // press itself paints at once. The page keeps its user activation, so the context is still allowed to play
  // (and the click that follows resumes it, which Safari wants inside a gesture).
  const soon = () => setTimeout(unlock, 0);
  addEventListener('pointerdown', soon, { capture: true, passive: true });
  addEventListener('keydown', soon, { capture: true, passive: true });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest?.(CLICKABLE);
    if (!el || el.disabled || el.type === 'submit' || el.closest('.pullcord')) return; // the cord plays its own // a submit button gets the submit note instead
    if (!ctx) return; // a click with no press before it (a script's): no sound, and no device to open
    await unlock(); // the very first click waits the few ms it takes to decode
    play('click', 0.03);
  }, true);

  // Fires for a submit button and for Enter in a field alike.
  document.addEventListener('submit', async () => { await unlock(); play('submit'); }, true);
}
