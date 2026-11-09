// Dogfight's heads-up display, drawn every frame on a 2D canvas laid over the 3D view.
const GREEN = '#8dffb4', RED = '#ff5a66', AMBER = '#ffcf6b', WHITE = 'rgba(255,255,255,0.9)';

function text(ctx, s, x, y, { size = 13, color = WHITE, align = 'left', weight = 600 } = {}) {
  ctx.font = `${weight} ${size}px "IBM Plex Mono", monospace`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(s, x, y);
}
const km = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`);

export function drawHud(ctx, w, h, d) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1.5; ctx.textBaseline = 'middle';
  const k = Math.max(0.75, Math.min(1.2, w / 1100));
  // Extreme: inside a cloud the view whites out (the HUD stays readable on top).
  if (d.whiteout) { ctx.fillStyle = `rgba(${d.whiteoutRGB ?? '232,237,242'},${d.whiteout})`; ctx.fillRect(0, 0, w, h); }
  // Extreme's sky is bright: a soft dark edge keeps the HUD readable over it.
  ctx.shadowColor = d.wave ? 'rgba(0,0,0,0.6)' : 'transparent'; ctx.shadowBlur = d.wave ? 4 : 0;

  // Where the guns point, and where the mouse is asking the plane to go.
  if (d.boresight) {
    const { x, y } = d.boresight; ctx.strokeStyle = GREEN;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.moveTo(x - 18, y); ctx.lineTo(x - 9, y); ctx.moveTo(x + 9, y); ctx.lineTo(x + 18, y); ctx.moveTo(x, y + 9); ctx.lineTo(x, y + 16); ctx.stroke();
  }
  if (d.aim) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(d.aim.x, d.aim.y, 13, 0, 7); ctx.stroke(); ctx.fillStyle = WHITE; ctx.fillRect(d.aim.x - 1, d.aim.y - 1, 2, 2); }

  // Enemies: a diamond with range and health on screen, an arrow on the edge when off it.
  // Bunched up (as at the start), only the nearest of overlapping ones gets its range and health tag.
  const tags = [];
  for (const e of [...d.enemies].sort((a, b) => a.dist - b.dist)) {
    if (e.on) {
      const s = 9;
      ctx.strokeStyle = e.locked ? AMBER : RED;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - s); ctx.lineTo(e.x + s, e.y); ctx.lineTo(e.x, e.y + s); ctx.lineTo(e.x - s, e.y); ctx.closePath(); ctx.stroke();
      const tag = { x: e.x + 12, y: e.y - 14, w: 56 * k, h: 24 };
      if (tags.some((t) => tag.x < t.x + t.w && t.x < tag.x + tag.w && tag.y < t.y + t.h && t.y < tag.y + tag.h)) continue;
      tags.push(tag);
      text(ctx, km(e.dist), e.x + 14, e.y - 6, { size: 11 * k, color: e.locked ? AMBER : RED });
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(e.x + 14, e.y + 4, 34, 3);
      ctx.fillStyle = RED; ctx.fillRect(e.x + 14, e.y + 4, 34 * Math.max(0, e.hp), 3);
    } else {
      const cx = w / 2, cy = h / 2, a = Math.atan2(e.y - cy, e.x - cx), r = Math.min(w, h) / 2 - 28;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = RED;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  if (d.lead) { ctx.strokeStyle = AMBER; ctx.beginPath(); ctx.arc(d.lead.x, d.lead.y, 5, 0, 7); ctx.stroke(); ctx.fillStyle = AMBER; ctx.fillRect(d.lead.x - 1, d.lead.y - 1, 2, 2); }

  // Missile lock: a box that closes in on the target, then holds.
  if (d.lock) {
    const { x, y, p, locked } = d.lock, s = 34 - 16 * Math.min(1, p);
    ctx.strokeStyle = locked ? AMBER : 'rgba(255,207,107,0.6)'; ctx.lineWidth = locked ? 2.5 : 1.5;
    ctx.strokeRect(x - s, y - s, s * 2, s * 2); ctx.lineWidth = 1.5;
    if (locked) text(ctx, 'LOCK', x, y + s + 12, { size: 12 * k, color: AMBER, align: 'center', weight: 700 });
  }

  // Top: kills and time (Extreme: the wave, who's left, and how many are hiding).
  if (d.wave) {
    text(ctx, `WAVE ${d.wave.n}`, w / 2, 26, { size: 15 * k, align: 'center', weight: 700 });
    text(ctx, `${d.wave.left} LEFT${d.wave.hidden ? `  ·  ${d.wave.hidden} HIDDEN` : ''}  ·  ${d.kills} DOWN  ·  ${d.time}`, w / 2, 46, { size: 11 * k, align: 'center', color: 'rgba(255,255,255,0.75)' });
  } else {
    text(ctx, `${d.kills} / 4  DOWN`, w / 2, 26, { size: 15 * k, align: 'center', weight: 700 });
    text(ctx, d.time, w / 2, 46, { size: 11 * k, align: 'center', color: 'rgba(255,255,255,0.7)' });
  }
  if (d.banner?.a > 0) {
    ctx.globalAlpha = d.banner.a;
    text(ctx, d.banner.title, w / 2, h * 0.22 + d.banner.slide, { size: 34 * k, align: 'center', weight: 700 });
    text(ctx, d.banner.sub, w / 2, h * 0.22 + 34 * k + d.banner.slide, { size: 14 * k, align: 'center', color: AMBER });
    ctx.globalAlpha = 1;
  }

  // Sides: speed and altitude.
  for (const [x, label, v, align] of [[30, 'SPD', `${Math.round(d.speed * 3.6)} km/h`, 'left'], [w - 30, 'ALT', `${Math.round(d.alt)} m`, 'right']]) {
    text(ctx, label, x, h / 2 - 12, { size: 10 * k, align, color: 'rgba(255,255,255,0.6)' });
    text(ctx, v, x, h / 2 + 6, { size: 15 * k, align, color: GREEN });
  }
  text(ctx, `THR ${Math.round(d.throttle * 100)}%`, 30, h / 2 + 28, { size: 11 * k, color: 'rgba(255,255,255,0.7)' });

  // Bottom: health, guns, missiles.
  // On a touch screen the stick and fire buttons fill the bottom 150 px: the bar sits above them.
  const bw = 220 * k, bx = w / 2 - bw / 2, by = d.touch ? h - 175 : h - 40;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = d.hp < 0.3 ? RED : d.hp < 0.6 ? AMBER : GREEN; ctx.fillRect(bx, by, bw * Math.max(0, d.hp), 8);
  text(ctx, `GUN ${d.ammo}`, bx, by - 12, { size: 11 * k });
  text(ctx, `MSL ${'▮'.repeat(d.missiles)}${'▯'.repeat(4 - d.missiles)}`, bx + bw, by - 12, { size: 11 * k, align: 'right' });
  if (d.flares != null) text(ctx, `FLR ${d.flares}`, bx + bw / 2, by - 12, { size: 11 * k, align: 'center', color: d.flares ? WHITE : RED });
  if (d.notice?.a > 0) { ctx.globalAlpha = d.notice.a; text(ctx, d.notice.text, w / 2, by - 40, { size: 14 * k, align: 'center', color: AMBER, weight: 700 }); ctx.globalAlpha = 1; }

  // Radar, bottom left (top left on a touch screen, clear of the stick): you at the centre, nose up.
  const R = 62 * k, rx = 24 + R, ry = d.touch ? 24 + R : h - 24 - R;
  ctx.fillStyle = 'rgba(8,16,24,0.45)'; ctx.beginPath(); ctx.arc(rx, ry, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(141,255,180,0.35)'; ctx.beginPath(); ctx.arc(rx, ry, R, 0, 7); ctx.arc(rx, ry, R / 2, 0, 7); ctx.moveTo(rx - R, ry); ctx.lineTo(rx + R, ry); ctx.moveTo(rx, ry - R); ctx.lineTo(rx, ry + R); ctx.stroke();
  for (const b of d.radar) {
    const s = Math.min(1, Math.hypot(b.x, b.y) / 2500), a = Math.atan2(b.x, b.y);
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(rx + Math.sin(a) * s * R, ry - Math.cos(a) * s * R, 3, 0, 7); ctx.fill();
  }
  ctx.fillStyle = GREEN; ctx.beginPath(); ctx.moveTo(rx, ry - 6); ctx.lineTo(rx + 4, ry + 4); ctx.lineTo(rx - 4, ry + 4); ctx.closePath(); ctx.fill();

  // Warnings, centre, blinking.
  if (d.warnings.length && Math.floor(d.blink * 3) % 2 === 0) d.warnings.forEach((wn, i) => text(ctx, wn, w / 2, h * 0.3 + i * 22, { size: 16 * k, align: 'center', color: RED, weight: 700 }));

  // Damage: the edges flash red when you're hit.
  if (d.hurt > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,40,${0.45 * d.hurt})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
