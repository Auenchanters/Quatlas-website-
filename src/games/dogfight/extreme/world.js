import * as THREE from 'three/webgpu';
import { texture, uv, time, vec2, vec3, normalMap, instancedDynamicBufferAttribute, instancedBufferAttribute, uniform, attribute, cameraPosition, mod, min, vec4 } from 'three/tsl';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { heightAt, groundAt, ARENA } from '../logic.js';

// Dogfight Extreme's look, rendered with WebGPU and made entirely in code: every texture is painted
// here on a canvas. A physical sky, textured islands, a moving sea, clouds you can fly into, and
// detailed original jets with painted panels, lit by the sun and reflecting the sky.

export const SUN = new THREE.Vector3(0.45, 0.55, 0.7).normalize(); // high enough to stay out of the usual view
const FOG = '#b4c3d1';

// --- Procedural textures ----------------------------------------------------------------------------
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { repeat, srgb = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
};
// Smooth value noise, tileable over `period` cells.
function noise(seed = 1, period = 256) {
  const h = (x, y) => { x = ((x % period) + period) % period; y = ((y % period) + period) % period; let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = s(x - xi), v = s(y - yi);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
}
const fbm = (n, x, y, oct = 4) => { let a = 0, w = 0.5, f = 1; for (let i = 0; i < oct; i++) { a += n(x * f, y * f) * w; f *= 2; w /= 2; } return a / (1 - 0.5 ** oct); };

// The islands' colour, from height and slope: sand, two greens with forest patches, rock, snow.
function terrainTexture(size, span) {
  const [c, x] = canvas(size), img = x.createImageData(size, size), n = noise(3, 1 << 20), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
  const SAND = [214, 196, 146], GRASS = [104, 142, 70], FOREST = [52, 88, 46], ROCK = [122, 114, 102], SNOW = [238, 242, 246];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const wx = (i / size - 0.5) * span, wz = (j / size - 0.5) * span, h = heightAt(wx, wz);
    const slope = Math.hypot(heightAt(wx + 20, wz) - h, heightAt(wx, wz + 20) - h) / 20;
    const k = fbm(n, wx / 180, wz / 180, 3);
    let col = mix(GRASS, FOREST, (k - 0.45) * 5);
    col = mix(SAND, col, (h - 6 - k * 10) / 10);
    col = mix(col, ROCK, (slope - 0.55) * 3 + (h - 210 - k * 40) / 60);
    col = mix(col, SNOW, (h - 290 - k * 30) / 25);
    const o = (j * size + i) * 4, shade = 0.9 + k * 0.2;
    img.data.set([col[0] * shade, col[1] * shade, col[2] * shade, 255], o);
  }
  x.putImageData(img, 0, 0);
  return tex(c);
}
// Fine grain laid over the terrain colour, tiled.
function grainTexture() {
  const [c, x] = canvas(256), img = x.createImageData(256, 256), n = noise(9, 32), m = noise(11, 128);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const v = 150 + fbm(n, i / 8, j / 8, 3) * 70 + m(i / 2, j / 2) * 35; img.data.set([v, v, v, 255], (j * 256 + i) * 4); }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: true, srgb: false });
}
// Ripples: a tileable height field of crossing waves, turned into a normal map.
function waterNormals() {
  const S = 256, [c, x] = canvas(S), img = x.createImageData(S, S), n = noise(5, 16);
  const hgt = (i, j) => { const u = (i / S) * Math.PI * 2, v = (j / S) * Math.PI * 2; return Math.sin(u * 2 + v) * 0.25 + fbm(n, (i / S) * 16, (j / S) * 16, 4); };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = hgt(i + 1, j) - hgt(i - 1, j), dy = hgt(i, j + 1) - hgt(i, j - 1), l = Math.hypot(dx * 6, dy * 6, 1);
    img.data.set([(-dx * 6 / l * 0.5 + 0.5) * 255, (-dy * 6 / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (j * S + i) * 4);
  }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: true, srgb: false });
}
// A soft, lumpy puff for clouds and smoke.
function puffTexture() {
  const S = 128, [c, x] = canvas(S), img = x.createImageData(S, S), n = noise(7, 16);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = i / S - 0.5, dy = j / S - 0.5, r = Math.hypot(dx, dy) * 2;
    const a = Math.max(0, 1 - r * (0.75 + fbm(n, i / 12, j / 12, 3) * 0.5)) ** 1.6;
    img.data.set([255, 255, 255, a * 255], (j * S + i) * 4);
  }
  x.putImageData(img, 0, 0);
  return tex(c);
}
// The environment the metal reflects: sky above, a warm horizon, the sun, dark land below.
function envTexture() {
  const [c, x] = canvas(512, 256), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2c5c9c'); g.addColorStop(0.42, '#9fbbd6'); g.addColorStop(0.5, '#e8dccb'); g.addColorStop(0.52, '#6c7a64'); g.addColorStop(1, '#2a3328');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const sx = (0.5 + Math.atan2(SUN.x, SUN.z) / (2 * Math.PI)) * 512, sy = (0.5 - Math.asin(SUN.y) / Math.PI) * 256, s = x.createRadialGradient(sx, sy, 0, sx, sy, 40);
  s.addColorStop(0, 'rgba(255,248,230,1)'); s.addColorStop(1, 'rgba(255,230,190,0)');
  x.fillStyle = s; x.fillRect(0, 0, 512, 256);
  const t = tex(c); t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
// A jet's skin, wrapped round the fuselage: u goes round (top at 0.5), v runs tail (0) to nose (1).
function skinTexture({ base, accent, dark, code }) {
  const W = 512, H = 1024, [c, x] = canvas(W, H), n = noise(13, 64);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  const V = (v) => (1 - v) * H, U = (u) => u * W;
  // Livery: an accent nose, a stripe down the spine, chevrons by the cockpit, a dark anti-glare panel.
  x.fillStyle = accent; x.fillRect(0, V(1), W, V(0.9) - V(1));
  x.fillRect(U(0.47), V(0.72), U(0.06), V(0.12) - V(0.72));
  for (const u of [0.25, 0.75]) { x.beginPath(); x.moveTo(U(u - 0.07), V(0.66)); x.lineTo(U(u), V(0.7)); x.lineTo(U(u + 0.07), V(0.66)); x.lineTo(U(u + 0.07), V(0.63)); x.lineTo(U(u), V(0.67)); x.lineTo(U(u - 0.07), V(0.63)); x.fill(); }
  x.fillStyle = dark; x.fillRect(U(0.41), V(0.88), U(0.18), V(0.8) - V(0.88));
  // Panel lines, rivets and grime.
  x.strokeStyle = 'rgba(20,24,30,0.45)'; x.lineWidth = 1.5;
  for (const v of [0.08, 0.18, 0.3, 0.42, 0.55, 0.64, 0.78, 0.9]) { x.beginPath(); x.moveTo(0, V(v)); x.lineTo(W, V(v)); x.stroke(); }
  for (const u of [0.12, 0.25, 0.38, 0.62, 0.75, 0.88]) { x.beginPath(); x.moveTo(U(u), V(0.05)); x.lineTo(U(u), V(0.78)); x.stroke(); }
  x.fillStyle = 'rgba(20,24,30,0.35)';
  for (const v of [0.13, 0.36, 0.6]) for (let u = 0; u < 1; u += 0.012) x.fillRect(U(u), V(v), 1.5, 1.5);
  for (let i = 0; i < 2600; i++) { const px = Math.random() * W, py = Math.random() * H, k = n(px / 16, py / 16); x.fillStyle = `rgba(30,30,30,${0.05 * k})`; x.fillRect(px, py, 3, 6); }
  // The side number, running along each flank.
  x.fillStyle = dark; x.font = '700 44px "IBM Plex Mono", monospace'; x.textAlign = 'center';
  for (const [u, r] of [[0.25, -Math.PI / 2], [0.75, Math.PI / 2]]) { x.save(); x.translate(U(u), V(0.47)); x.rotate(r); x.fillText(code, 0, 14); x.restore(); }
  return tex(c);
}
// Panels for the flying surfaces, tiled (the extruded shapes' UVs are in metres).
function panelTexture() {
  const S = 256, [c, x] = canvas(S), n = noise(17, 32);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) { const px = Math.random() * S, py = Math.random() * S; x.fillStyle = `rgba(0,0,0,${0.06 * n(px / 8, py / 8)})`; x.fillRect(px, py, 4, 4); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.strokeRect(1, 1, S - 2, S - 2);
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
  x.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 6; i < S; i += 10) { x.fillRect(i, 5, 2, 2); x.fillRect(5, i, 2, 2); }
  return tex(c, { repeat: true });
}

