import { Vector3 } from 'three';
import { forwardOf } from './logic';
import { onDropOut } from '../fullscreen';

// Dogfight's controls, shared by Base and Extreme: mouse aim, keys, the touch stick (written by the
// page into input.stick), pausing on Esc, on a hidden tab or on dropping out of full screen.
export function createControls(el, phaseRef, api) {
  // Mouse aim, as in War Thunder: the mouse turns a world direction (yaw, pitch) that the camera looks
  // along, and the jet flies toward it. The aim stays put when the mouse does, so the jet settles on it.
  const input = { yaw: 0, pitch: 0, turn: 0, climb: 0, edge: 0, fire: false, missile: false, roll: 0, throttle: 0, look: false, stick: null };
  const aimDir = (out = new Vector3()) => out.set(Math.sin(input.yaw) * Math.cos(input.pitch), Math.sin(input.pitch), Math.cos(input.yaw) * Math.cos(input.pitch));
  const aimFrom = (p) => { const f = forwardOf(p, new Vector3()); input.yaw = Math.atan2(f.x, f.z); input.pitch = Math.asin(Math.max(-1, Math.min(1, f.y))); };
  // The touch stick turns the aim at a rate; the mouse turns it directly (onMove).
  // Keys (A / D, arrows) and a cursor held at the side of the screen turn the aim at a steady rate.
  const update = (dt) => {
    if (input.stick) { input.yaw -= input.stick.x * 1.5 * dt; input.pitch += input.stick.y * 1.1 * dt; }
    input.yaw += (input.turn * 1.3 + input.edge * 1.5) * dt; input.pitch += input.climb * 0.9 * dt;
    input.pitch = Math.max(-1.35, Math.min(1.35, input.pitch));
  };

  // Mouse only: touch drags on the stick and FIRE button must not move the aim point.
  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || phaseRef.current !== 'playing') return;
    // Without pointer lock the cursor stops at the screen's edge; holding it there keeps turning.
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    input.edge = document.pointerLockElement ? 0 : x < 0.06 ? 1 : x > 0.94 ? -1 : 0;
    const k = 0.0022; // radians of aim per pixel of mouse travel
    input.yaw -= e.movementX * k; input.pitch = Math.max(-1.35, Math.min(1.35, input.pitch - e.movementY * k));
  };
  // A / D and the arrows move the aim (so the jet turns and stays turned); Q / E roll by hand.
  const KEYS = {
    KeyW: ['throttle', 1], KeyS: ['throttle', -1], KeyA: ['turn', 1], KeyD: ['turn', -1], ArrowLeft: ['turn', 1], ArrowRight: ['turn', -1],
    ArrowUp: ['climb', 1], ArrowDown: ['climb', -1], KeyQ: ['roll', -1], KeyE: ['roll', 1], KeyC: ['look', true],
  };
  const onKey = (down) => (e) => {
    // Releases always count, so nothing stays held across a pause.
    if (!down && KEYS[e.code]) { const [k] = KEYS[e.code]; input[k] = k === 'look' ? false : 0; }
    if (!down && e.code === 'Space') input.fire = false;
    if (phaseRef.current !== 'playing') return; // the menu's buttons resume: browsers won't re-enter fullscreen from Esc
    if (KEYS[e.code]) { const [k, v] = KEYS[e.code]; input[k] = down ? v : (k === 'look' ? false : 0); e.preventDefault(); }
    if (e.code === 'Space') { input.fire = down; e.preventDefault(); }
    if (e.code === 'KeyF' && down && !e.repeat) input.missile = true;
    if (e.code === 'Escape' && down) api.current.pause();
  };
  const kd = onKey(true), ku = onKey(false);
  const clearInput = () => Object.assign(input, { fire: false, missile: false, roll: 0, throttle: 0, turn: 0, climb: 0, edge: 0, look: false, stick: null });
  const onHide = () => { if (document.hidden && phaseRef.current === 'playing') api.current.pause(); };
  // Esc in fullscreen (or with the mouse locked) never reaches the page: dropping out is the pause.
  const stopDropOut = onDropOut(() => { if (phaseRef.current === 'playing') api.current.pause(); });
  const onBlur = () => clearInput();
  const onUp = (e) => { if (e.pointerType === 'mouse') input.fire = false; }; // even when released outside the game
  el.addEventListener('pointermove', onMove);
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  document.addEventListener('visibilitychange', onHide);
  addEventListener('blur', onBlur); addEventListener('pointerup', onUp);

  const unbind = () => {
    el.removeEventListener('pointermove', onMove);
    removeEventListener('keydown', kd); removeEventListener('keyup', ku);
    document.removeEventListener('visibilitychange', onHide);
    removeEventListener('blur', onBlur); removeEventListener('pointerup', onUp);
    stopDropOut();
  };
  return { input, aimDir, aimFrom, update, clearInput, unbind };
}
