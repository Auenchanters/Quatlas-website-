import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Roll from '../../components/Roll';
import { createAudio } from '../audio';
import {
  createPlane, fly, steerToward, forwardOf, fireBullet, stepBullets, createMissile, stepMissile,
  lockCandidate, leadPoint, think, crashed, outOfBounds, groundAt, finalScore,
} from './logic';
import { createWorld, buildJet, createTracers, createEffects, buildMissile } from './scene';
import { drawHud } from './hud';
import { createControls } from './controls';
import { FULL, enterFull, exitFull } from '../fullscreen';

const focusOnMount = (el) => el?.focus({ preventScroll: true });

const KEY = 'dogfight-best', GFX = 'dogfight-graphics';
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
  const wrap = useRef(null), hudCanvas = useRef(null);
  const [phase, setPhase] = useState('menu'); // menu | playing | paused | won | lost
  const [result, setResult] = useState(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const api = useRef({});
  // Graphics: Base (this file's WebGL game) or Extreme (extreme/, WebGPU + a worker + WASM, in waves).
  const [graphics, setGraphics] = useState(() => { try { return localStorage.getItem(GFX) === 'extreme' ? 'extreme' : 'base'; } catch { return 'base'; } });
  const [ready, setReady] = useState(false), [note, setNote] = useState('');
  const choose = (v) => {
    try { localStorage.setItem(GFX, v); } catch { /* private mode */ }
    setNote(''); setResult(null); setPhase('menu'); setGraphics(v);
  };

  // Extreme: only where WebGPU works; its chunk, worker and WASM load only when it is chosen.
  useEffect(() => {
    if (graphics !== 'extreme') return;
    let dispose = null, dead = false;
    setReady(false);
    (async () => {
      try {
        if (!(await navigator.gpu?.requestAdapter())) throw new Error('no WebGPU');
        const { mountExtreme } = await import('./extreme/engine');
        if (dead) return;
        const d = await mountExtreme({ el: wrap.current, hudCanvas: hudCanvas.current, phaseRef, setPhase, setResult, api });
        if (dead) d(); else { dispose = d; setReady(true); }
      } catch (e) {
        if (dead) return;
        if (e.message !== 'no WebGPU') console.error(e);
        choose('base');
        setNote('Extreme needs WebGPU, which this browser doesn’t offer, so you’re flying Base.');
      }
    })();
    return () => { dead = true; dispose?.(); };
  }, [graphics]);

  useEffect(() => {
    if (graphics !== 'base') return;
    const el = wrap.current;
    // A fresh canvas per mount: the old one's context is released on cleanup, so it can't be reused.
    const canvas = Object.assign(document.createElement('canvas'), { className: 'absolute inset-0 size-full' });
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Dogfight, a 3D air combat game');
    el.prepend(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = createWorld(), camera = new THREE.PerspectiveCamera(68, 16 / 9, 1, 12000);
    const effects = createEffects(scene), playerTracers = createTracers(scene, '#ffe27a'), enemyTracers = createTracers(scene, '#ff6b6b');
    const hud = hudCanvas.current.getContext('2d');
    let g = newSortie(), audio = null, motor = null, stopMusic = null, raf = 0, last = performance.now();
    let jets = [], missileMeshes = new Map();
    const controls = createControls(el, phaseRef, api), { input, aimDir, aimFrom, clearInput } = controls;

    const placeJets = () => {
      const free = (o) => { scene.remove(o); o.traverse((c) => { c.geometry?.dispose(); [].concat(c.material ?? []).forEach((m) => m.dispose()); }); };
      jets.forEach(free);
      jets = [g.player, ...g.enemies].map((p, i) => { const j = buildJet(i ? { body: '#3b4450', accent: '#f2b544' } : {}); scene.add(j); return j; });
      missileMeshes.forEach(free); missileMeshes = new Map();
    };
    placeJets();

    const size = () => {
      if (!hudCanvas.current) return; // a last resize can land after unmount
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      hudCanvas.current.width = w * dpr; hudCanvas.current.height = h * dpr; hud.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }); io.observe(el);

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
      stopMusic?.(); stopMusic = null; motor?.set(0, false);
      setTimeout(() => setPhase(won ? 'won' : 'lost'), won ? 400 : 1600);
    };

    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), aim = new THREE.Vector3();
    const step = (dt) => {
      const P = g.player, live = g.enemies.filter((e) => e.alive);
      g.t += dt;
      // Throttle from W/S (sticky); aim from the pointer (or the touch stick).
      g.throttle = Math.max(0, Math.min(1, g.throttle + input.throttle * dt * 0.7));
      controls.update(dt);
      const ctl = steerToward(P, aimDir(aim));
      if (input.roll) ctl.roll = input.roll;
      if (P.alive) fly(P, { ...ctl, throttle: g.throttle }, dt);

      // Guns.
      g.cooldown -= dt;
      if (input.fire && P.alive && g.ammo > 0 && g.cooldown <= 0) {
        g.bullets.push(fireBullet(P, 'red', 0.004)); g.ammo--; g.shots++; g.cooldown = FIRE_RATE; audio?.cannon();
      }
      // Missile lock and launch.
      const cand = P.alive ? lockCandidate(P, live) : null;
      g.lockT = cand && cand === g.lockTarget ? g.lockT + dt : 0; g.lockTarget = cand;
      const locked = g.lockT > 1;
      if (cand && (g.lockBeep -= dt) <= 0) { audio?.tick(); g.lockBeep = locked ? 0.12 : 0.35; }
      if (input.missile) {
        input.missile = false;
        // Locked: it homes on the lock. Not locked yet: it still flies, chasing whatever is in the sights, or straight on.
        if (P.alive && g.mslLeft > 0) { g.missiles.push(createMissile(P, locked ? g.lockTarget : cand)); g.mslLeft--; audio?.missile(); }
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
        if (plane === P) { P.hp -= 3.5; g.hurt = 1; audio?.struck(); }
        else { plane.hp -= 7; g.hits++; effects.spark(bullet.pos); if (Math.random() < 0.3) plane.evadeUntil = g.t + 1.5; }
        if (plane.hp <= 0 && plane !== P) destroy(plane);
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

      if (!g.over) {
        g.outT = P.alive && outOfBounds(P) ? g.outT + dt : 0;
        if (P.hp <= 0) { destroy(P); end(false, 'Shot down'); } // bullets only damage; the end happens here
        else if (crashed(P)) { destroy(P); end(false, 'You flew into the ground'); }
        else if (g.outT > 12) { destroy(P); end(false, 'Left the combat area'); }
        else if (g.kills === g.enemies.length) end(true, 'All four down');
        // Warning tone once a second for PULL UP and out of bounds.
        const low = P.pos.y - groundAt(P.pos.x, P.pos.z) < 150 && forwardOf(P, tmp).y < 0;
        if ((low || g.outT > 0) && (g.warnT = (g.warnT ?? 0) - dt) <= 0) { audio?.alarm(); g.warnT = 1; }
      }
      g.hurt = Math.max(0, g.hurt - dt * 2);
      motor?.set(g.throttle, !!P.alive);
    };

    const camGoal = new THREE.Vector3(), look = new THREE.Vector3();
    const frame = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const ph = phaseRef.current, P = g.player;
      if (!onScreen && ph !== 'playing') { raf = requestAnimationFrame(frame); return; }
      if (ph === 'playing') step(dt);
      if (ph === 'menu') { // a slow orbit around the parked jet
        P.pos.set(0, 900, -2600); P.quat.identity();
        const a = now / 6000; camera.position.set(Math.sin(a) * 40, 905, -2600 + Math.cos(a) * 40); camera.lookAt(P.pos);
      } else {
        // The camera sits behind the jet along the aim and keeps the horizon level (no roll), so loops
        // and rolls never flip the view.
        const a = aimDir(tmp);
        camGoal.copy(P.pos).addScaledVector(a, input.look ? 34 : -32); camGoal.y += 10;
        camera.position.lerp(camGoal, 1 - Math.exp(-dt * 10));
        camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z) + 6);
        camera.up.set(0, 1, 0);
        camera.lookAt(look.copy(P.pos).addScaledVector(a, input.look ? -80 : 120));
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
      for (const [m, mesh] of missileMeshes) if (!g.missiles.includes(m)) { scene.remove(mesh); mesh.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); }); missileMeshes.delete(m); }
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
        const coarse = matchMedia('(pointer: coarse)').matches; // the touch controls own the bottom corners
        drawHud(hud, w, h, {
          aim: project(tmp2.copy(P.pos).addScaledVector(aimDir(aim), 500)),
          boresight: project(tmp.copy(P.pos).addScaledVector(f, 500)),
          enemies: g.enemies.filter((e) => e.alive).map((e) => { const s = project(e.pos); if (s.behind) { s.x = w - s.x; s.y = h - s.y; s.on = false; } return { ...s, dist: e.pos.distanceTo(P.pos), hp: e.hp / e.maxHp, locked: e === g.lockTarget && g.lockT > 1 }; }),
          lead: near && near.pos.distanceTo(P.pos) < 1100 ? (() => { const s = project(leadPoint(P.pos, near.pos, near.vel)); return s.on ? s : null; })() : null,
          lock: g.lockTarget ? { ...project(g.lockTarget.pos), p: g.lockT, locked: g.lockT > 1 } : null,
          kills: g.kills, time: mmss(g.t), speed: P.speed, alt: P.pos.y, throttle: g.throttle,
          hp: P.hp / P.maxHp, ammo: g.ammo, missiles: g.mslLeft,
          radar: g.enemies.filter((e) => e.alive).map((e) => { const l = e.pos.clone().sub(P.pos).applyQuaternion(inv); return { x: -l.x, y: l.z }; }),
          warnings, blink: now / 1000, hurt: g.hurt, touch: coarse,
        });
      } else hud.clearRect(0, 0, w, h);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    api.current = {
      input,
      start() {
        if (!audio) { audio = createAudio({ limiter: true }); motor = audio.engine({ base: 70, kind: 'jet' }); }
        audio.resume();
        enterFull(el, { lock: true });
        g = newSortie(); placeJets(); clearInput(); aimFrom(g.player);
        camera.position.copy(g.player.pos).add(new THREE.Vector3(0, 9, -30));
        stopMusic?.(); stopMusic = audio.music();
        setResult(null); setPhase('playing');
      },
      pause() { clearInput(); motor?.set(0, false); stopMusic?.(); stopMusic = null; setPhase('paused'); },
      resume() { enterFull(el, { lock: true }); audio?.resume(); if (!g.over) stopMusic = audio?.music(); setPhase('playing'); },
      leave() { exitFull(); clearInput(); motor?.set(0, false); stopMusic?.(); stopMusic = null; setResult(null); setPhase('menu'); },
    };

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      controls.unbind(); exitFull();
      stopMusic?.(); motor?.stop(); audio?.close();
      // Free the GPU memory now: browsers cap live WebGL contexts, and each visit would otherwise keep one.
      scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [graphics]);

  const i = () => api.current.input;
  const fire = (on) => (e) => { e.preventDefault(); if (phase === 'playing') i().fire = on; };
  // Touch stick: drag inside the circle; the offset becomes where the plane is asked to fly.
  const stick = (e) => {
    if (phase !== 'playing') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    i().stick = new THREE.Vector2(Math.max(-1, Math.min(1, x)) * 0.8, Math.max(-1, Math.min(1, y)) * 0.8);
  };

  return (
    <div ref={wrap} data-lenis-prevent className={`${phase === 'menu' ? 'relative border border-ink aspect-[16/9] pointer-coarse:portrait:aspect-[3/4] max-h-[85vh] w-full' : FULL} ${phase === 'playing' ? 'cursor-none' : ''} bg-[#0b0d12] select-none touch-none overflow-hidden text-[#f2f3ef]`}
      onPointerDown={(e) => {
        if (phase !== 'playing' || e.pointerType !== 'mouse') return;
        // Browsers can refuse mouse lock in the same click that went fullscreen, so any click in the game asks again.
        if (!document.pointerLockElement) Promise.resolve(wrap.current.requestPointerLock?.()).catch(() => {});
        if (e.button === 0) i().fire = true;
      }}
      onPointerUp={(e) => { if (e.pointerType === 'mouse') i().fire = false; }}
      /* Right button launches on mousedown: with the mouse locked there is no contextmenu event, and on
         Windows contextmenu only fires on release. The menu itself is always suppressed. */
      onMouseDown={(e) => { if (phase === 'playing' && e.button === 2) i().missile = true; }}
      onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={hudCanvas} className="absolute inset-0 size-full pointer-events-none" aria-hidden="true" />

      {phase === 'playing' && (
        <>
          {/* Touch controls (shown on touch screens only). */}
          <div className="hidden pointer-coarse:block absolute left-4 bottom-4 size-32 rounded-full border-2 border-white/40 bg-white/10"
            onPointerDown={stick} onPointerMove={(e) => e.buttons && stick(e)} onPointerUp={() => { i().stick = null; }} onPointerCancel={() => { i().stick = null; }} aria-hidden="true" />
          <div className="hidden pointer-coarse:flex absolute right-4 bottom-4 gap-3">
            <button type="button" className="size-16 rounded-full bg-white/15 border-2 border-white/50 data text-white" onPointerDown={() => (i().missile = true)}>MSL</button>
            <button type="button" className="size-20 rounded-full bg-[#c41e2c]/80 border-2 border-white/60 data text-white" onPointerDown={fire(true)} onPointerUp={fire(false)} onPointerCancel={fire(false)}>FIRE</button>
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            <button type="button" className="btn btn-sm border-white/60 text-white hover:bg-white hover:text-[#0b0d12]" onClick={() => api.current.pause()}>Pause</button>
          </div>
        </>
      )}

      {phase !== 'playing' && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-4 text-center bg-[#0b0d12]/55 backdrop-blur-[2px] p-6">
          {phase === 'menu' && (
            <>
              <p className="data text-[#ff8790]">{graphics === 'extreme' ? 'Wave after wave inbound' : 'Four bandits inbound'}</p>
              <p className="display text-[clamp(2.25rem,5vw,4rem)]">Dogfight</p>
              <p className="max-w-md text-[#c9ced6]">Move the mouse to aim: the jet flies to the circle. A / D or the arrow keys turn too. Click or Space to fire; right-click or F launches a missile, which homes best once the lock ring closes. W / S throttle, Q / E roll, C to look back. Plays full screen; Esc for the menu.</p>
              {graphics === 'extreme' && <p className="max-w-md text-[#ffcf6b]">Each wave is harder: guns, then homing missiles, then more jets, then they hide in clouds.</p>}
            </>
          )}
          {phase === 'paused' && <p className="display text-[clamp(2rem,4vw,3.5rem)]">Paused</p>}
          {(phase === 'won' || phase === 'lost') && result && (
            <>
              <p className={`data ${result.won ? 'text-[#8dffb4]' : 'text-[#ff8790]'}`}>{result.why}</p>
              <p className="display text-6xl md:text-7xl"><Roll value={result.score} /></p>
              <dl className="flex flex-wrap justify-center gap-6 text-[#c9ced6]">
                {result.extreme && <div><dt className="text-sm">Wave</dt><dd className="text-white">{result.wave}</dd></div>}
                <div><dt className="text-sm">Down</dt><dd className="text-white">{result.extreme ? result.kills : `${result.kills} / 4`}</dd></div>
                <div><dt className="text-sm">Time</dt><dd className="text-white">{result.time}</dd></div>
                <div><dt className="text-sm">Accuracy</dt><dd className="text-white">{result.accuracy}%</dd></div>
                <div><dt className="text-sm">Best</dt><dd className="text-white">{result.extreme ? result.best : best()}</dd></div>
              </dl>
            </>
          )}
          {graphics === 'extreme' && !ready
            ? <p className="data text-[#c9ced6]" role="status">Loading Extreme…</p>
            : <button type="button" ref={phase === 'menu' ? undefined : focusOnMount} className="btn btn-signal" onClick={() => (phase === 'paused' ? api.current.resume() : api.current.start())}>
              {phase === 'menu' ? 'Take off' : phase === 'paused' ? 'Resume' : 'Fly again'}
            </button>}
          {phase !== 'menu' && <button type="button" className="btn btn-sm border-white/60 text-white hover:bg-white hover:text-[#0b0d12]" onClick={() => api.current.leave()}>Leave the game</button>}
          <div role="group" aria-label="Graphics" className="flex flex-wrap items-center justify-center gap-2">
            <span className="data text-[#c9ced6]">Graphics</span>
            {[['base', 'Base'], ['extreme', 'Extreme']].map(([v, label]) => (
              <button key={v} type="button" aria-pressed={graphics === v} onClick={() => graphics !== v && choose(v)}
                className={`btn btn-sm ${graphics === v ? 'bg-white text-[#0b0d12] border-white' : 'border-white/60 text-white hover:bg-white hover:text-[#0b0d12]'}`}>{label}</button>
            ))}
          </div>
          {phase === 'paused' && <p className="text-sm text-[#c9ced6]">Switching graphics starts a new sortie.</p>}
          {note && <p className="max-w-sm text-sm text-[#ffcf6b]" role="status">{note}</p>}
        </div>
      )}
    </div>
  );
}