// --- The world ------------------------------------------------------------------------------------
export function createWorld(clouds, { reduced }) {
  const scene = new THREE.Scene(), owned = [];
  const keep = (t) => (owned.push(t), t);
  scene.fog = new THREE.Fog(FOG, 2200, 9500);
  scene.environment = keep(envTexture());
  scene.environmentIntensity = 0.75;

  // The sky box rides with the camera and draws first (it writes no depth), so distant land shows over it.
  const sky = new SkyMesh();
  sky.scale.setScalar(10000); sky.renderOrder = -1; sky.frustumCulled = false;
  // A softer sun: a dimmed disc and a tighter, weaker halo, so looking toward it doesn't blind you.
  sky.turbidity.value = 2; sky.rayleigh.value = 1.1; sky.mieCoefficient.value = 0.0015; sky.mieDirectionalG.value = 0.76;
  sky.showSunDisc.value = 0.2;
  // A deeper sky, kept under the bloom threshold: the sun stays bright but never blooms into a white-out.
  sky.material.colorNode = min(sky.material.colorNode.mul(0.6), vec4(0.92, 0.92, 0.92, 1));
  sky.cloudCoverage.value = 0.22; sky.cloudDensity.value = 0.3;
  sky.sunPosition.value.copy(SUN).multiplyScalar(400000);
  sky.material.fog = false;
  scene.add(sky);

  // Islands: smooth-shaded, painted from the height map, with fine grain on top.
  const span = ARENA * 2.6, tg = new THREE.PlaneGeometry(span, span, 220, 220).rotateX(-Math.PI / 2), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  const tmat = new THREE.MeshStandardNodeMaterial({ roughness: 0.93 });
  const colour = keep(terrainTexture(512, span)), grain = keep(grainTexture());
  tmat.colorNode = texture(colour).rgb.mul(texture(grain, uv().mul(140)).r.mul(0.7).add(0.48)).mul(texture(grain, uv().mul(23)).r.mul(0.4).add(0.72));
  const land = new THREE.Mesh(tg, tmat); land.receiveShadow = true;
  scene.add(land);

  // The sea: glossy, rippling, reflecting the sky.
  const smat = new THREE.MeshStandardNodeMaterial({ color: '#0d4f73', roughness: 0.22, metalness: 0.05 });
  const ripples = keep(waterNormals()), drift = reduced ? vec2(0, 0) : vec2(time.mul(0.004), time.mul(0.0025));
  // Two scales of ripple, crossing, so no tile repeats visibly from altitude.
  const ripple = texture(ripples, uv().mul(210).add(drift)).add(texture(ripples, uv().mul(67).sub(drift.mul(0.7)).yx)).mul(0.5);
  const seaWaves = uniform(0.18); // rougher in rain and storms
  smat.normalNode = normalMap(ripple, vec2(seaWaves, seaWaves));
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), smat);
  scene.add(sea);

  // Light: the low sun (casting shadows on and between the jets near the camera) and the sky's fill.
  const sun = new THREE.DirectionalLight('#fff0da', 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 500 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const hemi = new THREE.HemisphereLight('#cfe0f5', '#46523f', 0.55);
  // Lightning's light, from high above; always in the scene (at 0) so a strike never recompiles shaders.
  const flashLight = new THREE.DirectionalLight('#dfe6ff', 0);
  flashLight.position.set(0.2, 1, 0.1);
  scene.add(sun, sun.target, hemi, flashLight);

  const cloudTint = uniform(1);
  scene.add(createClouds(clouds, keep, cloudTint));
  const stars = createStars(), rain = createRain(), bolt = createBolt();
  scene.add(stars, rain.mesh, bolt.line);

  let a = null, flash = 0, flashLen = 1;
  const bg = new THREE.Color(), lit = new THREE.Color('#c9d2e2');
  const apply = () => {
    const k = flash * (reduced ? 0.3 : 1); // gentler flashes with reduced motion
    bg.set(a.background).lerp(lit, k * 0.55);
    scene.background = a.sky && !k ? null : bg;
    sky.visible = a.sky && !k;
    scene.fog.color.copy(bg);
    hemi.intensity = a.hemi + k * 1.6;
    flashLight.intensity = k * 5;
  };
  return {
    scene, sun,
    // Time of day and weather (see atmosphere.js): sky, fog, light, clouds, stars, sea and rain.
    setAtmosphere(next) {
      a = next;
      scene.fog.near = a.fog[0]; scene.fog.far = a.fog[1];
      sun.intensity = a.sun; sun.color.set(a.sunColor);
      scene.environmentIntensity = a.env;
      cloudTint.value = a.clouds; seaWaves.value = a.waves; smat.roughness = a.weather === 'clear' ? 0.22 : 0.5;
      stars.visible = a.stars;
      rain.set(a.rain, a.time === 'night');
      apply();
    },
    // Lightning somewhere 1.5–4.5 km from p; returns how far away it struck.
    strike(p) {
      const ang = Math.random() * Math.PI * 2, d = 1500 + Math.random() * 3000;
      const x = p.x + Math.sin(ang) * d, z = p.z + Math.cos(ang) * d;
      bolt.draw(x, z);
      flash = 1; flashLen = 0.45;
      return Math.hypot(x - p.x, z - p.z);
    },
    update(dt, cam, vel) {
      rain.update(dt, vel);
      stars.position.copy(cam);
      if (flash > 0) {
        flash = Math.max(0, flash - dt / flashLen);
        // A strike flickers: bright, dim, bright again, then gone (one smooth fade with reduced motion).
        const t = 1 - flash, k = reduced ? flash : flash * (t < 0.15 || (t > 0.3 && t < 0.5) ? 1 : 0.25);
        bolt.line.visible = flash > 0.35;
        const keep = flash; flash = k; apply(); flash = keep;
        if (!flash) apply();
      }
    },
    follow(p, cam) { sun.position.copy(p).addScaledVector(SUN, 250); sun.target.position.copy(p); sky.position.copy(cam); },
    dispose() { owned.forEach((t) => t.dispose()); },
  };
}

