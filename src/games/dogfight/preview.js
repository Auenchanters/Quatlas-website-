// The Dogfight card's preview: a scripted 2D skirmish on a canvas, since the game itself is 3D and too heavy
// to idle on a card. Jets weave and trade gunfire and missiles; flares pull most missiles off their target.
const W = 640, H = 360, SPEED = 170; // the world streams left at SPEED px/s
const JET = new Path2D('M0 0 L84 -7 L92 0 L84 7Z M28 0 L48 -36 L58 -36 L52 0Z M28 0 L48 36 L58 36 L52 0Z M2 0 L-6 -16 L8 -16 L16 0Z');
const CANOPY = new Path2D('M58 -3 L76 -4 L76 4 L58 3Z');
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mod = (v, m) => ((v % m) + m) % m;
const ridge = (x, s) => 22 * Math.sin(x * 0.011 + s) + 13 * Math.sin(x * 0.027 + s * 2) + 6 * Math.sin(x * 0.063);
const prune = (arr, keep) => { let n = 0; for (const o of arr) if (keep(o)) arr[n++] = o; arr.length = n; };

export function createPreview(el, still) {
  const k = Math.min(3, (devicePixelRatio || 1) * Math.max(1, el.clientWidth / W));
  el.width = Math.round(W * k); el.height = Math.round(H * k);
  const ctx = el.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d2a4a'); sky.addColorStop(0.62, '#ff8a5c'); sky.addColorStop(1, '#ffc58a');
  const sun = ctx.createRadialGradient(470, 250, 0, 470, 250, 220);
  sun.addColorStop(0, 'rgba(255,236,190,0.55)'); sun.addColorStop(1, 'rgba(255,170,110,0)');

  let t = 0, scroll = 0, last = 0, volley = 3.2;
  const bullets = [], missiles = [], flares = [], parts = [];
  const route = (cx, cy, ax, ay, fx, fy, ph) => (u) => [cx + ax * Math.sin(u * fx + ph), cy + ay * Math.sin(u * fy + ph * 1.7)];
  const jet = (o) => {
    const j = { a: 0, vx: 0, vy: 0, hp: 4, flareCd: 0, flareIn: 0, gunCd: 0.4, burst: 0, shot: 0, lock: 0, missileCd: 1.2, enter: 0, down: false, gone: 0, ...o };
    [j.x, j.y] = j.path(0);
    return j;
  };
  const me = jet({ me: true, color: '#c41e2c', size: 0.6, path: route(150, 185, 40, 70, 0.8, 1.3, 0) });
  const foes = [
    jet({ color: '#26303f', size: 0.4, path: route(470, 105, 60, 45, 1.1, 1.6, 1) }),
    jet({ color: '#26303f', size: 0.36, path: route(545, 205, 45, 60, 0.9, 1.4, 2.4) }),
    jet({ color: '#26303f', size: 0.32, path: route(400, 255, 55, 35, 1.3, 1.1, 4) }),
  ];
  const jets = [me, ...foes];
  const ready = (j) => !j.down && !j.gone && Math.abs(j.enter) < 40;
  const alive = (o) => (o.path ? !o.down && !o.gone : o.age < o.life);
  const at = (j, d) => [j.x + Math.cos(j.a) * d * j.size, j.y + Math.sin(j.a) * d * j.size];
  const puff = (p) => { if (parts.length < 700) parts.push({ grow: 0, ...p, max: p.life }); };

  function explode(x, y, s) {
    puff({ kind: 'ring', x, y, vx: -SPEED * 0.5, vy: 0, r: 4, grow: 150 * s, life: 0.3 });
    for (let i = 0; i < 14 * s; i++) {
      const a = rnd(0, 7), v = rnd(20, 140) * s;
      puff({ kind: 'fire', x, y, vx: Math.cos(a) * v - SPEED * 0.5, vy: Math.sin(a) * v, r: rnd(4, 9) * s, grow: 10, life: rnd(0.3, 0.8) });
      puff({ kind: 'smoke', x, y, vx: Math.cos(a) * v * 0.4 - SPEED * 0.6, vy: Math.sin(a) * v * 0.4 - 10, r: rnd(4, 8) * s, grow: 14, life: rnd(0.8, 1.6) });
      puff({ kind: 'spark', x, y, vx: Math.cos(a) * v * 2.5, vy: Math.sin(a) * v * 2.5, r: 1, life: rnd(0.2, 0.5) });
    }
  }

  function kill(j) { j.down = true; j.hp = 0; explode(j.x, j.y, 1.3); }

  function fire(from, tgt) {
    const [x, y] = at(from, 46), lead = Math.hypot(tgt.x - x, tgt.y - y) / 900;
    const a = Math.atan2(tgt.y + tgt.vy * lead - y, tgt.x + tgt.vx * lead - x) + rnd(-0.05, 0.05);
    bullets.push({ x, y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.5, from });
  }

  function launch(from, tgt) {
    const [x, y] = at(from, 20);
    missiles.push({ x, y, a: from.a, v: 220, age: 0, tgt, decoyed: false });
    // The target answers with flares: the player always, the enemy jets most of the time.
    if (tgt.flareCd <= 0 && (tgt.me || Math.random() < 0.65)) tgt.flareIn = 0.3;
  }

  function popFlares(j) {
    for (let i = 0; i < 8; i++) flares.push({ from: j, wait: i * 0.07 + 0.001, side: i % 2 ? 1 : -1, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: rnd(2, 2.8) });
  }

  function step(dt) {
    t += dt; scroll += SPEED * dt;
    for (const j of jets) {
      if (j.gone) {
        if ((j.gone -= dt) > 0) continue;
        Object.assign(j, { gone: 0, down: false, hp: 4, enter: (Math.random() < 0.5 ? -1 : 1) * 220 });
        [j.x, j.y] = j.path(t); j.y += j.enter;
      }
      if (j.down) {
        j.vx -= 60 * dt; j.vy += 160 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.a += 2.2 * dt;
        puff({ kind: 'fire', x: j.x, y: j.y, vx: -SPEED * 0.6, vy: -10, r: rnd(3, 6), grow: 8, life: rnd(0.2, 0.4) });
        puff({ kind: 'smoke', x: j.x, y: j.y, vx: -SPEED * 0.8, vy: -15, r: rnd(3, 5), grow: 16, life: rnd(1, 1.6) });
        if (j.y > H + 40) j.gone = rnd(1.2, 2.4);
        continue;
      }
      const [nx, ny] = j.path(t);
      j.enter *= Math.exp(-dt * 1.6);
      j.vx = (nx - j.x) / dt; j.vy = (ny + j.enter - j.y) / dt; j.x = nx; j.y = ny + j.enter;
      j.a += wrap(Math.atan2(j.vy, j.vx + SPEED) - j.a) * Math.min(1, dt * 6);
      j.flareCd -= dt;
      if (j.flareIn > 0 && (j.flareIn -= dt) <= 0) { popFlares(j); j.flareCd = 4; }
      if (!j.me && j.hp <= 2 && Math.random() < 0.5) { const [x, y] = at(j, -40); puff({ kind: 'smoke', x, y, vx: -SPEED, vy: -8, r: 2, grow: 12, life: 1 }); }
    }

    const target = foes.filter(ready).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    me.target = target;
    if (target) {
      if ((me.gunCd -= dt) <= 0 && me.burst <= 0) { me.burst = rnd(0.35, 0.6); me.gunCd = rnd(1, 1.8); }
      if (me.burst > 0) { me.burst -= dt; if ((me.shot -= dt) <= 0) { me.shot = 0.045; fire(me, target); } }
      if (me.lock > 0) { if ((me.lock -= dt) <= 0) { launch(me, target); me.missileCd = rnd(2.2, 3.2); } }
      else if ((me.missileCd -= dt) <= 0) me.lock = 0.6;
    }
    // One enemy missile at a time, spaced wider than the player's flare cooldown so the player always has flares.
    if ((volley -= dt) <= 0) {
      const shooters = foes.filter(ready);
      if (shooters.length) launch(shooters[Math.floor(Math.random() * shooters.length)], me);
      volley = rnd(4.5, 6.5);
    }

    for (const f of flares) {
      if (f.wait > 0) {
        if ((f.wait -= dt) > 0) continue;
        const [x, y] = at(f.from, -40), b = f.from.a + Math.PI + f.side * rnd(0.5, 1.2), v = rnd(60, 110);
        Object.assign(f, { x, y, vx: Math.cos(b) * v - SPEED * 0.5, vy: Math.sin(b) * v });
      }
      f.age += dt;
      f.vx += (-SPEED - f.vx) * dt * 0.9; f.vy += (55 - f.vy) * dt * 0.9;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (Math.random() < 0.6) puff({ kind: 'smoke', x: f.x, y: f.y, vx: -SPEED, vy: -6, r: 1.5, grow: 9, life: 0.9 });
    }

    for (const m of missiles) {
      m.age += dt; m.v = Math.min(520, m.v + 400 * dt);
      if (!m.decoyed && m.tgt.path) {
        const f = flares.find((f) => f.from === m.tgt && f.wait <= 0 && f.age < 1);
        if (f) { m.tgt = f; m.decoyed = true; }
      }
      if (alive(m.tgt)) {
        const d = Math.hypot(m.tgt.x - m.x, m.tgt.y - m.y);
        if (d < (m.tgt.path ? 26 * m.tgt.size : 8)) {
          m.dead = true;
          if (m.tgt.path && !m.tgt.me) kill(m.tgt);
          else explode(m.x, m.y, 0.7);
          continue;
        }
        m.a += Math.max(-3.5 * dt, Math.min(3.5 * dt, wrap(Math.atan2(m.tgt.y - m.y, m.tgt.x - m.x) - m.a)));
      }
      m.x += Math.cos(m.a) * m.v * dt; m.y += Math.sin(m.a) * m.v * dt;
      puff({ kind: 'smoke', x: m.x, y: m.y, vx: -SPEED * 0.8, vy: 0, r: 2, grow: 10, life: 0.9 });
      if (m.age > 3.5) { m.dead = true; explode(m.x, m.y, 0.5); }
    }

    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const f of foes) {
        if (b.from === f || !ready(f) || Math.hypot(f.x - b.x, f.y - b.y) > 26 * f.size) continue;
        b.life = 0;
        for (let i = 0; i < 4; i++) puff({ kind: 'spark', x: b.x, y: b.y, vx: rnd(-200, 200), vy: rnd(-200, 200), r: 1, life: 0.2 });
        if (--f.hp <= 0) kill(f);
      }
    }

    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt; }
    prune(parts, (p) => p.life > 0);
    prune(bullets, (b) => b.life > 0);
    prune(flares, (f) => f.wait > 0 || f.age < f.life);
    prune(missiles, (m) => !m.dead);
  }

  function ridgeLayer(off, base, color, s) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base - ridge(x + off, s));
    ctx.lineTo(W, H); ctx.fill();
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, 7); ctx.fill(); }

  function drawJet(j) {
    ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.a); ctx.scale(j.size, j.size); ctx.translate(-46, 0);
    if (!j.down) { // afterburner
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,70,0.9)';
      ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(-14 - Math.random() * 14, 0); ctx.lineTo(2, 5); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = j.color; ctx.fill(JET);
    if (j.me) { ctx.fillStyle = '#8fd3ff'; ctx.fill(CANOPY); }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,214,180,0.16)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(mod(i * 173 - scroll * 0.6, W + 200) - 100, 40 + (i * 53) % 150, 60, 8, 0, 0, 7); ctx.fill(); }
    ridgeLayer(scroll * 0.12, 250, '#3a3f5c', 1);
    ridgeLayer(scroll * 0.3, 292, '#1d2a3d', 4);
    ctx.fillStyle = '#14324a'; ctx.fillRect(0, 318, W, H - 318);
    ctx.strokeStyle = 'rgba(255,197,138,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 14; i++) { const x = mod(i * 97 - scroll * 1.2, W + 40) - 20, y = 324 + (i * 7) % 32; ctx.moveTo(x, y); ctx.lineTo(x + 14, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const x = mod(i * 131 - scroll * 2.2, W + 80) - 40, y = 20 + (i * 67) % 280; ctx.moveTo(x, y); ctx.lineTo(x + 40, y); }
    ctx.stroke();

    ctx.fillStyle = 'rgb(70,72,84)';
    for (const p of parts) if (p.kind === 'smoke') { ctx.globalAlpha = 0.45 * p.life / p.max; circle(p.x, p.y, p.r); }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (const b of bullets) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); }
    ctx.stroke();
    for (const m of missiles) {
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
      ctx.fillStyle = '#e8ecf2'; ctx.fillRect(-7, -1.5, 14, 3);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-13 - Math.random() * 6, 0); ctx.lineTo(-7, 2); ctx.fill();
      ctx.restore();
    }
    for (const j of jets) if (!j.gone) drawJet(j);

    ctx.globalCompositeOperation = 'lighter';
    for (const f of flares) {
      if (f.wait > 0) continue;
      const fade = Math.min(1, (f.life - f.age) * 2), r = (9 + Math.random() * 5) * fade;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1, r));
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, 'rgba(255,220,140,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; circle(f.x, f.y, r);
    }
    for (const p of parts) {
      const a = p.life / p.max;
      if (p.kind === 'fire') { ctx.fillStyle = `rgba(255,${Math.round(90 + 120 * a)},40,${a})`; circle(p.x, p.y, p.r); }
      else if (p.kind === 'spark') { ctx.fillStyle = `rgba(255,230,150,${a})`; circle(p.x, p.y, 1.2); }
      else if (p.kind === 'ring') { ctx.strokeStyle = `rgba(255,240,210,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';

    const tg = me.target;
    if (tg && ready(tg)) {
      const locked = me.lock > 0, r = locked ? 11 + me.lock * 22 : 16;
      ctx.strokeStyle = locked ? '#ff4757' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, r, 0, 7);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { ctx.moveTo(tg.x + dx * r, tg.y + dy * r); ctx.lineTo(tg.x + dx * (r + 6), tg.y + dy * (r + 6)); }
      ctx.stroke();
      if (locked) { ctx.fillStyle = '#ff4757'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('LOCK', tg.x + r + 8, tg.y - r); }
    }
  }

  // Start a moment in so the first frame already has something in the air; a still frame shows flares out.
  for (let i = 0; i < (still ? 165 : 60); i++) step(1 / 60);
  return (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!still && dt) step(dt);
    draw();
  };
}
