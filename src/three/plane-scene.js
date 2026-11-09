import * as THREE from 'three';
import { buildPlane, compact, dispose } from './quatlas012.js';

// The home hero's 3D plane, without any DOM: it runs in a worker on an OffscreenCanvas (so three.js, the
// model and every frame stay off the page's main thread) or, where that isn't possible, on the main thread
// with an ordinary canvas. viewer.js is the page side: it sends messages in, and gets messages back:
//   in:  resize {w, h} · pointer {kind: move|click|leave, x, y (−1…1), mouse} · set {active, exploded} · visible {on} · destroy
//   out: ready · pick {id, click, mouse, exploded} · labels {show, at: [[id, x, y]…] in CSS px}
// It flies in, whole, the first time the site opens; then a slow turn, a lean toward the pointer, and parts
// that fly apart along their explode vectors when the model is clicked.

const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((f) => setTimeout(() => f(performance.now()), 16));
const unraf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;

export function createScene(canvas, { w, h, dpr = 1, still = false, zoom = 1, flown = false }, post) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 1.6));
  const key = new THREE.DirectionalLight('#fff4e6', 2.6); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe0ff', 1.1); rim.position.set(-3, 1.5, -2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 430 / 305, 0.1, 50);
  camera.position.set(2.45, 1.15, 2.7); camera.lookAt(0, 0.02, 0); camera.zoom = zoom;

  const plane = compact(buildPlane()), pivot = new THREE.Group();
  pivot.add(plane); scene.add(pivot);
  const parts = plane.children, prop = parts.find((p) => p.userData.part === 'motor').userData.prop;
  // Label anchors: the centre of each part id's pieces, before any explode.
  const anchors = {};
  plane.updateMatrixWorld(true);
  for (const p of parts) {
    const c = p.userData.anchor ?? new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3());
    (anchors[p.userData.part] ??= []).push({ p, c });
  }

  const state = { active: null, exploded: false, e: 0, yaw: 0, lean: new THREE.Vector2(), aim: new THREE.Vector2() };
  let introStart = still || flown ? -Infinity : null; // set on the first frame drawn
  const tint = new THREE.Color('#c41e2c'), none = new THREE.Color(0);
  const highlight = () => parts.forEach((p) => p.traverse((o) => o.material?.emissive?.copy(p.userData.part === state.active ? tint : none).multiplyScalar(0.22)));

  let visible = true, loop = 0, last = performance.now(), ready = false, compiled = false, dead = false, shown = false;
  // A panel narrower than the drawing (a phone) widens the view, so the wings stay in frame.
  const resize = (nw, nh) => {
    w = nw; h = nh;
    const a = w / h, wide = 430 / 305;
    renderer.setSize(w, h, false); camera.aspect = a;
    camera.fov = a < wide ? (2 * Math.atan(Math.tan((14 * Math.PI) / 180) * (wide / a)) * 180) / Math.PI : 28;
    camera.updateProjectionMatrix();
    kick(); // a resize clears the canvas: draw again even when nothing is animating (reduced motion)
  };

  // Pointer: lean toward it, and pick the part under it.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (x, y) => {
    ndc.set(x, y); state.aim.copy(ndc);
    ray.setFromCamera(ndc, camera);
    let o = ray.intersectObject(plane, true)[0]?.object;
    while (o && !o.userData.part) o = o.parent;
    return o?.userData.part;
  };

  const v = new THREE.Vector3();
  function frame(now) {
    loop = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Fly-in: from far behind and above, banked, it sweeps in along its own heading and levels out
    // over 2.4 s, with the prop at full chat. Parts stay together until it has arrived.
    introStart ??= now;
    const fly = Math.min(1, (now - introStart) / 2400), rest = (1 - fly) ** 3;
    plane.position.set(-6 * rest, 1.4 * rest * rest, -1.2 * rest);
    plane.rotation.set(-1.1 * rest, 0, 0.35 * rest);
    const goal = fly < 1 ? 0 : state.exploded ? 1 : 0;
    state.e += (goal - state.e) * (still ? 1 : 1 - Math.exp(-dt * 4));
    const ease = state.e * state.e * (3 - 2 * state.e);
    // Pull back so the parts stay in frame when apart (less on a tall panel, which has the height already).
    camera.zoom = zoom * (1 - (camera.aspect < 430 / 305 ? 0.1 : 0.4) * ease); camera.updateProjectionMatrix();
    for (const p of parts) p.position.copy(p.userData.explode).multiplyScalar(ease);

    if (!still) { if (fly === 1) state.yaw += dt * 0.25; prop.rotation.x += dt * (fly < 1 || state.active === 'motor' ? 40 : 9); }
    state.lean.lerp(state.aim, 1 - Math.exp(-dt * 3));
    pivot.rotation.set(state.lean.y * -0.18, -0.6 + Math.sin(state.yaw) * 0.7 + state.lean.x * 0.35, 0);
    if (!still) pivot.position.y = Math.sin(now / 1400) * 0.03;
    renderer.render(scene, camera);

    // Labels sit on their parts once the parts are apart (the page places them; nothing to send while hidden).
    const show = Math.min(1, Math.max(0, (ease - 0.45) / 0.4));
    if (show || shown) {
      const at = Object.entries(anchors).map(([id, list]) => {
        v.copy(list[0].c).add(list[0].p.position).applyMatrix4(plane.matrixWorld).project(camera);
        return [id, ((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
      });
      post({ type: 'labels', show, active: state.active, at });
    }
    shown = show > 0;
    if (!ready) { ready = true; post({ type: 'ready' }); }
    if (visible && (!still || Math.abs(goal - state.e) > 0.001)) loop = raf(frame);
    else if (fly < 1) introStart = null; // scrolled away mid-flight: replay it from the start when back
  }
  function kick() { if (!loop && compiled && !dead) { last = performance.now(); loop = raf(frame); } }

  resize(w, h);
  // Shaders compile in parallel where the browser can (KHR_parallel_shader_compile), then the first frame.
  renderer.compileAsync(scene, camera).catch(() => {}).then(() => { compiled = true; kick(); });

  return {
    handle(m) {
      if (dead) return;
      if (m.type === 'resize') resize(m.w, m.h);
      else if (m.type === 'visible') { visible = m.on; kick(); }
      else if (m.type === 'pointer') {
        if (m.kind === 'leave') { state.aim.set(0, 0); return; }
        post({ type: 'pick', id: pick(m.x, m.y) ?? null, click: m.kind === 'click', mouse: m.mouse, exploded: state.exploded });
      } else if (m.type === 'set') {
        // The legend starts on a part; the model only tints a part once someone points at one.
        if (m.active !== undefined && m.active !== state.active) { const first = state.active === null; state.active = m.active; if (!first) highlight(); }
        if (m.exploded !== undefined) state.exploded = m.exploded;
        kick();
      } else if (m.type === 'destroy') {
        dead = true; unraf(loop);
        dispose(scene); renderer.dispose(); renderer.forceContextLoss();
      }
    },
  };
}