// Stars for clear nights: 1-pixel points on a dome that rides with the camera.
function createStars() {
  const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = Math.random() * 0.98 + 0.02, r = Math.sqrt(1 - y * y), a = Math.random() * Math.PI * 2, b = 0.3 + Math.random() ** 3 * 0.7;
    pos.set([Math.cos(a) * r * 8000, y * 8000, Math.sin(a) * r * 8000], i * 3); col.set([b, b, b * 1.05], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsNodeMaterial({ vertexColors: true, fog: false, depthWrite: false }));
  p.frustumCulled = false; p.visible = false; p.renderOrder = -1;
  return p;
}

// Rain: streaks fixed in the world, falling, wrapped in a box round the camera on the GPU. Each
// streak points along the rain's motion relative to the jet, so at speed it comes at you.
function createRain() {
  const n = 2600, box = 240, seed = new Float32Array(n * 6), tip = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const s = [Math.random(), Math.random(), Math.random()]; seed.set([...s, ...s], i * 6); tip[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
  const fall = uniform(0), streak = uniform(new THREE.Vector3()), shade = uniform(new THREE.Color('#c4ccd6'));
  const m = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, opacity: 0.22 });
  const rel = mod(attribute('seed', 'vec3').mul(box).sub(vec3(0, fall, 0)).sub(cameraPosition), box).sub(box / 2);
  m.positionNode = cameraPosition.add(rel).add(streak.mul(attribute('tip', 'float')));
  m.colorNode = shade;
  const mesh = new THREE.LineSegments(g, m);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
  const wind = new THREE.Vector3(9, -32, 4), v = new THREE.Vector3();
  return {
    mesh,
    set(amount, night) { mesh.visible = amount > 0; g.setDrawRange(0, Math.round(n * amount) * 2); shade.value.set(night ? '#4a5260' : '#c4ccd6'); },
    update(dt, vel) { fall.value = (fall.value + 32 * dt) % box; streak.value.copy(v.copy(wind).sub(vel).multiplyScalar(0.02)); },
  };
}

