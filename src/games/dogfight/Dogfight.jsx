import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Roll from '../../components/Roll';
import { createAudio } from '../audio';
import {
  createPlane, fly, steerToward, forwardOf, upOf, fireBullet, stepBullets, createMissile, stepMissile,
  lockCandidate, leadPoint, think, crashed, outOfBounds, groundAt, finalScore,
} from './logic';
import { createWorld, buildJet, createTracers, createEffects, buildMissile } from './scene';
import { drawHud } from './hud';

const KEY = 'dogfight-best';
const best = () => { try { return +localStorage.getItem(KEY) || 0; } catch { return 0; } };
const AMMO = 600, MISSILES = 4, FIRE_RATE = 1 / 14;
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// Everything that changes during a sortie, reset on every start.
function newSortie() {
  const player = createPlane({ pos: new THREE.Vector3(0, 900, -2600), team: 'red' });
  const enemies = [[-380, 980, 1400], [380, 1040, 1550], [-120, 1150, 1800], [160, 900, 2050]].map(([x, y, z]) => {
    const e = createPlane({ pos: new THREE.Vector3(x, y, z), team: 'blue', hp: 60, min: 70, max: 170, speed: 135, agility: 0.8 });
    e.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); // head-on merge
    return e;
  });
  return { player, enemies, bullets: [], missiles: [], t: 0, shots: 0, hits: 0, kills: 0, ammo: AMMO, mslLeft: MISSILES, cooldown: 0, lockTarget: null, lockT: 0, lockBeep: 0, outT: 0, hurt: 0, throttle: 0.7 };
}

