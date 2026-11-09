// 3D models, checked as geometry (no browser): every mesh of the assembled Quatlas 012 and of the
// Dogfight jets must touch the rest of its model (no floating pieces), every part must be named, and
// nothing may be degenerate (NaN or empty geometry).
// Two meshes "touch" when an edge of one crosses a face of the other, or a vertex of one lies within
// `tol` of a face of the other.
import * as THREE from 'three';

// Canvas textures need a document in Node; geometry is all we look at.
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({})), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

function meshes(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position, v = [];
    for (let i = 0; i < pos.count; i++) v.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
    const tris = [];
    for (let i = 0; i + 2 < v.length; i += 3) tris.push(new THREE.Triangle(v[i], v[i + 1], v[i + 2]));
    let name = o.name || o.geometry.type, p = o;
    while (p && !p.userData?.part) p = p.parent;
    out.push({ o, v, tris, box: new THREE.Box3().setFromPoints(v), label: `${p?.userData.part ?? '?'}:${name}#${out.length}` });
  });
  return out;
}

const ray = new THREE.Ray(), hit = new THREE.Vector3(), cp = new THREE.Vector3();
function touches(a, b, tol) {
  const zone = a.box.clone().expandByScalar(tol).intersect(b.box.clone().expandByScalar(tol));
  if (zone.isEmpty()) return false;
  // Only the triangles and vertices in the boxes' overlap can touch.
  const near = (m) => ({ v: m.v.filter((x) => zone.containsPoint(x)), tris: m.tris.filter((t) => zone.intersectsTriangle(t)) });
  const na = near(a), nb = near(b);
  for (const [p, q] of [[na, nb], [nb, na]]) {
    for (const t of q.tris) {
      for (const x of p.v) { t.closestPointToPoint(x, cp); if (cp.distanceTo(x) <= tol) return true; }
    }
    for (const t of p.tris) {
      for (const [s, e] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
        const len = s.distanceTo(e); if (!len) continue;
        ray.set(s, e.clone().sub(s).divideScalar(len));
        for (const u of q.tris) if (ray.intersectTriangle(u.a, u.b, u.c, false, hit) && hit.distanceTo(s) <= len) return true;
      }
    }
  }
  return false;
}

// Connected components of the touch graph; returns the pieces outside the largest one.
export function floating(root, tol) {
  const m = meshes(root), parent = m.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (find(i) !== find(j) && touches(m[i], m[j], tol)) parent[find(i)] = find(j);
  const groups = {};
  m.forEach((x, i) => (groups[find(i)] ??= []).push(x));
  const sorted = Object.values(groups).sort((a, b) => b.length - a.length);
  return { count: m.length, loose: sorted.slice(1).flat().map((x) => x.label), bad: m.filter((x) => !x.v.length || x.v.some((p) => !Number.isFinite(p.x + p.y + p.z))).map((x) => x.label) };
}

export async function run({ check }) {
  const { buildPlane } = await import('../../src/three/quatlas012.js');
  const plane = buildPlane();
  const r = floating(plane, 0.002); // 2 mm on a 1.5 m model
  check('model', 'Quatlas 012: every mesh attached (no floating pieces)', r.loose.length === 0, r.loose.length, 0, r.loose.join(', '));
  check('model', 'Quatlas 012: no empty or NaN geometry', r.bad.length === 0, r.bad.length, 0, r.bad.join(', '));
  const { PARTS } = await import('../../src/content/aircraft.js');
  const ids = new Set(plane.children.map((p) => p.userData.part));
  const unnamed = [...ids].filter((id) => !PARTS[id]?.name);
  check('model', 'Quatlas 012: every part has a label in content/aircraft.js', unnamed.length === 0, unnamed.length, 0, unnamed.join(', '));
  // The prop must sit in front of the nose, clear of the fuselage, so it can spin without cutting it.
  const box = new THREE.Box3().setFromObject(plane.children.find((p) => p.userData.part === 'fuselage'));
  const prop = plane.children.find((p) => p.userData.part === 'motor').userData.prop;
  const pb = new THREE.Box3().setFromObject(prop);
  check('model', 'Quatlas 012: propeller disc clear of the fuselage', pb.min.x > box.max.x - 1e-6, +(pb.min.x - box.max.x).toFixed(4), '>0');

  const { buildJet } = await import('../../src/games/dogfight/scene.js');
  const jet = buildJet(); // the enemies are the same mesh in other colours
  jet.remove(jet.userData.flame); // the exhaust flame is a glow behind the nozzle, not a part
  const j = floating(jet, 0.03);
  check('model', 'Dogfight jet: every mesh attached', j.loose.length === 0, j.loose.length, 0, j.loose.join(', '));
}