// A lightning bolt: a jagged line from the cloud base to the ground, bright enough to bloom.
function createBolt() {
  const N = 28, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.Line(g, new THREE.LineBasicNodeMaterial({ color: new THREE.Color('#e8eeff').multiplyScalar(6), fog: false }));
  line.frustumCulled = false; line.visible = false;
  return {
    line,
    draw(x, z) {
      const top = 1500, bottom = groundAt(x, z);
      let ox = 0, oz = 0;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        ox += (Math.random() - 0.5) * 90; oz += (Math.random() - 0.5) * 90;
        pos.set([x + ox * t, top + (bottom - top) * t, z + oz * t], i * 3);
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

// Clouds: each a cluster of lit puffs, all drawn as one instanced sprite batch. Puffs facing the sun
// are bright and warm; undersides are cool grey.
function createClouds(clouds, keep, tint) {
  const per = 24, n = clouds.length * per, off = new Float32Array(n * 3), size = new Float32Array(n), shade = new Float32Array(n * 3), rot = new Float32Array(n);
  let k = 0, s = 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const c of clouds) for (let j = 0; j < per; j++, k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c.r * 0.8, y = (r() - 0.35) * c.r * 0.5;
    const p = [c.x + Math.cos(a) * d * 1.3, c.y + y, c.z + Math.sin(a) * d];
    off.set(p, k * 3);
    size[k] = c.r * (0.8 + r() * 0.7);
    const lit = Math.max(0, ((p[0] - c.x) * SUN.x + (p[1] - c.y) * SUN.y * 2 + (p[2] - c.z) * SUN.z) / c.r) * 0.5 + 0.5 + y / c.r;
    const t = Math.max(0, Math.min(1, lit));
    shade.set([0.68 + t * 0.34, 0.72 + t * 0.3, 0.8 + t * 0.2], k * 3);
    rot[k] = r() * Math.PI * 2;
  }
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false });
  const puff = keep(puffTexture());
  m.positionNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(off, 3));
  m.scaleNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(size, 1));
  m.rotationNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(rot, 1));
  m.colorNode = instancedBufferAttribute(new THREE.InstancedBufferAttribute(shade, 3)).mul(tint);
  m.opacityNode = texture(puff).a;
  const sprite = new THREE.Sprite(m);
  sprite.count = n; sprite.frustumCulled = false; sprite.renderOrder = 1;
  return sprite;
}