export default function Dogfight() {
  const wrap = useRef(null), glCanvas = useRef(null), hudCanvas = useRef(null);
  const [phase, setPhase] = useState('menu'); // menu | playing | paused | won | lost
  const [result, setResult] = useState(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const api = useRef({});

  useEffect(() => {
    const el = wrap.current;
    const renderer = new THREE.WebGLRenderer({ canvas: glCanvas.current, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = createWorld(), camera = new THREE.PerspectiveCamera(68, 16 / 9, 1, 12000);
    const effects = createEffects(scene), playerTracers = createTracers(scene, '#ffe27a'), enemyTracers = createTracers(scene, '#ff6b6b');
    const hud = hudCanvas.current.getContext('2d');
    let g = newSortie(), audio = null, motor = null, stopMusic = null, raf = 0, last = performance.now();
    let jets = [], missileMeshes = new Map();
    const input = { ndc: new THREE.Vector2(0, 0), fire: false, missile: false, roll: 0, throttle: 0, look: false, stick: null };

    const placeJets = () => {
      jets.forEach((j) => scene.remove(j));
      jets = [g.player, ...g.enemies].map((p, i) => { const j = buildJet(i ? { body: '#3b4450', accent: '#f2b544' } : {}); scene.add(j); return j; });
      missileMeshes.forEach((m) => scene.remove(m)); missileMeshes = new Map();
    };
    placeJets();

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      hudCanvas.current.width = w * dpr; hudCanvas.current.height = h * dpr; hud.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(size); ro.observe(el); size();

    const project = (v) => {
      const p = v.clone().project(camera), w = el.clientWidth, h = el.clientHeight;
      return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, on: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1, behind: p.z > 1 };
    };

    const destroy = (p) => {
      if (!p.alive) return;
      p.alive = false; p.wreck = 3.5; p.spin = (Math.random() - 0.5) * 6;
      effects.explode(p.pos);
      audio?.explode(p.pos.distanceTo(g.player.pos));
      if (p !== g.player) g.kills++;
    };

    const end = (won, why) => {
      if (g.over) return;
      g.over = true;
      const score = finalScore({ kills: g.kills, time: g.t, shots: g.shots, hits: g.hits, hp: g.player.hp });
      try { if (score > best()) localStorage.setItem(KEY, score); } catch { /* private mode */ }
      setResult({ won, why, score, kills: g.kills, time: mmss(g.t), accuracy: g.shots ? Math.round((g.hits / g.shots) * 100) : 0 });
      if (won) audio?.win();
      stopMusic?.(); stopMusic = null;
      setTimeout(() => setPhase(won ? 'won' : 'lost'), won ? 400 : 1600);
    };

    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), ray = new THREE.Raycaster();
    const step = (dt) => {
      const P = g.player, live = g.enemies.filter((e) => e.alive);
      g.t += dt;
      // Throttle from W/S (sticky); aim from the pointer (or the touch stick).
      g.throttle = Math.max(0, Math.min(1, g.throttle + input.throttle * dt * 0.7));
      const ndc = input.stick ?? input.ndc;
      ray.setFromCamera(ndc, camera);
      const ctl = steerToward(P, ray.ray.direction);
      if (input.roll) ctl.roll = input.roll;
      if (P.alive) fly(P, { ...ctl, throttle: g.throttle }, dt);

      // Guns.
      g.cooldown -= dt;
      if (input.fire && P.alive && g.ammo > 0 && g.cooldown <= 0) {
        g.bullets.push(fireBullet(P, 'red', 0.004)); g.ammo--; g.shots++; g.cooldown = FIRE_RATE; audio?.gun();
      }
      // Missile lock and launch.
      const cand = P.alive ? lockCandidate(P, live) : null;
      g.lockT = cand && cand === g.lockTarget ? g.lockT + dt : 0; g.lockTarget = cand;
      const locked = g.lockT > 1;
      if (cand && (g.lockBeep -= dt) <= 0) { audio?.lock(); g.lockBeep = locked ? 0.12 : 0.35; }
      if (input.missile) {
        input.missile = false;
        if (locked && g.mslLeft > 0) { g.missiles.push(createMissile(P, g.lockTarget)); g.mslLeft--; audio?.missile(); }
      }

      // Enemy pilots get sharper as their wingmen fall.
      const skill = 0.35 + g.kills * 0.17;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const d = think(e, P, g.t, skill);
        fly(e, d.input, dt);
        e.cooldown -= dt;
        if (d.fire && P.alive && e.cooldown <= 0) { g.bullets.push(fireBullet(e, 'blue', 0.03 - skill * 0.015)); e.cooldown = 0.11; }
        if (crashed(e)) destroy(e);
      }

      for (const { bullet, plane } of stepBullets(g.bullets, [P, ...g.enemies], dt)) {
        if (plane === P) { P.hp -= 3.5; g.hurt = 1; audio?.hit(); }
        else { plane.hp -= 7; g.hits++; effects.spark(bullet.pos); if (Math.random() < 0.3) plane.evadeUntil = g.t + 1.5; }
        if (plane.hp <= 0) destroy(plane);
      }
      g.bullets = g.bullets.filter((b) => b.life > 0);
      for (const m of g.missiles) {
        if (stepMissile(m, dt)) { m.target.hp -= 80; destroy(m.target); }
        effects.trail(m.pos, false);
      }
      g.missiles = g.missiles.filter((m) => m.life > 0);

      // Damaged planes smoke; wrecks fall, burning, then vanish.
      for (const p of [P, ...g.enemies]) {
        if (p.alive && p.hp < p.maxHp * 0.5 && Math.random() < 0.6) effects.trail(tmp.copy(p.pos).addScaledVector(forwardOf(p, tmp2), -12), true);
        if (!p.alive && p.wreck > 0) {
          p.wreck -= dt; p.vel.y -= 40 * dt; p.pos.addScaledVector(p.vel, dt);
          p.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.spin * dt));
          effects.flame(p.pos); effects.trail(p.pos, true);
        }
      }

      if (P.alive && !g.over) {
        g.outT = outOfBounds(P) ? g.outT + dt : 0;
        if (crashed(P)) { destroy(P); end(false, 'You flew into the ground'); }
        else if (P.hp <= 0) end(false, 'Shot down');
        else if (g.outT > 12) { destroy(P); end(false, 'Left the combat area'); }
        else if (g.kills === g.enemies.length) end(true, 'All four down');
      }
      g.hurt = Math.max(0, g.hurt - dt * 2);
      motor?.set(g.throttle, !!P.alive);
    };

    const camGoal = new THREE.Vector3(), look = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
    const frame = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const ph = phaseRef.current, P = g.player;
      if (ph === 'playing') step(dt);
      if (ph === 'menu') { // a slow orbit around the parked jet
        P.pos.set(0, 900, -2600); P.quat.identity();
        const a = now / 6000; camera.position.set(Math.sin(a) * 40, 905, -2600 + Math.cos(a) * 40); camera.lookAt(P.pos);
      } else {
        const f = forwardOf(P, tmp), u = upOf(P, tmp2);
        camGoal.copy(P.pos).addScaledVector(f, input.look ? 34 : -30).addScaledVector(u, 9);
        camera.position.lerp(camGoal, 1 - Math.exp(-dt * 7));
        camUp.lerp(u, 1 - Math.exp(-dt * 3)).normalize(); camera.up.copy(camUp).lerp(new THREE.Vector3(0, 1, 0), 0.55);
        camera.lookAt(look.copy(P.pos).addScaledVector(f, input.look ? -60 : 70));
      }
      [P, ...g.enemies].forEach((p, i) => {
        const j = jets[i]; j.visible = p.alive || p.wreck > 0;
        j.position.copy(p.pos); j.quaternion.copy(p.quat);
        j.userData.flame.scale.setScalar(p.alive ? 0.5 + (i ? 0.6 : g.throttle) * 0.9 + Math.random() * 0.1 : 0.01);
      });
      for (const m of g.missiles) {
        if (!missileMeshes.has(m)) { const mesh = buildMissile(); scene.add(mesh); missileMeshes.set(m, mesh); }
        const mesh = missileMeshes.get(m); mesh.position.copy(m.pos); mesh.lookAt(tmp.copy(m.pos).add(m.dir));
      }
      for (const [m, mesh] of missileMeshes) if (!g.missiles.includes(m)) { scene.remove(mesh); missileMeshes.delete(m); }
      playerTracers(g.bullets.filter((b) => b.owner === 'red')); enemyTracers(g.bullets.filter((b) => b.owner === 'blue'));
      effects.step(dt);
      renderer.render(scene, camera);

      const w = el.clientWidth, h = el.clientHeight;
      if (ph === 'playing' || ph === 'paused') {
        const f = forwardOf(P, new THREE.Vector3()), near = g.enemies.filter((e) => e.alive).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos))[0];
        const inv = P.quat.clone().invert();
        const warnings = [];
        if (P.alive && P.pos.y - groundAt(P.pos.x, P.pos.z) < 150 && f.y < 0) warnings.push('PULL UP');
        if (g.outT > 0) warnings.push(`RETURN TO THE COMBAT AREA  ${Math.ceil(12 - g.outT)}`);
        if (P.hp < 30) warnings.push('HEAVY DAMAGE');
        drawHud(hud, w, h, {
          aim: input.stick ? { x: (input.stick.x + 1) / 2 * w, y: (1 - input.stick.y) / 2 * h } : { x: (input.ndc.x + 1) / 2 * w, y: (1 - input.ndc.y) / 2 * h },
          boresight: project(tmp.copy(P.pos).addScaledVector(f, 500)),
          enemies: g.enemies.filter((e) => e.alive).map((e) => { const s = project(e.pos); if (s.behind) { s.x = w - s.x; s.y = h - s.y; s.on = false; } return { ...s, dist: e.pos.distanceTo(P.pos), hp: e.hp / e.maxHp, locked: e === g.lockTarget && g.lockT > 1 }; }),
          lead: near && near.pos.distanceTo(P.pos) < 1100 ? (() => { const s = project(leadPoint(P.pos, near.pos, near.vel)); return s.on ? s : null; })() : null,
          lock: g.lockTarget ? { ...project(g.lockTarget.pos), p: g.lockT, locked: g.lockT > 1 } : null,
          kills: g.kills, time: mmss(g.t), speed: P.speed, alt: P.pos.y, throttle: g.throttle,
          hp: P.hp / P.maxHp, ammo: g.ammo, missiles: g.mslLeft,
          radar: g.enemies.filter((e) => e.alive).map((e) => { const l = e.pos.clone().sub(P.pos).applyQuaternion(inv); return { x: -l.x, y: l.z }; }),
          warnings, blink: now / 1000, hurt: g.hurt,
        });
      } else hud.clearRect(0, 0, w, h);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Input.
    const onMove = (e) => { const r = el.getBoundingClientRect(); input.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const KEYS = { KeyW: ['throttle', 1], KeyS: ['throttle', -1], KeyA: ['roll', -1], KeyD: ['roll', 1], KeyC: ['look', true] };
    const onKey = (down) => (e) => {
      if (phaseRef.current !== 'playing') { if (down && e.code === 'Escape' && phaseRef.current === 'paused') api.current.resume(); return; }
      if (KEYS[e.code]) { const [k, v] = KEYS[e.code]; input[k] = down ? v : (k === 'look' ? false : 0); e.preventDefault(); }
      if (e.code === 'Space') { input.fire = down; e.preventDefault(); }
      if (e.code === 'KeyF' && down && !e.repeat) input.missile = true;
      if (e.code === 'Escape' && down) api.current.pause();
    };
    const kd = onKey(true), ku = onKey(false);
    const onHide = () => { if (document.hidden && phaseRef.current === 'playing') api.current.pause(); };
    el.addEventListener('pointermove', onMove);
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    document.addEventListener('visibilitychange', onHide);

    api.current = {
      input,
      start() {
        if (!audio) { audio = createAudio(); motor = audio.engine({ base: 70, kind: 'jet' }); }
        audio.resume();
        g = newSortie(); placeJets(); input.fire = false; input.missile = false;
        camera.position.copy(g.player.pos).add(new THREE.Vector3(0, 9, -30));
        stopMusic?.(); stopMusic = audio.music();
        setResult(null); setPhase('playing');
      },
      pause() { input.fire = false; motor?.set(0, false); stopMusic?.(); stopMusic = null; setPhase('paused'); },
      resume() { audio?.resume(); stopMusic = audio?.music(); setPhase('playing'); },
    };

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      el.removeEventListener('pointermove', onMove);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      document.removeEventListener('visibilitychange', onHide);
      stopMusic?.(); motor?.stop(); audio?.close();
      renderer.dispose();
    };
  }, []);

  const i = () => api.current.input;
  const fire = (on) => (e) => { e.preventDefault(); if (phase === 'playing') i().fire = on; };
  // Touch stick: drag inside the circle; the offset becomes where the plane is asked to fly.
  const stick = (e) => {
    if (phase !== 'playing') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    i().stick = new THREE.Vector2(Math.max(-1, Math.min(1, x)) * 0.8, Math.max(-1, Math.min(1, y)) * 0.8);
  };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current.requestFullscreen?.());

  return (
    <div ref={wrap} className="relative border border-ink bg-[#0b0d12] aspect-[16/9] max-h-[85vh] w-full select-none touch-none overflow-hidden text-[#f2f3ef]"
      onPointerDown={(e) => { if (phase === 'playing' && e.pointerType === 'mouse' && e.button === 0) i().fire = true; }}
      onPointerUp={(e) => { if (e.pointerType === 'mouse') i().fire = false; }}
      onContextMenu={(e) => { e.preventDefault(); if (phase === 'playing') i().missile = true; }}>
      <canvas ref={glCanvas} className="absolute inset-0 size-full" aria-label="Dogfight, a 3D air combat game" role="img" />
      <canvas ref={hudCanvas} className="absolute inset-0 size-full pointer-events-none" aria-hidden="true" />

      {phase === 'playing' && (
        <>
          {/* Touch controls (shown on touch screens only). */}
          <div className="hidden pointer-coarse:block absolute left-4 bottom-4 size-32 rounded-full border-2 border-white/40 bg-white/10"
            onPointerDown={stick} onPointerMove={(e) => e.buttons && stick(e)} onPointerUp={() => (i().stick = null)} onPointerCancel={() => (i().stick = null)} aria-hidden="true" />
          <div className="hidden pointer-coarse:flex absolute right-4 bottom-4 gap-3">
            <button type="button" className="size-16 rounded-full bg-white/15 border-2 border-white/50 data text-white" onPointerDown={() => (i().missile = true)}>MSL</button>
            <button type="button" className="size-20 rounded-full bg-[#c41e2c]/80 border-2 border-white/60 data text-white" onPointerDown={fire(true)} onPointerUp={fire(false)} onPointerCancel={fire(false)}>FIRE</button>
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            <button type="button" className="btn btn-sm border-white/60 text-white hover:bg-white hover:text-[#0b0d12]" onClick={() => api.current.pause()}>Pause</button>
            <button type="button" className="btn btn-sm border-white/60 text-white hover:bg-white hover:text-[#0b0d12]" onClick={full}>Full screen</button>
          </div>
        </>
      )}

      {phase !== 'playing' && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 text-center bg-[#0b0d12]/55 backdrop-blur-[2px] p-6">
          {phase === 'menu' && (
            <>
              <p className="data text-[#ff8790]">Four bandits inbound</p>
              <p className="display text-[clamp(2.25rem,5vw,4rem)]">Dogfight</p>
              <p className="max-w-md text-[#c9ced6]">Point with the mouse to fly. Click or Space to fire, hold on a target for a missile lock, then F or right-click. W / S throttle, A / D roll, C to look back, Esc to pause.</p>
            </>
          )}
          {phase === 'paused' && <p className="display text-[clamp(2rem,4vw,3.5rem)]">Paused</p>}
          {(phase === 'won' || phase === 'lost') && result && (
            <>
              <p className={`data ${result.won ? 'text-[#8dffb4]' : 'text-[#ff8790]'}`}>{result.why}</p>
              <p className="display text-6xl md:text-7xl"><Roll value={result.score} /></p>
              <dl className="flex flex-wrap justify-center gap-6 text-[#c9ced6]">
                <div><dt className="text-sm">Down</dt><dd className="text-white">{result.kills} / 4</dd></div>
                <div><dt className="text-sm">Time</dt><dd className="text-white">{result.time}</dd></div>
                <div><dt className="text-sm">Accuracy</dt><dd className="text-white">{result.accuracy}%</dd></div>
                <div><dt className="text-sm">Best</dt><dd className="text-white">{best()}</dd></div>
              </dl>
            </>
          )}
          <button type="button" className="btn btn-signal" onClick={() => (phase === 'paused' ? api.current.resume() : api.current.start())}>
            {phase === 'menu' ? 'Take off' : phase === 'paused' ? 'Resume' : 'Fly again'}
          </button>
        </div>
      )}
    </div>
  );
}
