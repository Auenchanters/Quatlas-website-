import { onSoundChange, soundOn } from '../lib/sound';

// Game sound, synthesised with Web Audio: nothing to download. Respects the site's sound toggle.
// One AudioContext per game screen: create on the first press (browsers only allow audio after a gesture),
// close() on the way out.
// Runs fn at most once every ms milliseconds (a hit sound per bullet would be a wall of static).
const limit = (fn, ms) => { let last = 0; return () => { const t = performance.now(); if (t - last >= ms) { last = t; fn(); } }; };

export function createAudio({ limiter: limited = false } = {}) {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = soundOn() ? 0.5 : 0;
  // Dogfight adds a limiter on the way out: guns, hits and explosions stacking up get held down, never clip.
  if (limited) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.knee.value = 8; limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
  } else master.connect(ctx.destination);
  const off = onSoundChange((on) => master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05));

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const now = () => ctx.currentTime;
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const tone = (freq, { type = 'sine', at = 0, a = 0.005, d = 0.2, peak = 0.3, to } = {}) => {
    const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    env(g, t, a, peak, d);
    o.connect(g).connect(master); o.start(t); o.stop(t + a + d + 0.05);
  };
  const burst = ({ at = 0, d = 0.3, peak = 0.5, freq = 1200, q = 0.7, type = 'lowpass', sweep } = {}) => {
    const t = now() + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + d);
    env(g, t, 0.004, peak, d);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + d + 0.05);
  };

  // A jet: a low rumble of filtered noise, a soft body tone and a faint turbine whine, all rising with throttle.
  function jet({ base = 70 } = {}) {
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noise; n.loop = true; lp.type = 'lowpass'; lp.Q.value = 0.4; ng.gain.value = 0;
    n.connect(lp).connect(ng).connect(master);
    const body = ctx.createOscillator(), bg = ctx.createGain(); body.type = 'sine'; bg.gain.value = 0;
    body.connect(bg).connect(master);
    const whine = ctx.createOscillator(), wg = ctx.createGain(); whine.type = 'sine'; wg.gain.value = 0;
    whine.connect(wg).connect(master);
    n.start(); body.start(); whine.start();
    let last = -1;
    return {
      set(level, on = true) {
        const v = on ? level : -1;
        if (Math.abs(v - last) < 0.01) return; // per-frame calls only move the sound when the throttle does
        last = v;
        const t = now(), k = on ? 1 : 0;
        lp.frequency.setTargetAtTime(260 + level * 520, t, 0.15);
        ng.gain.setTargetAtTime(k * (0.16 + level * 0.14), t, 0.15);
        body.frequency.setTargetAtTime(base * (1 + level * 0.5), t, 0.2);
        bg.gain.setTargetAtTime(k * 0.06, t, 0.15);
        whine.frequency.setTargetAtTime(base * 14 * (1 + level * 0.45), t, 0.25);
        wg.gain.setTargetAtTime(k * (0.004 + level * 0.008), t, 0.2);
      },
      stop() { try { n.stop(); body.stop(); whine.stop(); } catch { /* already stopped */ } },
    };
  }

  // A continuous motor: a buzzy oscillator plus filtered noise for the prop or jet wash.
  function engine({ base = 90, kind = 'prop' } = {}) {
    if (kind === 'jet') return jet({ base });
    const o = ctx.createOscillator(), og = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = kind === 'jet' ? 'triangle' : 'sawtooth';
    lp.type = 'lowpass'; lp.frequency.value = kind === 'jet' ? 500 : 900;
    og.gain.value = 0;
    o.connect(lp).connect(og).connect(master);
    const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noise; n.loop = true; nf.type = 'bandpass'; nf.frequency.value = kind === 'jet' ? 700 : 1800; nf.Q.value = 0.8;
    ng.gain.value = 0;
    n.connect(nf).connect(ng).connect(master);
    o.start(); n.start();
    return {
      // level 0..1 (throttle or climb).
      set(level, on = true) {
        const t = now(), k = on ? 1 : 0;
        o.frequency.setTargetAtTime(base * (1 + level * 0.9), t, 0.08);
        nf.frequency.setTargetAtTime((kind === 'jet' ? 500 : 1400) + level * 1500, t, 0.1);
        og.gain.setTargetAtTime(k * (0.05 + level * 0.06), t, 0.08);
        ng.gain.setTargetAtTime(k * (kind === 'jet' ? 0.08 + level * 0.12 : 0.02 + level * 0.03), t, 0.08);
      },
      stop() { try { o.stop(); n.stop(); } catch { /* already stopped */ } },
    };
  }

  // A slow two-chord pad under the fight. Returns stop().
  function music() {
    let alive = true, bar = 0;
    const chords = [[110, 164.8, 220], [98, 146.8, 196], [87.3, 130.8, 174.6], [98, 146.8, 196]];
    const play = () => {
      if (!alive) return;
      for (const f of chords[bar++ % chords.length]) tone(f, { type: 'triangle', a: 0.6, d: 2.6, peak: 0.035 });
      tone(chords[(bar - 1) % 4][0] / 2, { type: 'sine', a: 0.05, d: 0.5, peak: 0.08 });
      setTimeout(play, 3000);
    };
    play();
    return () => { alive = false; };
  }

  return {
    ctx,
    resume: () => ctx.state === 'suspended' && ctx.resume(),
    engine,
    music,
    pickup: () => { tone(880, { d: 0.12, peak: 0.2 }); tone(1320, { at: 0.06, d: 0.18, peak: 0.18 }); },
    charge: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.05, d: 0.12, peak: 0.12, type: 'triangle' })),
    crash: () => { burst({ d: 0.9, peak: 0.7, freq: 2500, sweep: 120 }); tone(70, { d: 0.6, peak: 0.6, to: 35 }); },
    gun: () => { burst({ d: 0.05, peak: 0.25, freq: 2200, type: 'bandpass', q: 1.2 }); tone(160, { d: 0.04, peak: 0.12, type: 'square', to: 80 }); },
    hit: () => burst({ d: 0.08, peak: 0.35, freq: 3500, type: 'highpass' }),
    explode: (dist = 0) => { const k = Math.max(0.15, 1 - dist / 2500); burst({ d: 1.4, peak: 0.8 * k, freq: 1800, sweep: 80 }); tone(55, { d: 1, peak: 0.7 * k, to: 28 }); },
    missile: () => burst({ d: 1.1, peak: 0.3, freq: 600, sweep: 3000, type: 'bandpass', q: 2 }),
    lock: () => tone(1046, { type: 'square', d: 0.06, peak: 0.06 }),
    warn: () => { tone(740, { type: 'square', d: 0.12, peak: 0.07 }); tone(554, { type: 'square', at: 0.16, d: 0.12, peak: 0.07 }); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.11, d: 0.4, peak: 0.12, type: 'triangle' })),
    close() { off(); ctx.close(); },
    // Dogfight's combat sounds: rounded thumps instead of raw noise, and rate-limited where they repeat fast.
    cannon: () => { burst({ d: 0.07, peak: 0.28, freq: 1400, sweep: 260 }); tone(120, { d: 0.06, peak: 0.16, to: 60 }); },
    struck: limit(() => { burst({ d: 0.12, peak: 0.3, freq: 900, sweep: 200 }); tone(240, { type: 'triangle', d: 0.08, peak: 0.08, to: 140 }); }, 90),
    tick: () => tone(1320, { d: 0.05, peak: 0.035 }),
    alarm: () => { tone(740, { type: 'triangle', d: 0.14, peak: 0.09 }); tone(554, { type: 'triangle', at: 0.18, d: 0.14, peak: 0.09 }); },
  };
}
