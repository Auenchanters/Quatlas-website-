import * as THREE from 'three';
import { buildPlane, dispose } from './quatlas012.js';

// The home hero's 3D plane: it flies in, whole, the first time the site opens; then a slow turn, a lean toward the pointer, parts that fly apart along their
// explode vectors (from the button, and as the figure scrolls up and away) with labels that follow them.
// Draws only while on screen and while the tab is visible. Returns { set, destroy }.
let flown = false; // the fly-in plays once per visit, not on every return to the home page

export function mountPlane(el, { names, onPick, onReady }) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = Object.assign(document.createElement('canvas'), { className: 'absolute inset-0 size-full' });
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 1.6));
  const key = new THREE.DirectionalLight('#fff4e6', 2.6); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#cfe0ff', 1.1); rim.position.set(-3, 1.5, -2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 430 / 305, 0.1, 50);
  camera.position.set(2.45, 1.15, 2.7); camera.lookAt(0, 0.02, 0);

  const plane = buildPlane(), pivot = new THREE.Group();
  pivot.add(plane); scene.add(pivot);
  const parts = plane.children, prop = parts.find((p) => p.userData.part === 'motor').userData.prop;
  // Label anchors: the centre of each part id's pieces, before any explode.
  const anchors = {};
  plane.updateMatrixWorld(true);
  for (const p of parts) {
    const c = p.userData.anchor ?? new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3());
    (anchors[p.userData.part] ??= []).push({ p, c });
  }
  const labels = Object.fromEntries(Object.keys(anchors).map((id) => {
    const s = Object.assign(document.createElement('span'), { textContent: names[id], className: 'plane-label' });
    el.append(s);
    return [id, s];
  }));

  const state = { active: null, exploded: false, e: 0, yaw: 0, lean: new THREE.Vector2(), aim: new THREE.Vector2() };
  let introStart = still || flown ? -Infinity : null; // set on the first frame drawn
  flown = true;
  const tint = new THREE.Color('#c41e2c');
  const highlight = () => parts.forEach((p) => p.traverse((o) => o.material?.emissive?.copy(p.userData.part === state.active ? tint : new THREE.Color(0)).multiplyScalar(0.22)));

  const size = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(size); ro.observe(el); size();

  // Pointer: lean toward it, and pick the part under it.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.aim.copy(ndc);
    ray.setFromCamera(ndc, camera);
    let o = ray.intersectObject(plane, true)[0]?.object;
    while (o && !o.userData.part) o = o.parent;
    return o?.userData.part;
  };
  const move = (e) => { const id = pick(e); if (id && e.pointerType === 'mouse') onPick(id); el.style.cursor = id ? 'pointer' : ''; };
  const click = (e) => { const id = pick(e); if (id) onPick(id); };
  const leave = () => state.aim.set(0, 0);
  el.addEventListener('pointermove', move); el.addEventListener('click', click); el.addEventListener('pointerleave', leave);

  let visible = true, raf = 0, last = performance.now(), ready = false;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { rootMargin: '100px' });
  io.observe(el);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  const v = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Scrolling the figure up past the middle of the screen pulls the parts apart.
    const r = el.getBoundingClientRect();
    const scrolled = still ? 0 : Math.min(1, Math.max(0, (innerHeight * 0.45 - (r.top + r.height / 2)) / (r.height * 0.55)));
    // Fly-in: from far behind and above, banked, it sweeps in along its own heading and levels out
    // over 2.4 s, with the prop at full chat. Parts stay together until it has arrived.
    introStart ??= now;
    const fly = Math.min(1, (now - introStart) / 2400), rest = (1 - fly) ** 3;
    plane.position.set(-6 * rest, 1.4 * rest * rest, -1.2 * rest);
    plane.rotation.set(-1.1 * rest, 0, 0.35 * rest);
    const goal = fly < 1 ? 0 : Math.max(state.exploded ? 1 : 0, scrolled);
    state.e += (goal - state.e) * (still ? 1 : 1 - Math.exp(-dt * 4));
    const ease = state.e * state.e * (3 - 2 * state.e);
    for (const p of parts) p.position.copy(p.userData.explode).multiplyScalar(ease);

    if (!still) { if (fly === 1) state.yaw += dt * 0.25; prop.rotation.x += dt * (fly < 1 || state.active === 'motor' ? 40 : 9); }
    state.lean.lerp(state.aim, 1 - Math.exp(-dt * 3));
    pivot.rotation.set(state.lean.y * -0.18, -0.6 + Math.sin(state.yaw) * 0.7 + state.lean.x * 0.35, 0);
    if (!still) pivot.position.y = Math.sin(now / 1400) * 0.03;
    renderer.render(scene, camera);

    // Labels sit on their parts once the parts are apart.
    const w = el.clientWidth, h = el.clientHeight, show = Math.min(1, Math.max(0, (ease - 0.45) / 0.4));
    for (const [id, list] of Object.entries(anchors)) {
      v.copy(list[0].c).add(list[0].p.position).applyMatrix4(plane.matrixWorld).project(camera);
      const s = labels[id];
      s.style.opacity = show;
      s.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      s.dataset.on = id === state.active ? '1' : '';
    }
    if (!ready) { ready = true; onReady?.(); }
    if (visible && !document.hidden && (!still || Math.abs(goal - state.e) > 0.001)) raf = requestAnimationFrame(frame);
    else if (fly < 1) introStart = null; // scrolled away mid-flight: replay it from the start when back
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const onScroll = () => kick();
  addEventListener('scroll', onScroll, { passive: true });
  kick();

  return {
    set({ active, exploded }) {
      // The legend starts on a part; the model only tints a part once someone points at one.
      if (active !== undefined && active !== state.active) { const first = state.active === null; state.active = active; if (!first) highlight(); }
      if (exploded !== undefined) state.exploded = exploded;
      kick();
    },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis); removeEventListener('scroll', onScroll);
      el.removeEventListener('pointermove', move); el.removeEventListener('click', click); el.removeEventListener('pointerleave', leave);
      dispose(scene); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); Object.values(labels).forEach((s) => s.remove());
    },
  };
}