// --- Jets -------------------------------------------------------------------------------------------
const LIVERIES = {
  player: { base: '#e8ecf0', accent: '#c41e2c', dark: '#262b33', code: 'Q-07' },
  enemy: { base: '#4b5563', accent: '#f2b544', dark: '#1b1f25', code: 'X-31' },
};
const shape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
const slab = (pts, depth = 0.1) => new THREE.ExtrudeGeometry(shape(pts), { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.07, bevelSegments: 2 });

// Materials for one livery, shared by every jet wearing it.
export function jetKit(name) {
  const l = LIVERIES[name], skin = skinTexture(l), panels = panelTexture();
  panels.repeat.set(0.3, 0.3);
  const mats = {
    body: new THREE.MeshStandardNodeMaterial({ map: skin, metalness: 0.45, roughness: 0.38 }),
    wing: new THREE.MeshStandardNodeMaterial({ map: panels, color: l.base, metalness: 0.45, roughness: 0.42 }),
    accent: new THREE.MeshStandardNodeMaterial({ map: panels, color: l.accent, metalness: 0.3, roughness: 0.45 }),
    dark: new THREE.MeshStandardNodeMaterial({ color: '#23272e', metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardNodeMaterial({ color: '#16222e', metalness: 0.95, roughness: 0.05 }),
    missile: new THREE.MeshStandardNodeMaterial({ color: '#dfe3e8', metalness: 0.5, roughness: 0.35 }),
    red: new THREE.MeshBasicNodeMaterial({ color: '#ff3b3b' }), green: new THREE.MeshBasicNodeMaterial({ color: '#3bff7a' }),
  };
  return { mats, textures: [skin, panels], dispose() { Object.values(mats).forEach((m) => m.dispose()); skin.dispose(); panels.dispose(); } };
}

// An original twin-tail fighter: a smooth lathed fuselage with an oval section, bubble canopy,
// side intakes, cropped-delta wings with root extensions, tailplanes, canted fins, a glowing nozzle,
// four missiles on pylons and navigation lights. Same axes and scale as the Base jet.
export function buildJet(kit) {
  const { mats } = kit, g = new THREE.Group(), add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; f?.(m); g.add(m); return m; };
  const profile = [[0.92, -8.0], [1.02, -7.2], [1.12, -4.5], [1.24, -1], [1.26, 2], [1.16, 4.5], [0.98, 6.4], [0.72, 8.1], [0.42, 9.6], [0.14, 10.8], [0.01, 11.3]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(profile, 32).rotateX(Math.PI / 2).scale(1.05, 0.88, 1), mats.body);
  add(new THREE.SphereGeometry(1, 28, 16), mats.glass, (m) => { m.scale.set(0.6, 0.56, 2.05); m.position.set(0, 0.78, 4.7); });
  add(new THREE.TorusGeometry(0.6, 0.05, 6, 20, Math.PI), mats.dark, (m) => { m.scale.set(1, 0.95, 1); m.position.set(0, 0.86, 4.1); }); // canopy bow
  for (const side of [1, -1]) {
    // Intake: a box duct with a dark mouth.
    add(new THREE.BoxGeometry(0.7, 0.95, 3.8), mats.body, (m) => m.position.set(side * 1.2, -0.25, 1.6));
    add(new THREE.PlaneGeometry(0.62, 0.85), mats.dark, (m) => m.position.set(side * 1.2, -0.25, 3.52));
    add(slab([[0.8, 3.0], [7.6, -2.5], [7.6, -3.5], [0.8, -4.9]]).rotateX(Math.PI / 2), mats.wing, (m) => { m.scale.x = side; m.position.y = -0.05; });
    add(slab([[0.7, 6.6], [1.7, 2.6], [0.8, 2.6]], 0.06).rotateX(Math.PI / 2), mats.wing, (m) => { m.scale.x = side; m.position.y = 0.05; }); // root extension
    add(slab([[6.6, -1.9], [7.62, -2.5], [7.62, -3.5], [6.6, -3.55]], 0.11).rotateX(Math.PI / 2), mats.accent, (m) => { m.scale.x = side; m.position.y = -0.05; });
    add(slab([[0.7, -5.4], [4.3, -7.7], [4.3, -8.6], [0.7, -8.5]], 0.07).rotateX(Math.PI / 2), mats.wing, (m) => { m.scale.x = side; m.position.y = -0.1; });
    add(slab([[-8.4, 0], [-5.1, 0], [-6.9, 3.9], [-8.4, 3.9]], 0.08).rotateY(-Math.PI / 2), mats.accent, (m) => { m.position.set(side * 0.8, 0.55, 0); m.rotation.z = -side * 0.3; });
    add(new THREE.SphereGeometry(0.12, 8, 6), side > 0 ? mats.red : mats.green, (m) => { m.position.set(side * 7.62, -0.02, -3.0); m.castShadow = false; });
  }
  add(new THREE.CylinderGeometry(0.8, 0.98, 1.7, 24, 1, true).rotateX(Math.PI / 2), mats.dark, (m) => { m.position.z = -8.6; });
  // Nozzle glow and flame, brightened with the throttle (unlit, so they bloom).
  const glowMat = new THREE.MeshBasicNodeMaterial({ color: '#ff9a3c' }), heat = uniform(1);
  glowMat.colorNode = vec3(1.0, 0.55, 0.2).mul(heat.mul(2.2));
  add(new THREE.CircleGeometry(0.72, 20).rotateY(Math.PI), glowMat, (m) => { m.position.z = -8.3; m.castShadow = false; });
  const flame = add(new THREE.ConeGeometry(0.7, 4.5, 16, 1, true).rotateX(-Math.PI / 2),
    new THREE.MeshBasicNodeMaterial({ color: '#ffb056', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), (m) => { m.position.z = -10.8; m.castShadow = false; });
  // Missiles on pylons, two under each wing; hidden as they are fired.
  const pylons = [];
  for (const [x, z] of [[3.0, -1.2], [5.0, -2.2], [-3.0, -1.2], [-5.0, -2.2]]) {
    const msl = new THREE.Group();
    msl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 3, 10).rotateX(Math.PI / 2), mats.missile));
    msl.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.6, 10).rotateX(Math.PI / 2).translate(0, 0, 1.8), mats.dark));
    msl.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4).translate(0, 0, -1.3), mats.missile), new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.4).translate(0, 0, -1.3), mats.missile));
    msl.position.set(x, -0.62, z);
    g.add(msl); pylons.push(msl);
  }
  g.scale.setScalar(1.35);
  g.userData = { flame, heat, pylons, glowMat };
  return g;
}

