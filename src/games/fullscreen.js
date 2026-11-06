// A game being played fills the screen: real fullscreen where the browser allows it, and in any case a
// fixed layer over the page (iPhone Safari has no element fullscreen). Esc leaves real fullscreen
// without reaching the page, so the games pause on `fullscreenchange` / `pointerlockchange` instead.

export const FULL = 'fixed inset-0 z-[60] w-screen h-dvh max-h-none aspect-auto border-0';

export function enterFull(el, { lock = false } = {}) {
  if (!document.fullscreenElement) el.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
  // Pointer lock hides the cursor and gives endless mouse movement (Dogfight's mouse aim).
  if (lock && matchMedia('(pointer: fine)').matches) Promise.resolve(el.requestPointerLock?.()).catch(() => {});
}

export function exitFull() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// Calls back when the player drops out of fullscreen or pointer lock (Esc, or switching away).
export function onDropOut(cb) {
  const fs = () => { if (!document.fullscreenElement) cb(); };
  const pl = () => { if (!document.pointerLockElement) cb(); };
  document.addEventListener('fullscreenchange', fs);
  document.addEventListener('pointerlockchange', pl);
  return () => { document.removeEventListener('fullscreenchange', fs); document.removeEventListener('pointerlockchange', pl); };
}
