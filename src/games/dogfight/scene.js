import * as THREE from 'three';
import { heightAt, ARENA } from './logic.js';

// Dogfight's look, all built in code: a late-afternoon sky dome, low-poly islands, the sea, clouds,
// original low-poly jets (Quatlas red-and-white for the player), tracers, fire and smoke.

const SKY_TOP = new THREE.Color('#1f4f8f'), HORIZON = new THREE.Color('#f3c79e');

function sky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_TOP }, horizon: { value: HORIZON }, sunDir: { value: new THREE.Vector3(0.6, 0.25, 0.75).normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y * 1.6, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.6));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0,0.8,0.55) * (pow(s, 400.0) * 3.0 + pow(s, 12.0) * 0.35);
        if (vDir.y < 0.0) c = horizon * 0.92; gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(9500, 32, 16), mat);
  m.frustumCulled = false;
  return m;
}

const BANDS = [[3, '#d9c68f'], [70, '#5f8e45'], [190, '#3e6a35'], [290, '#7a7366'], [1e9, '#eef1f4']];
function terrain() {
  const size = ARENA * 2.6, g = new THREE.PlaneGeometry(size, size, 170, 170).rotateX(-Math.PI / 2).toNonIndexed();
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  // Colour each triangle by its average height: flat facets, like a low-poly model.
  for (let i = 0; i < pos.count; i += 3) {
    const h = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    c.set(BANDS.find(([max]) => h < max)[1]).offsetHSL(0, 0, ((i * 7919) % 13) / 260 - 0.025);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

function sea() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#1e6e9e', roughness: 0.3, metalness: 0.15 }));
  m.position.y = 0;
  return m;
}

function clouds() {
  // Lit partly from within (emissive), so clouds stay bright from every side instead of turning slate grey against the sun.
  const puffs = 70 * 5, mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e9d9cf', emissiveIntensity: 0.55, flatShading: true, roughness: 1 }), puffs);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  const r = (k) => { const x = Math.sin(k * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < 70; i++) {
    const cx = (r(i) - 0.5) * ARENA * 2.2, cz = (r(i + 99) - 0.5) * ARENA * 2.2, cy = 650 + r(i + 7) * 500;
    for (let j = 0; j < 5; j++) {
      const k = i * 5 + j, sz = 40 + r(k + 3) * 60;
      p.set(cx + (r(k) - 0.5) * 160, cy + (r(k + 1) - 0.5) * 30, cz + (r(k + 2) - 0.5) * 120);
      s.set(sz * 1.6, sz * 0.7, sz);
      mesh.setMatrixAt(n++, m.compose(p, q, s));
    }
  }
  return mesh;
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON.clone().multiplyScalar(0.95), 1800, 8500);
  scene.add(sky(), terrain(), sea(), clouds());
  scene.add(new THREE.HemisphereLight('#cfe2ff', '#3e4a38', 1.1));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.4);
  sun.position.set(3000, 1300, 3800);
  scene.add(sun);
  return scene;
}

// An original low-poly fighter: tapered body, delta wings, twin canted fins, one engine with a flame.
function shape(points) { const s = new THREE.Shape(); points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; }
const flat = (pts, depth = 0.25) => new THREE.ExtrudeGeometry(shape(pts), { depth, bevelEnabled: false });

