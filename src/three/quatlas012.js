import * as THREE from 'three';

// The Quatlas 012, built in code from the team's photos: a boxy navy-and-white balsa airframe with a
// parasol upper wing on four struts, a low lower wing with winglets, a swept fin, a wooden two-blade prop
// and a bow landing gear. Metres; +x is the nose, +y up, +z the right wing.
// buildPlane() returns a Group whose children are the parts, named for src/content/aircraft.js PARTS
// (userData.part), each with userData.explode: where it moves when the drawing is pulled apart.

const C = {
  navy: '#1c2878', white: '#f1f1ec', balsa: '#d6ad74', alu: '#b9bdc3', wood: '#d4934a', red: '#cf2a2a', gold: '#c9a227', black: '#1c1c1f',
};
// Double-sided: the hand-built lofts and flat plates don't need consistent winding.
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, ...o });

// A decal: navy covering with a white border and optional lettering, drawn once on a canvas.
function decal(words = [], { w = 1024, h = 256, border = 0.1, flip = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = C.white; x.fillRect(0, 0, w, h);
  const b = h * border;
  x.fillStyle = C.navy; x.fillRect(b, b, w - 2 * b, h - 2 * b);
  x.fillStyle = C.white; x.textBaseline = 'middle'; x.textAlign = 'center';
  if (flip) { x.translate(w, 0); x.scale(-1, 1); }
  for (const [text, u, size] of words) { x.font = `700 ${size * h}px Georgia, "Times New Roman", serif`; x.fillText(text, u * w, h / 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A flat-ish airfoil, chord along x (leading edge at +x), extruded along z.
function airfoil(chord, thick) {
  const s = new THREE.Shape(), n = 14;
  for (let i = 0; i <= n; i++) { const t = i / n, x = chord * (0.5 - t), y = thick * Math.sqrt(Math.max(0, 1 - (2 * t - 0.25) ** 2 / 1.6)) * (1 - t * 0.6); i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.lineTo(-chord / 2, 0); s.lineTo(chord / 2, -thick * 0.15); s.closePath();
  return s;
}

// One wing panel from z0 to z1, its top and bottom covered with decals. Returns a Group.
function panel({ chord, span, thick = 0.03, top, bottom }) {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(airfoil(chord, thick), { depth: span, bevelEnabled: false, curveSegments: 1 });
  g.add(new THREE.Mesh(geo, std(C.white)));
  // Decal planes just proud of the surface: u along the span, v toward the leading edge.
  const sheet = (map, y, up) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(span, chord * 0.98).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2),
      std(C.white, { map, roughness: 0.32, polygonOffset: true, polygonOffsetFactor: -2 }));
    if (!up) p.rotation.x = Math.PI;
    p.position.set(0, y, span / 2);
    return p;
  };
  g.add(sheet(top, thick * 0.78 + 0.001, true), sheet(bottom, -thick * 0.15 - 0.001, false));
  return g;
}

// A box section lofted between stations [x, halfWidth, yBottom, yTop]. open: leave the top off (the bay).
function loft(stations, material, { open = false } = {}) {
  const pos = [], idx = [];
  for (const [x, hw, y0, y1] of stations) pos.push(x, y0, -hw, x, y0, hw, x, y1, hw, x, y1, -hw);
  const corner = [[0, 1], [1, 2], [2, 3], [3, 0]]; // bottom, right, top, left
  for (let s = 0; s < stations.length - 1; s++) {
    for (const f of [0, 1, 2, 3]) {
      if (open && f === 2) continue;
      const [a, b] = corner[f], i = s * 4, j = i + 4;
      idx.push(i + a, j + a, j + b, i + a, j + b, i + b);
    }
  }
  // End caps.
  const last = (stations.length - 1) * 4;
  idx.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed(); flat.computeVertexNormals();
  return new THREE.Mesh(flat, material);
}

const box = (sx, sy, sz, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); return b; };
const part = (id, explode, ...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); g.userData = { part: id, explode: new THREE.Vector3(...explode) }; return g; };