export function buildMissileMesh(kit, enemy) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.4, 10).rotateX(Math.PI / 2), kit.mats.missile));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 10).rotateX(Math.PI / 2).translate(0, 0, 2.1), kit.mats.dark));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8).translate(0, 0, -2), new THREE.MeshBasicNodeMaterial({ color: enemy ? '#ff7050' : '#ffd38a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  return g;
}

// Tracers: one instanced glowing streak per bullet.
export function createTracers(scene, color, max = 1536) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.4, 12), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(color).multiplyScalar(3), fog: false }), max);
  mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), d = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  return (bullets, nb, team) => {
    let n = 0;
    for (let i = 0; i < nb && n < max; i++) {
      const o = i * 8;
      if (bullets[o + 7] !== team) continue;
      q.setFromUnitVectors(Z, d.set(bullets[o + 3], bullets[o + 4], bullets[o + 5]).normalize());
      mesh.setMatrixAt(n++, m.compose(p.set(bullets[o], bullets[o + 1], bullets[o + 2]), q, s));
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  };
}

// Fire and smoke: two instanced sprite pools, attributes rewritten each frame.
function pool(scene, { max, additive, map }) {
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3), col = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), size = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  for (const a of [pos, col, size]) a.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const c = instancedDynamicBufferAttribute(col);
  m.positionNode = instancedDynamicBufferAttribute(pos);
  m.scaleNode = instancedDynamicBufferAttribute(size);
  m.colorNode = c.rgb.mul(additive ? 2.5 : 1);
  m.opacityNode = texture(map).a.mul(c.a);
  const sprite = new THREE.Sprite(m); sprite.count = 0; sprite.frustumCulled = false; sprite.renderOrder = 2;
  scene.add(sprite);
  const ps = [], tc = new THREE.Color();
  return {
    emit(p, v, life, color, sz, fall = 0) { if (ps.length < max) ps.push({ p: [...p], v, life, max: life, c: tc.set(color).toArray(), sz, fall }); },
    step(dt) {
      let n = 0;
      for (let i = ps.length - 1; i >= 0; i--) { const q = ps[i]; q.life -= dt; if (q.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; } q.v[1] -= q.fall * dt; for (let k = 0; k < 3; k++) { q.p[k] += q.v[k] * dt; q.v[k] *= 1 - dt * 0.8; } }
      for (const q of ps) {
        const t = q.life / q.max;
        pos.array.set(q.p, n * 3);
        col.array.set(additive ? [q.c[0] * t, q.c[1] * t, q.c[2] * t, t] : [q.c[0], q.c[1], q.c[2], t * 0.85], n * 4);
        size.array[n] = q.sz * (additive ? 0.6 + t * 0.6 : 1.6 - t * 0.8);
        n++;
      }
      sprite.count = n;
      pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
    },
  };
}
export function createEffects(scene, map) {
  const fire = pool(scene, { max: 2000, additive: true, map }), smoke = pool(scene, { max: 2400, additive: false, map });
  const rnd = (k) => [(Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k];
  return {
    explode(p) {
      for (let i = 0; i < 120; i++) fire.emit(p, rnd(240), 0.5 + Math.random() * 0.8, ['#ffd27a', '#ff8a3d', '#ff4d2e'][i % 3], 14);
      for (let i = 0; i < 80; i++) smoke.emit(p, rnd(100), 1.6 + Math.random() * 2.4, '#3b3b3f', 26);
    },
    spark(p) { for (let i = 0; i < 8; i++) fire.emit(p, rnd(90), 0.25, '#ffe9a8', 4); },
    trail(p, dark) { smoke.emit(p, rnd(6), dark ? 2.4 : 1.3, dark ? '#2e2f33' : '#e2e6eb', dark ? 14 : 7); },
    flame(p) { fire.emit(p, rnd(12), 0.4, '#ff7a30', 8); },
    // A flare salvo: six white-hot pellets thrown out behind and down, falling, each trailing smoke.
    flares(p, v) {
      for (let i = 0; i < 6; i++) {
        const side = (i % 2 ? 1 : -1) * (20 + i * 6), d = [v[0] * 0.3 - v[2] * side / 140, v[1] * 0.3 - 25, v[2] * 0.3 + v[0] * side / 140];
        fire.emit(p, d, 2.6, '#fff1c9', 9, 30);
        for (let k = 0; k < 4; k++) smoke.emit(p, d.map((c) => c * (0.2 + k * 0.2)), 2.2, '#e8e3da', 8);
      }
    },
    step(dt) { fire.step(dt); smoke.step(dt); },
  };
}
export { puffTexture };