export function buildJet({ body = '#eceff2', accent = '#c41e2c' } = {}) {
  const g = new THREE.Group();
  const mBody = new THREE.MeshStandardMaterial({ color: body, roughness: 0.45, metalness: 0.35, flatShading: true });
  const mAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.2, flatShading: true });
  const mDark = new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.6, metalness: 0.5 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 14, 8).rotateX(Math.PI / 2), mBody);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.5, 8).rotateX(Math.PI / 2), mAccent); nose.position.z = 9.2;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#8fd0ff', roughness: 0.05, metalness: 0.6, emissive: '#1b3a55', emissiveIntensity: 0.4 }));
  canopy.scale.set(0.75, 0.65, 2.1); canopy.position.set(0, 0.95, 3.8);
  g.add(fus, nose, canopy);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(flat([[0.8, 2.5], [7.5, -2.8], [7.5, -4.2], [0.8, -4.6]]).rotateX(Math.PI / 2), mBody);
    const tip = new THREE.Mesh(flat([[6.4, -2], [7.5, -2.8], [7.5, -4.2], [6.4, -4.3]], 0.27).rotateX(Math.PI / 2), mAccent);
    const tail = new THREE.Mesh(flat([[0.6, -5], [3.6, -7.4], [3.6, -8.2], [0.6, -8.1]]).rotateX(Math.PI / 2), mBody);
    const fin = new THREE.Mesh(flat([[-7.8, 0], [-5.2, 0], [-6.6, 3.6], [-7.9, 3.6]], 0.2).rotateY(-Math.PI / 2).translate(0.1, 0, 0), mAccent); // centred on its root
    for (const m of [wing, tip, tail]) { m.scale.x = side; m.position.y = -0.1; g.add(m); }
    fin.position.set(side * 0.75, 0.5, 0); fin.rotation.z = -side * 0.28; g.add(fin);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.4, 10).rotateX(Math.PI / 2), mDark); nozzle.position.z = -7.6;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4, 10, 1, true).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.z = -10;
  g.add(nozzle, flame);
  g.scale.setScalar(1.35);
  g.userData.flame = flame;
  return g;
}

// Tracers: one instanced stretched box per live bullet, glowing.
export function createTracers(scene, color, max = 400) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 10), new THREE.MeshBasicMaterial({ color, fog: false }), max);
  mesh.frustumCulled = false; scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), d = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  return (bullets) => {
    let n = 0;
    for (const b of bullets) { if (b.life <= 0 || n >= max) continue; q.setFromUnitVectors(Z, d.copy(b.vel).normalize()); mesh.setMatrixAt(n++, m.compose(b.pos, q, s)); }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  };
}

// Particles: fire (additive, fades to black) and smoke (fades into the haze). One draw call each.
function dot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function pool(scene, { max, size, additive }) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true }));
  pts.frustumCulled = false; scene.add(pts);
  const ps = []; const c = new THREE.Color(), fade = additive ? new THREE.Color(0, 0, 0) : HORIZON;
  return {
    emit(p, v, life, color) { if (ps.length < max) ps.push({ p: p.clone(), v: v.clone(), life, max: life, c: new THREE.Color(color) }); },
    step(dt) {
      let n = 0;
      for (let i = ps.length - 1; i >= 0; i--) { const q = ps[i]; q.life -= dt; if (q.life <= 0) { ps.splice(i, 1); continue; } q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 0.8); }
      for (const q of ps) { q.p.toArray(pos, n * 3); c.copy(q.c).lerp(fade, 1 - q.life / q.max).toArray(col, n * 3); n++; }
      geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}
export function createEffects(scene) {
  const fire = pool(scene, { max: 1600, size: 16, additive: true }), smoke = pool(scene, { max: 1600, size: 26, additive: false });
  const v = new THREE.Vector3();
  const rnd = (k) => v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(k);
  return {
    explode(p) {
      for (let i = 0; i < 90; i++) fire.emit(p, rnd(220), 0.5 + Math.random() * 0.7, ['#ffd27a', '#ff8a3d', '#ff4d2e'][i % 3]);
      for (let i = 0; i < 60; i++) smoke.emit(p, rnd(90), 1.5 + Math.random() * 2, '#3b3b3f');
    },
    spark(p) { for (let i = 0; i < 6; i++) fire.emit(p, rnd(80), 0.25, '#ffe9a8'); },
    trail(p, dark) { smoke.emit(p, rnd(6), dark ? 2.2 : 1.1, dark ? '#2e2f33' : '#d8dde4'); },
    flame(p) { fire.emit(p, rnd(12), 0.35, '#ff7a30'); },
    step(dt) { fire.step(dt); smoke.step(dt); },
  };
}

export function buildMissile() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.2, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#dfe3e8', metalness: 0.4, roughness: 0.4 })));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf7a', blending: THREE.AdditiveBlending, transparent: true }));
  glow.position.z = -1.8; g.add(glow);
  return g;
}