export function buildPlane() {
  const navy = std(C.navy, { roughness: 0.3, metalness: 0.1 }), white = std(C.white), balsa = std(C.balsa, { roughness: 0.8 });
  const alu = std(C.alu, { metalness: 0.8, roughness: 0.35 }), black = std(C.black, { roughness: 0.4 });
  const plane = new THREE.Group();

  // Fuselage: white nose block, the open balsa bay, then the navy body tapering to the tail.
  const TOP = 0.09, BOT = -0.1;
  const fus = part('fuselage', [0, 0, 0],
    loft([[0.56, 0.072, -0.072, 0.072], [0.45, 0.085, BOT, TOP]], white),
    loft([[0.45, 0.085, BOT, TOP], [0.05, 0.085, BOT, TOP]], navy, { open: true }),
    loft([[0.05, 0.085, BOT, TOP], [-0.2, 0.08, BOT + 0.01, TOP], [-0.88, 0.024, 0.035, TOP]], navy),
    box(0.4, 0.004, 0.17, balsa, 0.25, BOT + 0.006, 0), // the bay floor
  );
  // Bay longerons and cross pieces, the lattice you can see in the photos.
  for (const z of [-0.081, 0.081]) fus.add(box(0.4, 0.012, 0.008, balsa, 0.25, TOP - 0.006, z));
  for (const x of [0.42, 0.33, 0.24, 0.15, 0.07]) fus.add(box(0.008, 0.012, 0.16, balsa, x, TOP - 0.006, 0));
  // Cabane struts up to the parasol wing (they stay with the fuselage when the wing lifts off).
  for (const x of [0.07, -0.1]) for (const z of [-1, 1]) {
    const s = box(0.022, 0.27, 0.012, white, x, TOP + 0.135, z * 0.1); s.rotation.x = -z * 0.12; fus.add(s);
  }
  fus.userData.anchor = new THREE.Vector3(-0.45, 0.06, 0); // label on the tail boom, clear of the payload's
  plane.add(fus);

  // Upper wing: a flat centre panel and two outer panels angled up, white tip plates.
  const UY = TOP + 0.27, UC = 0.3, UX = -0.03;
  const centre = panel({ chord: UC, span: 0.9, top: decal([['QUATLAS', 0.27, 0.42], ['012', 0.76, 0.55]]), bottom: decal() });
  centre.position.set(UX, UY, -0.45);
  const upper = part('wing', [0, 0.3, 0], centre);
  for (const side of [-1, 1]) {
    const outer = panel({ chord: UC * 0.9, span: 0.42, top: decal([], { w: 512 }), bottom: decal([], { w: 512 }) });
    const pivot = new THREE.Group();
    pivot.position.set(UX - 0.01, UY, side * 0.45);
    pivot.rotation.x = side * -0.24; // dihedral
    outer.position.z = side > 0 ? 0 : -0.42;
    const tip = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0.13, 0), new THREE.Vector2(-0.13, 0), new THREE.Vector2(-0.13, 0.09)]), { depth: 0.008, bevelEnabled: false }), white);
    tip.position.set(0, 0.01, side > 0 ? 0.42 : -0.42 - 0.008);
    pivot.add(outer, tip);
    upper.add(pivot);
  }
  plane.add(upper);

  // Lower wing at the bottom of the fuselage, with upturned white winglets.
  const LC = 0.26, LX = 0.13, LY = BOT + 0.012;
  const lowerPanel = panel({ chord: LC, span: 1.24, thick: 0.026, top: decal([['012', 0.2, 0.5], ['QUATLAS', 0.76, 0.38]]), bottom: decal() });
  lowerPanel.position.set(LX, LY, -0.62);
  const lower = part('wing', [0, -0.12, 0], lowerPanel);
  for (const side of [-1, 1]) {
    const wl = box(LC * 0.75, 0.13, 0.008, white, LX - 0.02, LY + 0.065, side * 0.62);
    wl.rotation.x = -side * 0.18; lower.add(wl);
  }
  plane.add(lower);

  // Tail: stabiliser with a white elevator, and the swept fin with "012" on both sides.
  const TX = -0.79;
  const stab = new THREE.Shape([new THREE.Vector2(0.1, 0), new THREE.Vector2(-0.1, 0), new THREE.Vector2(-0.1, 0.3), new THREE.Vector2(0.0, 0.3)]);
  const tail = part('tail', [-0.32, 0.04, 0]);
  for (const side of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.ExtrudeGeometry(stab, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2), navy);
    half.scale.y = side > 0 ? 1 : -1; half.position.set(TX, TOP + 0.006, 0); half.scale.z = side;
    tail.add(half);
  }
  tail.add(box(0.05, 0.013, 0.6, white, TX - 0.125, TOP, 0)); // elevator
  const finShape = new THREE.Shape([new THREE.Vector2(0.16, 0), new THREE.Vector2(-0.11, 0), new THREE.Vector2(-0.14, 0.31), new THREE.Vector2(-0.05, 0.31)]);
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.012, bevelEnabled: false }), navy);
  fin.position.set(TX - 0.02, TOP, -0.006);
  tail.add(fin);
  for (const side of [-1, 1]) {
    const number = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), new THREE.MeshStandardMaterial({ map: numberTex(side < 0), transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    number.position.set(TX - 0.06, TOP + 0.15, side * 0.0075); number.rotation.set(0, side > 0 ? 0 : Math.PI, 1.38);
    tail.add(number);
  }
  plane.add(tail);

  // Motor on its aluminium mount, wooden prop with red tips (the prop is its own child, to spin).
  const motor = part('motor', [0.3, 0, 0]);
  const cyl = (r, l, m, x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 24).rotateZ(Math.PI / 2), m); c.position.x = x; return c; };
  motor.add(cyl(0.036, 0.008, alu, 0.565), cyl(0.03, 0.04, black, 0.59), cyl(0.031, 0.012, std(C.gold, { metalness: 0.7, roughness: 0.3 }), 0.6), cyl(0.006, 0.05, alu, 0.625));
  const prop = new THREE.Group(); prop.position.x = 0.63;
  const blade = new THREE.Shape([new THREE.Vector2(0, -0.012), new THREE.Vector2(0.17, -0.014), new THREE.Vector2(0.18, 0), new THREE.Vector2(0.17, 0.01), new THREE.Vector2(0, 0.012)]);
  for (const a of [0, Math.PI]) {
    const b = new THREE.Mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: false }), std(C.wood, { roughness: 0.4 }));
    b.rotation.set(a, Math.PI / 2, 0.25); prop.add(b);
    const tipM = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.022), std(C.red)); tipM.position.set(0, Math.cos(a) * 0.165, 0); prop.add(tipM);
  }
  prop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 12).rotateZ(Math.PI / 2), black));
  motor.add(prop);
  motor.userData.prop = prop;
  plane.add(motor);

  // Bow landing gear in bent aluminium, two white wheels, and a little tail skid.
  const gear = part('gear', [0, -0.28, 0]);
  for (const side of [-1, 1]) {
    const leg = box(0.03, 0.2, 0.006, alu, 0.3, BOT - 0.09, side * 0.09); leg.rotation.x = side * 0.62; gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.026, 24).rotateX(Math.PI / 2), std('#eeeeea', { roughness: 0.7 }));
    wheel.position.set(0.3, BOT - 0.17, side * 0.17); gear.add(wheel);
    gear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12).rotateX(Math.PI / 2), black).translateX(0.3).translateY(BOT - 0.17).translateZ(side * 0.17));
  }
  gear.add(box(0.006, 0.006, 0.34, alu, 0.3, BOT - 0.17, 0)); // axle
  const skid = box(0.08, 0.006, 0.01, alu, -0.84, 0.025, 0); skid.rotation.z = 0.5; tail.add(skid);
  plane.add(gear);

  // Payload bay: the balsa cradle inside the open bay; it rises out when the drawing is exploded.
  const bay = part('payload', [0, 0.17, 0], box(0.3, 0.1, 0.13, std('#3a3f47', { roughness: 0.7 }), 0.25, BOT + 0.06, 0));
  for (const x of [0.12, 0.25, 0.38]) bay.add(box(0.01, 0.12, 0.15, balsa, x, BOT + 0.06, 0));
  plane.add(bay);

  // Each part owns its materials, so one can be highlighted on its own.
  for (const p of plane.children) p.traverse((o) => { if (o.material) o.material = o.material.clone(); });
  return plane;
}

function numberTex(mirror) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 112;
  const x = c.getContext('2d');
  if (mirror) { x.translate(256, 0); x.scale(-1, 1); }
  x.fillStyle = C.white; x.font = '700 96px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('012', 128, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Frees every geometry, material and texture under root.
export function dispose(root) {
  root.traverse((o) => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
}
