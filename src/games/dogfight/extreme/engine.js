import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { createAudio } from '../../audio';
import { enterFull, exitFull } from '../../fullscreen';
import { createControls } from '../controls';
import { drawHud } from '../hud';
import { leadPoint, groundAt } from '../logic';
import { cloudField, waveNews, BANNER } from './waves';
import { atmosphere, nextStrike, thunderDelay } from './atmosphere';
import { createWorld, jetKit, buildJet, buildMissileMesh, createTracers, createEffects, puffTexture, SUN } from './world';
import { PS, MS } from './core';

// Dogfight Extreme on the main thread: input, camera, WebGPU drawing, sound and the HUD. The
// simulation runs in worker.js; each frame sends it the input and draws the state it last sent back.
const KEY = 'dogfight-extreme-best';
export const bestExtreme = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const MAX_ENEMIES = 10;

export async function mountExtreme({ el, hudCanvas, phaseRef, setPhase, setResult, api, atmos: initial = { time: 'day', weather: 'clear' } }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = Object.assign(document.createElement('canvas'), { className: 'absolute inset-0 size-full' });
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Dogfight Extreme, a 3D air combat game in waves');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) { renderer.dispose(); throw new Error('no WebGPU'); }
  el.prepend(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const EXPOSURE = 0.9;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = EXPOSURE;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const clouds = cloudField();
  const world = createWorld(clouds, { reduced }), { scene } = world;
  let atm = atmosphere(initial.time, initial.weather);
  world.setAtmosphere(atm);
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 1, 12000);
  // Bloom on the brightest parts only (flames, tracers, flares, lightning), not the sky.
  const post = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  post.outputNode = scenePass.add(bloom(scenePass, 0.3, 0.35, 0.95));

  const smokeMap = puffTexture();
  const effects = createEffects(scene, smokeMap);
  const tracers = [createTracers(scene, '#ffe27a'), createTracers(scene, '#ff6b6b')];
  const kits = { player: jetKit('player'), enemy: jetKit('enemy') };
  const jets = [buildJet(kits.player), ...Array.from({ length: MAX_ENEMIES }, () => buildJet(kits.enemy))];
  jets.forEach((j, i) => { j.visible = !i; if (i) j.userData.pylons.slice(2).forEach((m) => (m.visible = false)); scene.add(j); });
  const missileMeshes = [];
  // Flares light up what's near them (it matters at night); one light, always present, so it never recompiles.
  const flareLight = new THREE.PointLight('#ffc27a', 0, 700, 2), flareVel = new THREE.Vector3();
  scene.add(flareLight);
  const hud = hudCanvas.getContext('2d');

  // The state last received from the worker; before the first sortie, a parked jet for the menu.
  const parked = new Float32Array(PS); parked.set([0, 900, -2600, 0, 0, 0, 1], 0); parked[14] = 100; parked[15] = 1;
  let view = { np: 1, planes: parked, nb: 0, bullets: new Float32Array(0), nm: 0, missiles: new Float32Array(0), hud: null };
  let worker = null, pending = false, acc = 0, throttle = 0.7, hurt = 0, banner = null, notice = null, over = false, strikeT = 2, glare = 0;
  let audio = null, motor = null, rainSound = null, stopMusic = null, raf = 0, last = performance.now(), gone = false;
  const controls = createControls(el, phaseRef, api, { flares: true }), { input, aimDir, clearInput } = controls;

  const at = (i, out = new THREE.Vector3()) => out.fromArray(view.planes, i * PS);
  const quat = (i, out = new THREE.Quaternion()) => out.fromArray(view.planes, i * PS + 3);
  const shooter = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

  const startWorker = () => {
    worker?.terminate();
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onerror = (e) => console.error('Dogfight worker:', e.message);
    worker.onmessage = ({ data }) => {
      if (data.type !== 'state') return;
      view = data; pending = false;
      for (const e of data.events) handle(e);
    };
  };

  const handle = (e) => {
    if (e.type === 'explode') { effects.explode(e.pos); audio?.explode(e.dist); }
    else if (e.type === 'spark') effects.spark(e.pos);
    else if (e.type === 'cannon') audio?.cannon();
    else if (e.type === 'missile' || e.type === 'enemyMissile') audio?.missile();
    else if (e.type === 'tick') audio?.tick();
    else if (e.type === 'alarm') audio?.alarm();
    else if (e.type === 'struck') { hurt = 1; audio?.struck(); }
    else if (e.type === 'wave') banner = { title: `WAVE ${e.n}`, sub: waveNews(e.n), t: 0 };
    else if (e.type === 'cleared') { banner = { title: `WAVE ${e.n} CLEARED`, sub: 'Rearmed and patched up', t: 0 }; audio?.win(); }
    else if (e.type === 'over') end(e.result);
    else if (e.type === 'flare') {
      effects.flares(e.pos, e.vel); audio?.flare();
      flareLight.position.fromArray(e.pos); flareVel.fromArray(e.vel).multiplyScalar(0.3); flareLight.intensity = 9000;
      notice = { text: e.fooled ? `${e.fooled > 1 ? `${e.fooled} MISSILES` : 'MISSILE'} DECOYED` : 'FLARES', t: 1.6 };
    }
  };

  const end = (r) => {
    if (over) return;
    over = true;
    let best = bestExtreme();
    try { if (r.score > best) { localStorage.setItem(KEY, r.score); best = r.score; } } catch { /* private mode */ }
    setResult({ extreme: true, won: false, why: r.why, score: r.score, kills: r.kills, wave: r.wave, time: mmss(r.time), accuracy: r.accuracy, best });
    stopMusic?.(); stopMusic = null; motor?.set(0, false);
    setTimeout(() => setPhase('lost'), 1600);
  };

  const size = () => {
    if (!hudCanvas.isConnected) return;
    const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    hudCanvas.width = w * dpr; hudCanvas.height = h * dpr; hud.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(size); ro.observe(el); size();
  let onScreen = true;
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }); io.observe(el);

  const project = (v) => {
    const p = v.clone().project(camera), w = el.clientWidth, h = el.clientHeight;
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, on: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1, behind: p.z > 1 };
  };

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), aim = new THREE.Vector3(), camGoal = new THREE.Vector3(), look = new THREE.Vector3(), P = new THREE.Vector3();
  const fwd = new THREE.Vector3(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    const ph = phaseRef.current;
    if (!onScreen && ph !== 'playing') return;
    if (ph === 'playing' && worker) {
      throttle = Math.max(0, Math.min(1, throttle + input.throttle * dt * 0.7));
      controls.update(dt);
      acc = Math.min(0.1, acc + dt);
      if (!pending) {
        aimDir(aim);
        worker.postMessage({ type: 'step', dt: acc, input: { aim: [aim.x, aim.y, aim.z], roll: input.roll, throttle, fire: input.fire, missile: input.missile, flare: input.flare } });
        input.missile = input.flare = false; pending = true; acc = 0;
      }
    }
    const pl = view.planes, alive = (i) => pl[i * PS + 15] > 0.5;
    at(0, P);
    if (ph === 'menu') { // a slow orbit around the parked jet (still, with reduced motion)
      const a = reduced ? 0.8 : now / 6000;
      camera.position.set(Math.sin(a) * 40, 905, -2600 + Math.cos(a) * 40); camera.lookAt(P);
    } else {
      // Behind the jet along the aim, horizon level, as in Base.
      const a = aimDir(tmp);
      camGoal.copy(P).addScaledVector(a, input.look ? 34 : -32); camGoal.y += 10;
      camera.position.lerp(camGoal, 1 - Math.exp(-dt * 10));
      camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 6);
      camera.up.set(0, 1, 0);
      camera.lookAt(look.copy(P).addScaledVector(a, input.look ? -80 : 120));
    }
    world.follow(P, camera.position);

    jets.forEach((j, i) => {
      const live = i < view.np && (alive(i) || pl[i * PS + 18] > 0);
      j.visible = live;
      if (!live) return;
      at(i, j.position); quat(i, j.quaternion);
      const heat = alive(i) ? (i ? 0.75 : throttle) : 0;
      j.userData.flame.scale.setScalar(alive(i) ? 0.45 + heat * 0.9 + Math.random() * 0.1 : 0.01);
      j.userData.heat.value = 0.3 + heat;
      if (!i) j.userData.pylons.forEach((m, k) => (m.visible = (view.hud?.msl ?? 4) > k));
      if (alive(i) && pl[i * PS + 14] < 30 + (i ? 0 : 20) && Math.random() < 0.6) effects.trail(tmp.set(0, 0, -16).applyQuaternion(j.quaternion).add(j.position).toArray(), true);
      if (!alive(i)) { effects.flame(j.position.toArray()); effects.trail(j.position.toArray(), true); }
    });
    for (let k = 0; k < view.nm; k++) {
      const o = k * MS, enemy = view.missiles[o + 10] === 1;
      let m = missileMeshes[k];
      if (!m || m.userData.enemy !== enemy) { if (m) scene.remove(m); m = missileMeshes[k] = buildMissileMesh(kits.player, enemy); m.userData.enemy = enemy; scene.add(m); }
      m.visible = true;
      m.position.fromArray(view.missiles, o);
      m.quaternion.copy(q.setFromUnitVectors(Z, fwd.fromArray(view.missiles, o + 3)));
      effects.trail(m.position.toArray(), false);
    }
    for (let k = view.nm; k < missileMeshes.length; k++) missileMeshes[k].visible = false;
    tracers[0](view.bullets, view.nb, 0); tracers[1](view.bullets, view.nb, 1);
    const live = ph === 'paused' ? 0 : dt;
    effects.step(live);
    world.update(live, camera.position, tmp2.fromArray(pl, 7));
    // Lightning in a storm, with thunder arriving at the speed of sound.
    if (atm.lightning && live && (strikeT -= live) <= 0) {
      const d = world.strike(P); strikeT = nextStrike(Math.random());
      setTimeout(() => { if (!gone) audio?.thunder(Math.max(0.25, 1 - d / 6000)); }, thunderDelay(d) * 1000);
    }
    if (flareLight.intensity > 0) { flareLight.intensity = Math.max(0, flareLight.intensity - 3600 * live); flareVel.y -= 30 * live; flareLight.position.addScaledVector(flareVel, live); }
    // Looking toward the sun, the exposure eases down a little, as eyes do; elsewhere it stays bright.
    camera.getWorldDirection(fwd);
    const toward = atm.sky ? THREE.MathUtils.smoothstep(fwd.dot(SUN), 0.7, 0.98) : 0;
    glare += (toward - glare) * Math.min(1, dt * 3);
    renderer.toneMappingExposure = EXPOSURE * (1 - 0.4 * glare);
    rainSound?.set(ph === 'playing' ? atm.rain : 0);
    post.render();

    // The HUD.
    const w = el.clientWidth, h = el.clientHeight, H = view.hud;
    if ((ph === 'playing' || ph === 'paused') && H) {
      quat(0, shooter.quat);
      const f = tmp.set(0, 0, 1).applyQuaternion(shooter.quat).clone(), inv = shooter.quat.clone().invert();
      const hidden = new Set(H.hidden), seen = [];
      for (let i = 1; i < view.np; i++) if (alive(i) && !hidden.has(i)) seen.push({ i, pos: at(i), vel: new THREE.Vector3().fromArray(pl, i * PS + 7), hp: pl[i * PS + 14] });
      const near = seen.sort((a, b) => a.pos.distanceTo(P) - b.pos.distanceTo(P))[0];
      const warnings = [];
      if (alive(0) && P.y - groundAt(P.x, P.z) < 150 && f.y < 0) warnings.push('PULL UP');
      if (H.incoming) warnings.push(H.incoming > 1 ? `MISSILES  ×${H.incoming}` : 'MISSILE');
      if (H.outT > 0) warnings.push(`RETURN TO THE COMBAT AREA  ${Math.ceil(12 - H.outT)}`);
      if (pl[14] < 30) warnings.push('HEAVY DAMAGE');
      if (notice) { notice.t -= dt; if (notice.t <= 0) notice = null; }
      const coarse = matchMedia('(pointer: coarse)').matches;
      if (banner && ph === 'playing') banner.t += dt;
      const bAlpha = banner ? Math.max(0, Math.min(1, banner.t * 3, (BANNER + 0.5 - banner.t) * 2)) : 0;
      if (banner && banner.t > BANNER + 1) banner = null;
      const inside = clouds.find((c) => camera.position.distanceTo(tmp2.set(c.x, c.y, c.z)) < c.r * 0.85);
      drawHud(hud, w, h, {
        aim: project(tmp2.copy(P).addScaledVector(aimDir(aim), 500)),
        boresight: project(tmp2.copy(P).addScaledVector(f, 500)),
        enemies: seen.map((e) => { const s = project(e.pos); if (s.behind) { s.x = w - s.x; s.y = h - s.y; s.on = false; } return { ...s, dist: e.pos.distanceTo(P), hp: e.hp / H.maxHp, locked: e.i === H.lock && H.lockT > 1 }; }),
        lead: near && near.pos.distanceTo(P) < 1100 ? (() => { const s = project(leadPoint(P, near.pos, near.vel)); return s.on ? s : null; })() : null,
        lock: H.lock > 0 ? { ...project(at(H.lock)), p: H.lockT, locked: H.lockT > 1 } : null,
        kills: H.kills, time: mmss(H.t), speed: Math.hypot(pl[7], pl[8], pl[9]), alt: P.y, throttle,
        hp: pl[14] / 100, ammo: H.ammo, missiles: H.msl, flares: H.flares,
        notice: notice && { text: notice.text, a: Math.min(1, notice.t * 2) },
        radar: seen.map((e) => { const l = e.pos.clone().sub(P).applyQuaternion(inv); return { x: -l.x, y: l.z }; }),
        warnings, blink: now / 1000, hurt, touch: coarse,
        wave: { n: H.wave, left: H.left, hidden: H.hidden.length },
        banner: banner && { ...banner, a: bAlpha, slide: reduced ? 0 : (1 - bAlpha) * 12 },
        whiteoutRGB: atm.inside,
        whiteout: inside ? Math.min(0.75, (1 - camera.position.distanceTo(tmp2.set(inside.x, inside.y, inside.z)) / (inside.r * 0.85)) * 2.2) : 0,
      });
    } else hud.clearRect(0, 0, w, h);
    hurt = Math.max(0, hurt - dt * 2);
    motor?.set(throttle, ph === 'playing' && alive(0));
  };
  raf = requestAnimationFrame(frame);

  api.current = {
    input,
    start() {
      if (!audio) { audio = createAudio({ limiter: true }); motor = audio.engine({ base: 70, kind: 'jet' }); rainSound = audio.rain(); }
      audio.resume();
      enterFull(el, { lock: true });
      startWorker(); worker.postMessage({ type: 'start', seed: (Math.random() * 2 ** 32) >>> 0, atmos: { time: atm.time, weather: atm.weather } });
      view = { ...view, np: 1, planes: parked, nb: 0, nm: 0, hud: null };
      pending = false; acc = 0; throttle = 0.7; over = false; banner = null; notice = null; hurt = 0;
      clearInput(); input.yaw = 0; input.pitch = 0; // the jet starts heading +Z, level
      camera.position.set(0, 909, -2630);
      stopMusic?.(); stopMusic = audio.music();
      setResult(null); setPhase('playing');
    },
    pause() { clearInput(); motor?.set(0, false); stopMusic?.(); stopMusic = null; setPhase('paused'); },
    resume() { enterFull(el, { lock: true }); audio?.resume(); if (!over) stopMusic = audio?.music(); last = performance.now(); setPhase('playing'); },
    // Time and weather change live, mid-sortie too.
    setAtmosphere(time, weather) {
      atm = atmosphere(time, weather); world.setAtmosphere(atm);
      worker?.postMessage({ type: 'atmos', atmos: { time, weather } });
    },
    leave() { exitFull(); clearInput(); motor?.set(0, false); stopMusic?.(); stopMusic = null; worker?.terminate(); worker = null; view = { ...view, np: 1, planes: parked, nb: 0, nm: 0, hud: null }; setResult(null); setPhase('menu'); },
  };
  // The benchmark (eval/suites/games.mjs) reads the wave and skips through waves; only with ?bench in the URL.
  if (new URLSearchParams(location.search).has('bench')) window.__extreme = { hud: () => view.hud, atmos: () => `${atm.time} ${atm.weather}`, clearWave: () => worker?.postMessage({ type: 'clear' }) };

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    controls.unbind(); exitFull();
    worker?.terminate();
    gone = true;
    stopMusic?.(); motor?.stop(); rainSound?.stop(); audio?.close();
    // Free the GPU now: dispose everything, then the renderer, which destroys its WebGPU device.
    scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    world.dispose(); kits.player.dispose(); kits.enemy.dispose(); smokeMap.dispose(); post.dispose?.();
    renderer.dispose(); canvas.remove(); delete window.__extreme;
  };
}
