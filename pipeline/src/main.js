import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GF, FF, MAT } from './data.js';

const H_EXT = 3.04, H_INT = 2.5, H_CUT = 1.1, H_LOW = 1.2, H_RAIL = 1.0;
const T_EXT = 0.2, T_INT = 0.1;

// ---------- materials ----------
const matCache = {};
function std(color, extra = {}) {
  const k = color + JSON.stringify(extra);
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0, ...extra });
  return matCache[k];
}
const M = {
  extWall: new THREE.MeshStandardMaterial({ color: '#e8eef5', transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.2, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.05, side: THREE.DoubleSide }),
  intWall: std('#eceae6'),
  frame: std('#2b3138', { metalness: 0.5, roughness: 0.4 }),
  edgeExt: new THREE.LineBasicMaterial({ color: '#dbe6f2', transparent: true, opacity: 0.5 }),
  edgeGlass: new THREE.LineBasicMaterial({ color: '#8ccfff', transparent: true, opacity: 0.45 }),
  lightOff: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 0.9, roughness: 0.4 }),
};

function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }
function B(g, x0, y0, z0, x1, y1, z1, color, extra) {
  const m = mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), typeof color === 'string' ? std(color, extra) : color);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(m); return m;
}
// rounded box
function R(g, x0, y0, z0, x1, y1, z1, color, r = 0.05, extra) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const m = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.002, rr)), typeof color === 'string' ? std(color, extra) : color);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(m); return m;
}
function C(g, x, z, r, y0, y1, color, seg = 24, extra) {
  const m = mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), typeof color === 'string' ? std(color, extra) : color);
  m.position.set(x, (y0 + y1) / 2, z); g.add(m); return m;
}
function place(g, local, x, z, deg = 0, name) {
  local.position.set(x, 0, z); local.rotation.y = THREE.MathUtils.degToRad(deg); if (name) local.name = name; g.add(local); return local;
}
const legs = (g, w, d, h, inset = 0.05, col = '#2a2a2a', r = 0.022) => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(g, sx * (w / 2 - inset), sz * (d / 2 - inset), r, 0, h, col, 10); };

// ---------- furniture (local: centred, front faces +z, back at -z) ----------
const WOOD = '#8a6a4f', DARKWOOD = '#5b4637', OAK = '#b08b64';
const F = {
  bed(w = 1.53, l = 2.03, duvet = '#e9e6df', throwCol = '#4f6d8f') {
    const g = new THREE.Group();
    R(g, -w / 2 - 0.06, 0.08, -l / 2, w / 2 + 0.06, 0.32, l / 2 + 0.04, '#7a6a5c', 0.04);                 // upholstered base
    legs(g, w + 0.05, l, 0.08, 0.1);
    R(g, -w / 2, 0.32, -l / 2 + 0.03, w / 2, 0.55, l / 2, '#f7f6f2', 0.06);                               // mattress
    R(g, -w / 2 - 0.02, 0.5, -l / 2 + 0.55, w / 2 + 0.02, 0.6, l / 2 + 0.02, duvet, 0.05);               // duvet
    R(g, -w / 2 + 0.02, 0.6, l / 2 - 0.6, w / 2 - 0.02, 0.64, l / 2 - 0.1, throwCol, 0.02);               // throw
    R(g, -w / 2 - 0.1, 0.08, -l / 2 - 0.1, w / 2 + 0.1, 1.2, -l / 2 + 0.02, '#6f6258', 0.06);             // headboard
    const pw = (w - 0.3) / 2;
    R(g, -w / 2 + 0.1, 0.55, -l / 2 + 0.08, -w / 2 + 0.1 + pw, 0.72, -l / 2 + 0.45, '#ffffff', 0.07);
    R(g, w / 2 - 0.1 - pw, 0.55, -l / 2 + 0.08, w / 2 - 0.1, 0.72, -l / 2 + 0.45, '#ffffff', 0.07);
    R(g, -0.25, 0.6, -l / 2 + 0.4, 0.25, 0.8, -l / 2 + 0.52, throwCol, 0.05);                           // cushion
    for (const s of [-1, 1]) {                                                                          // bedsides + lamps
      R(g, s * (w / 2 + 0.12), 0, -l / 2, s * (w / 2 + 0.62), 0.5, -l / 2 + 0.42, WOOD, 0.02);
      C(g, s * (w / 2 + 0.37), -l / 2 + 0.2, 0.05, 0.5, 0.62, '#d9d4cc');
      const shade = mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 20), std('#f3e2bf', { emissive: '#6b5024' })); shade.position.set(s * (w / 2 + 0.37), 0.7, -l / 2 + 0.2); g.add(shade);
    }
    return g;
  },
  wardrobe(len, depth = 0.6, h = 2.2, col = '#d8d2c8') {
    const g = new THREE.Group(); R(g, -len / 2, 0, -depth / 2, len / 2, h, depth / 2, col, 0.02);
    for (let x = -len / 2 + 0.45; x < len / 2 - 0.1; x += 0.45) B(g, x - 0.004, 0.05, depth / 2, x + 0.004, h - 0.05, depth / 2 + 0.005, '#b9b1a4');
    return g;
  },
  rail(len) {
    const g = new THREE.Group();
    R(g, -len / 2, 0, -0.3, len / 2, 0.45, 0.3, '#d6cdbf', 0.02);
    C(g, -len / 2, 0, 0.015, 0.45, 1.85, '#9aa3ad').rotation.z = 0;
    const bar = mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 8), std('#9aa3ad', { metalness: 0.6 })); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.85, 0); g.add(bar);
    const cols = ['#394b63', '#8a5a44', '#d9d4c7', '#4b5d3a', '#7b6d8d', '#202428', '#c7a27a'];
    let i = 0; for (let x = -len / 2 + 0.12; x < len / 2 - 0.1; x += 0.13, i++) R(g, x, 0.95 + (i % 3) * 0.08, -0.22, x + 0.09, 1.8, 0.22, cols[(i * 3) % cols.length], 0.03);
    return g;
  },
  sofa(w = 2.4, d = 0.95, col = '#6c7a89', seats = 0) {
    const g = new THREE.Group(); const n = seats || Math.max(1, Math.round((w - 0.4) / 0.75));
    R(g, -w / 2, 0.08, -d / 2, w / 2, 0.3, d / 2, col, 0.04);                     // plinth
    legs(g, w, d, 0.08, 0.08, '#222', 0.018);
    R(g, -w / 2, 0.08, -d / 2, -w / 2 + 0.2, 0.62, d / 2, col, 0.08);            // arms
    R(g, w / 2 - 0.2, 0.08, -d / 2, w / 2, 0.62, d / 2, col, 0.08);
    R(g, -w / 2, 0.3, -d / 2, w / 2, 0.82, -d / 2 + 0.2, col, 0.08);             // back frame
    const sw = (w - 0.4) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + 0.2 + i * sw;
      R(g, x0 + 0.01, 0.3, -d / 2 + 0.2, x0 + sw - 0.01, 0.46, d / 2 - 0.02, col, 0.06);          // seat cushion
      R(g, x0 + 0.02, 0.46, -d / 2 + 0.18, x0 + sw - 0.02, 0.85, -d / 2 + 0.36, col, 0.08).rotation.x = -0.12; // back cushion
    }
    R(g, -w / 2 + 0.25, 0.46, -d / 2 + 0.3, -w / 2 + 0.65, 0.78, -d / 2 + 0.44, '#e6dccb', 0.08).rotation.z = 0.2; // scatter
    return g;
  },
  lsofa(w = 3.0, l = 2.2, col = '#6c7a89') {
    const g = new THREE.Group(); g.add(F.sofa(w, 0.95, col));
    const c = new THREE.Group();
    R(c, -0.475, 0.08, 0, 0.475, 0.46, l - 0.95, col, 0.06);
    R(c, 0.28, 0.08, 0, 0.475, 0.62, l - 0.95, col, 0.08);
    c.position.set(w / 2 - 0.475, 0, 0.475); g.add(c);
    return g;
  },
  armchair(col = '#a07e5d') { return F.sofa(0.9, 0.85, col, 1); },
  table(w, d, h = 0.75, col = WOOD, legCol = '#2b2b2b', round = false) {
    const g = new THREE.Group();
    if (round) { C(g, 0, 0, w / 2, h - 0.04, h, col, 40); C(g, 0, 0, 0.05, 0, h - 0.04, legCol, 12); C(g, 0, 0, 0.25, 0, 0.02, legCol, 24); return g; }
    R(g, -w / 2, h - 0.045, -d / 2, w / 2, h, d / 2, col, 0.015);
    legs(g, w, d, h - 0.045, 0.08, legCol, 0.025);
    return g;
  },
  chair(col = '#2f3640', frame = '#222') {
    const g = new THREE.Group();
    R(g, -0.23, 0.42, -0.22, 0.23, 0.48, 0.23, col, 0.03);
    R(g, -0.22, 0.48, 0.16, 0.22, 0.88, 0.22, col, 0.04).rotation.x = 0.08;
    legs(g, 0.42, 0.42, 0.42, 0.03, frame, 0.015);
    return g;
  },
  dining(w, d, n, col, chairCol) {
    const g = F.table(w, d, 0.75, col);
    const per = Math.floor(n / 2);
    for (let i = 0; i < per; i++) {
      const x = -w / 2 + (w / per) * (i + 0.5);
      place(g, F.chair(chairCol), x, -d / 2 - 0.28, 180);
      place(g, F.chair(chairCol), x, d / 2 + 0.28, 0);
    }
    return g;
  },
  tv(w = 1.6, onUnit = true, unitCol = DARKWOOD) {
    const g = new THREE.Group();
    if (onUnit) { R(g, -w / 2 - 0.3, 0.1, -0.22, w / 2 + 0.3, 0.48, 0.22, unitCol, 0.02); legs(g, w + 0.5, 0.4, 0.1, 0.05, '#222', 0.015); }
    R(g, -w / 2, 0.8, -0.03, w / 2, 0.8 + w * 0.56, 0.0, '#0b0d10', 0.01);
    B(g, -w / 2 + 0.02, 0.82, 0.0, w / 2 - 0.02, 0.78 + w * 0.56, 0.003, '#16202c', { emissive: '#0c1622' });
    return g;
  },
  rug(w, d, col = '#c9b99a', border = '#a8977a') {
    const g = new THREE.Group(); R(g, -w / 2, 0.005, -d / 2, w / 2, 0.02, d / 2, border, 0.005); B(g, -w / 2 + 0.1, 0.006, -d / 2 + 0.1, w / 2 - 0.1, 0.022, d / 2 - 0.1, col); return g;
  },
  toilet() {
    const g = new THREE.Group();
    R(g, -0.2, 0.3, -0.36, 0.2, 0.75, -0.2, '#f7f7f7', 0.04);
    const bowl = C(g, 0, 0.02, 0.19, 0, 0.4, '#f7f7f7', 24); bowl.scale.z = 1.35;
    const seat = C(g, 0, 0.04, 0.2, 0.4, 0.43, '#ececec', 24); seat.scale.z = 1.35;
    return g;
  },
  vanity(w, d = 0.5, basins = 1) {
    const g = new THREE.Group();
    R(g, -w / 2, 0.25, -d / 2, w / 2, 0.84, d / 2, OAK, 0.015);
    R(g, -w / 2 - 0.01, 0.84, -d / 2, w / 2 + 0.01, 0.88, d / 2 + 0.01, '#efede8', 0.01);
    for (let i = 0; i < basins; i++) {
      const x = -w / 2 + (w / basins) * (i + 0.5);
      const b = C(g, x, 0.02, 0.2, 0.88, 1.0, '#ffffff', 28); b.scale.z = 0.8;
      C(g, x, -d / 2 + 0.06, 0.015, 0.88, 1.12, '#c0c6cc', 8, { metalness: 0.8, roughness: 0.2 });
      R(g, x - 0.35, 1.15, -d / 2 - 0.02, x + 0.35, 1.95, -d / 2 + 0.005, '#bcd3e0', 0.02, { metalness: 0.3, roughness: 0.1, emissive: '#1e2a33' });
    }
    return g;
  },
  shower(w, d) {
    const g = new THREE.Group();
    R(g, -w / 2, 0, -d / 2, w / 2, 0.03, d / 2, '#b7c3cc', 0.01);
    C(g, 0, -d / 2 + 0.25, 0.12, 2.05, 2.07, '#c0c6cc', 20, { metalness: 0.8 });
    const glass = mesh(new THREE.BoxGeometry(w, 2.0, 0.015), M.glass, false); glass.position.set(0, 1.0, d / 2); g.add(glass);
    return g;
  },
  bath(w = 1.7, d = 0.8) {
    const g = new THREE.Group();
    const m = C(g, 0, 0, 0.5, 0, 0.56, '#ffffff', 40); m.scale.set(w, 1, d);
    const inner = C(g, 0, 0, 0.47, 0.25, 0.565, '#a8dbf0', 40); inner.scale.set(w * 0.94, 1, d * 0.84);
    return g;
  },
  bench(w, d = 0.6, h = 0.9, top = '#e7e4de', body = '#f5f5f3') {
    const g = new THREE.Group();
    B(g, -w / 2 + 0.02, 0, -d / 2 + 0.02, w / 2 - 0.02, 0.1, d / 2 - 0.06, '#2a2a2a');                    // kick
    R(g, -w / 2, 0.1, -d / 2, w / 2, h - 0.04, d / 2, body, 0.01);
    R(g, -w / 2 - 0.01, h - 0.04, -d / 2, w / 2 + 0.01, h, d / 2 + 0.02, top, 0.008);
    for (let x = -w / 2 + 0.6; x < w / 2 - 0.1; x += 0.6) B(g, x - 0.003, 0.12, d / 2, x + 0.003, h - 0.06, d / 2 + 0.004, '#cfcac1');
    return g;
  },
  fridge() { const g = new THREE.Group(); R(g, -0.45, 0, -0.35, 0.45, 1.85, 0.35, '#c7cdd2', 0.03, { metalness: 0.5, roughness: 0.35 }); B(g, -0.003, 0.05, 0.35, 0.003, 1.8, 0.355, '#8b939a'); return g; },
  stool(col = '#2f3640') { const g = new THREE.Group(); const s = C(g, 0, 0, 0.18, 0.64, 0.7, col, 24); C(g, 0, 0, 0.025, 0, 0.64, '#b9bec4', 10, { metalness: 0.7 }); C(g, 0, 0, 0.2, 0, 0.02, '#b9bec4', 20, { metalness: 0.7 }); C(g, 0, 0, 0.15, 0.25, 0.27, '#b9bec4', 20); return g; },
  washer(col = '#f4f4f4') { const g = new THREE.Group(); R(g, -0.3, 0, -0.3, 0.3, 0.85, 0.3, col, 0.03); const d = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), std('#8aa1b1', { metalness: 0.3 })); d.rotation.x = Math.PI / 2; d.position.set(0, 0.45, 0.305); g.add(d); return g; },
  car(col = '#5a6b7d') {
    const g = new THREE.Group();
    R(g, -2.3, 0.2, -0.9, 2.3, 0.82, 0.9, col, 0.18, { metalness: 0.55, roughness: 0.3 });
    R(g, -1.25, 0.8, -0.8, 1.05, 1.42, 0.8, col, 0.2, { metalness: 0.55, roughness: 0.3 });
    R(g, -1.2, 0.86, -0.81, 1.0, 1.36, 0.81, '#162028', 0.15, { metalness: 0.3, roughness: 0.1 });
    for (const [x, z] of [[-1.5, -0.86], [1.5, -0.86], [-1.5, 0.86], [1.5, 0.86]]) { const w = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 24), std('#15171a')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w); }
    B(g, 2.28, 0.55, -0.7, 2.31, 0.68, -0.4, '#fff5d8', { emissive: '#8a7a50' }); B(g, 2.28, 0.55, 0.4, 2.31, 0.68, 0.7, '#fff5d8', { emissive: '#8a7a50' });
    return g;
  },
  desk(w = 1.8, d = 0.8, col = '#e9e3d8', monitors = 1) {
    const g = F.table(w, d, 0.74, col, '#2b2b2b');
    for (let i = 0; i < monitors; i++) {
      const x = monitors === 1 ? 0 : (i - (monitors - 1) / 2) * 0.62;
      R(g, x - 0.3, 0.9, -d / 2 + 0.1, x + 0.3, 1.25, -d / 2 + 0.13, '#0b0d10', 0.01);
      C(g, x, -d / 2 + 0.14, 0.02, 0.74, 0.9, '#555', 8);
    }
    R(g, -0.22, 0.74, -0.02, 0.22, 0.755, 0.12, '#3a3a3a', 0.005);
    R(g, 0.3, 0.74, 0.0, 0.4, 0.76, 0.1, '#3a3a3a', 0.01);
    return g;
  },
  officeChair(col = '#1f2a36') {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const b = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), std('#222')); b.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15); b.rotation.y = -a; g.add(b); }
    C(g, 0, 0, 0.03, 0.05, 0.45, '#666', 10);
    R(g, -0.26, 0.45, -0.25, 0.26, 0.54, 0.25, col, 0.05);
    R(g, -0.24, 0.56, 0.18, 0.24, 1.1, 0.26, col, 0.08).rotation.x = 0.1;
    B(g, -0.28, 0.54, -0.1, -0.25, 0.72, 0.1, '#222'); B(g, 0.25, 0.54, -0.1, 0.28, 0.72, 0.1, '#222');
    return g;
  },
  shelf(w, d = 0.35, h = 2.0, col = '#e2dccf') {
    const g = new THREE.Group();
    B(g, -w / 2, 0, -d / 2, -w / 2 + 0.025, h, d / 2, col); B(g, w / 2 - 0.025, 0, -d / 2, w / 2, h, d / 2, col);
    B(g, -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.015, col);
    const cols = ['#6a4c3a', '#2f4d6b', '#8c6b3e', '#4c6b4a', '#a44a3f', '#d9d2c3'];
    for (let y = 0; y < h; y += 0.4) {
      B(g, -w / 2, y, -d / 2, w / 2, y + 0.025, d / 2, col);
      let i = Math.round(y * 7);
      for (let x = -w / 2 + 0.06; x < w / 2 - 0.12; x += 0.05 + (i % 3) * 0.02, i++) if (i % 7 && y < h - 0.3) B(g, x, y + 0.025, -d / 2 + 0.04, x + 0.04 + (i % 3) * 0.015, y + 0.25 + (i % 4) * 0.025, d / 2 - 0.03, cols[i % cols.length]);
    }
    return g;
  },
  plant(h = 1.1, pot = '#d7cfc2') {
    const g = new THREE.Group(); const p = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 20), std(pot)); p.position.y = 0.18; g.add(p);
    const leaf = std('#3f7d3a'), leaf2 = std('#5a9a45');
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.SphereGeometry(0.22 - i * 0.015, 12, 8), i % 2 ? leaf : leaf2); const a = i * 1.1; s.position.set(Math.cos(a) * 0.12, 0.45 + (h - 0.5) * (i / 5), Math.sin(a) * 0.12); g.add(s); }
    return g;
  },
  lounger(col = '#efece6') { const g = new THREE.Group(); R(g, -0.35, 0.22, -0.4, 0.35, 0.34, 0.95, col, 0.04); legs(g, 0.66, 1.9, 0.22, 0.05, '#555', 0.015); const b = R(g, -0.35, 0.0, -0.35, 0.35, 0.1, 0.35, col, 0.04); b.scale.z = 1.6; b.rotation.x = -0.7; b.position.set(0, 0.55, -0.7); return g; },
  bbq() { const g = new THREE.Group(); R(g, -0.7, 0, -0.3, 0.7, 0.9, 0.3, '#4a4f55', 0.02, { metalness: 0.6, roughness: 0.4 }); R(g, -0.42, 0.9, -0.28, 0.42, 1.15, 0.22, '#2b2f33', 0.08, { metalness: 0.6 }); return g; },
  wine() { const g = new THREE.Group(); R(g, -0.3, 0, -0.3, 0.3, 1.8, 0.3, '#1d2127', 0.02); B(g, -0.26, 0.1, 0.29, 0.26, 1.7, 0.31, '#7a2638', { transparent: true, opacity: 0.75, emissive: '#3a0d18' }); return g; },
  screen(w = 2.8) { const g = new THREE.Group(); B(g, -w / 2, 0.55, -0.02, w / 2, 0.55 + w * 0.56, 0.02, '#eef2f6', { emissive: '#3a4656' }); B(g, -w / 2 - 0.05, 0.55 + w * 0.56, -0.05, w / 2 + 0.05, 0.63 + w * 0.56, 0.05, '#222'); return g; },
  recliner(col = '#3b4452') { const g = F.sofa(0.95, 1.0, col, 1); return g; },
  sideboard(w, col = DARKWOOD) { const g = new THREE.Group(); R(g, -w / 2, 0.15, -0.22, w / 2, 0.78, 0.22, col, 0.02); legs(g, w, 0.44, 0.15, 0.06, '#222', 0.015); return g; },
  pendant(y = 2.3, col = '#e8d9b8', r = 0.3) { const g = new THREE.Group(); C(g, 0, 0, 0.005, y + 0.2, 3.0, '#333', 6); const s = mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(col, { emissive: '#5a4520', side: THREE.DoubleSide })); s.position.y = y; g.add(s); return g; },
};

// ---------- builders ----------
function wallSeg(g, x0, z0, x1, z1, type) {
  const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.01) return;
  const ang = Math.atan2(z1 - z0, x1 - x0);
  const [h, t, mat, edgeMat] = {
    ext: [H_EXT, T_EXT, M.extWall, M.edgeExt], glass: [H_EXT, 0.06, M.glass, M.edgeGlass],
    int: [H_INT, T_INT, M.intWall, null], low: [H_LOW, T_INT, M.intWall, null], rail: [H_RAIL, 0.03, M.glass, M.edgeGlass],
  }[type];
  const geo = new THREE.BoxGeometry(len + (type === 'ext' ? t : type === 'int' ? t : 0), h, t);
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.rotation.y = -ang;
  if (type === 'int' || type === 'low') { m.castShadow = true; m.receiveShadow = true; }
  m.userData.kind = type; m.name = 'wall_' + type; g.add(m);
  if (edgeMat) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat); e.position.copy(m.position); e.rotation.copy(m.rotation); e.userData.kind = 'edge'; g.add(e); }
  if (type === 'rail') { const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.06), std('#9aa3ad', { metalness: 0.6 })); cap.position.set(m.position.x, h, m.position.z); cap.rotation.y = -ang; g.add(cap); }
}
const doorArcMat = new THREE.MeshBasicMaterial({ color: '#9fb4c8', transparent: true, opacity: 0.55, side: THREE.DoubleSide });
function addWall(g, [x0, z0, x1, z1, openings, type]) {
  const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  let cursor = 0;
  for (const [a, b, kind] of [...(openings || [])].sort((p, q) => p[0] - q[0])) {   // kind 'open' = doorless opening
    wallSeg(g, x0 + ux * cursor, z0 + uz * cursor, x0 + ux * a, z0 + uz * a, type);
    if (type === 'int' || type === 'ext') {
      const hx0 = x0 + ux * a, hz0 = z0 + uz * a, w = b - a;
      const hh = (type === 'ext' ? H_EXT : H_INT) - 2.34;
      if (hh > 0.01) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, type === 'ext' ? T_EXT : T_INT), type === 'ext' ? M.extWall : M.intWall); m.position.set(hx0 + ux * w / 2, 2.34 + hh / 2, hz0 + uz * w / 2); m.rotation.y = -Math.atan2(uz, ux); m.userData.kind = 'hdr'; g.add(m); }
      if (w > 1.25 || kind === 'open') { cursor = b; continue; }
      // door swing symbol on floor + open leaf
      const arc = new THREE.Mesh(new THREE.RingGeometry(w - 0.03, w, 24, 1, 0, Math.PI / 2), doorArcMat);
      arc.rotation.x = -Math.PI / 2; arc.position.set(hx0, 0.03, hz0); arc.rotation.z = Math.atan2(uz, ux); g.add(arc);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.04, w), std('#f1eee8')); leaf.userData.kind = 'leaf';
      // leaf stands perpendicular to wall at the hinge, on the +normal side
      const nx = -uz, nz = ux; leaf.position.set(hx0 + nx * w / 2, 1.02, hz0 + nz * w / 2); leaf.rotation.y = -Math.atan2(uz, ux); leaf.castShadow = true; g.add(leaf);
    }
    cursor = b;
  }
  wallSeg(g, x0 + ux * cursor, z0 + uz * cursor, x1, z1, type);
}
function addWindow(g, [x0, z0, x1, z1, sill, head, name]) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), h = head - sill;
  const w = new THREE.Group(); w.name = 'window_' + name;
  const pane = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.03), M.glass); w.add(pane);
  const fr = 0.05, th = 0.24;
  for (const [px, py, sx, sy] of [[0, h / 2 - fr / 2, len, fr], [0, -h / 2 + fr / 2, len, fr], [-len / 2 + fr / 2, 0, fr, h], [len / 2 - fr / 2, 0, fr, h]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, th), M.frame); f.position.set(px, py, 0); w.add(f); }
  const mull = Math.round(len / 1.2); for (let i = 1; i < mull; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, th * 0.8), M.frame); f.position.x = -len / 2 + (len / mull) * i; w.add(f); }
  w.position.set((x0 + x1) / 2, sill + h / 2, (z0 + z1) / 2); w.rotation.y = -ang; g.add(w);
}

function label(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d'); x.font = '600 56px Inter, Segoe UI, Arial';
  const w = Math.min(500, x.measureText(text).width + 50);
  x.fillStyle = 'rgba(17,21,28,0.72)'; x.beginPath(); x.roundRect((512 - w) / 2, 30, w, 92, 22); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 78);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.81, 1); s.renderOrder = 999; return s;
}
const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function roomAt(L, x, z) {
  let best = null, area = 1e9;
  for (const r of L.rooms) { const [n, x0, z0, x1, z1] = r; if (x >= x0 - 0.05 && x <= x1 + 0.05 && z >= z0 - 0.05 && z <= z1 + 0.05 && n) { const a = (x1 - x0) * (z1 - z0); if (a < area) { area = a; best = r; } } }
  for (const v of L.voids || []) { const [n, x0, z0, x1, z1] = v; if (!best && x >= x0 && x <= x1 && z >= z0 && z <= z1) best = [n, x0, z0, x1, z1]; }
  return best;
}

function buildLevel(L) {
  const g = new THREE.Group(); g.name = L.name.replace(' ', '_');
  const labels = new THREE.Group(); labels.name = 'labels';
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const r of [...L.rooms, ...(L.voids || [])]) { minX = Math.min(minX, r[1]); maxX = Math.max(maxX, r[3]); minZ = Math.min(minZ, r[2]); maxZ = Math.max(maxZ, r[4]); }
  const plate = mesh(new THREE.BoxGeometry(maxX - minX + 1.2, 0.12, maxZ - minZ + 1.2), std('#262c35'), false);
  plate.position.set((minX + maxX) / 2, -0.07, (minZ + maxZ) / 2); plate.name = 'site_pad'; g.add(plate);
  for (const [name, x0, z0, x1, z1, fl, lab] of L.rooms) {
    const f = mesh(new THREE.BoxGeometry(x1 - x0, 0.04, z1 - z0), std(MAT[fl]), false);
    f.position.set((x0 + x1) / 2, 0.0, (z0 + z1) / 2); f.name = 'floor_' + slug(name || 'hall'); g.add(f);
    if (name && lab !== false) { const s = label(name); s.position.set((x0 + x1) / 2, 2.0, (z0 + z1) / 2); labels.add(s); }
  }
  for (const [name, x0, z0, x1, z1] of L.voids || []) {
    const f = mesh(new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0), std('#0e1116'), false); f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.add(f);
    const s = label(name); s.scale.multiplyScalar(0.8); s.position.set((x0 + x1) / 2, 1.2, (z0 + z1) / 2); labels.add(s);
  }
  for (const w of L.walls) addWall(g, w);
  for (const w of L.windows || []) addWindow(g, w);
  g.add(labels);
  return g;
}

// ---------- smart device markers (named for Floor3D object binding) ----------
const DEV = {
  light: std('#fff3d6', { emissive: '#ffc66b', emissiveIntensity: 1.2 }),
  outdoor: std('#fff3d6', { emissive: '#9ad0ff', emissiveIntensity: 1.0 }),
  sw: std('#f7f7f7'), swRing: std('#4aa3ff', { emissive: '#1d5fa3' }),
  motion: std('#f4f4f4', { emissive: '#3a7a3a' }), contact: std('#ff9f43', { emissive: '#8a4a10' }),
  screenBody: std('#111418'), screenGlow: std('#3a8bd6', { emissive: '#2a6fb8', emissiveIntensity: 1.2 }),
};
function buildDevices(L, key) {
  const g = new THREE.Group(); g.name = 'devices';
  const counts = {}; const reg = [];
  const nameFor = (prefix, room) => { const r = slug(room); const k = prefix + r; counts[k] = (counts[k] || 0) + 1; return `${prefix}${r}_${counts[k]}`; };
  for (const [t, x, z] of L.elec || []) {
    const room = roomAt(L, x, z); const rn = room ? room[0] : 'outdoor';
    if (t === 'L' || t === 'P') {
      const nm = nameFor(t === 'P' ? 'light_pendant_' : 'light_', rn);
      const m = mesh(new THREE.CylinderGeometry(t === 'P' ? 0.16 : 0.09, t === 'P' ? 0.16 : 0.09, 0.03, 20), DEV.light, false);
      m.position.set(x, t === 'P' ? 2.4 : 2.9, z); m.name = nm; g.add(m); reg.push([nm, 'light', rn]);
    } else if (t === 'F') {
      const nm = nameFor('light_garden_', 'pool');
      const m = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 14), DEV.outdoor, false); m.position.set(x, 0.06, Math.min(z, 8.3)); m.name = nm; g.add(m); reg.push([nm, 'light', 'outdoor']);
    } else if (t === '2W') {
      const nm = nameFor('switch_', rn);
      const s = new THREE.Group(); s.name = nm;
      R(s, -0.06, -0.06, -0.012, 0.06, 0.06, 0.012, DEV.sw, 0.01); B(s, -0.045, -0.045, 0.012, 0.045, 0.045, 0.016, DEV.swRing);
      s.position.set(x, 1.05, z); s.scale.setScalar(1.6); g.add(s); reg.push([nm, 'switch', rn]);
    }
  }
  // motion sensor per named room (ceiling corner)
  for (const [name, x0, z0, x1, z1, fl, lab] of L.rooms) {
    if (!name || lab === false || ['Porch', 'Alfresco', 'Courtyard', 'Balcony', 'Patio', 'WIR', 'WIP'].includes(name)) continue;
    const nm = 'sensor_motion_' + slug(name);
    const m = mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), DEV.motion, false);
    m.rotation.x = Math.PI; m.position.set(x0 + 0.3, 2.95, z0 + 0.3); m.name = nm; g.add(m); reg.push([nm, 'binary_sensor', name]);
  }
  for (const [nm, x, z] of L.contacts || []) { const m = R(g, x - 0.05, 2.1, z - 0.05, x + 0.05, 2.2, z + 0.05, DEV.contact, 0.02); m.name = nm; reg.push([nm, 'binary_sensor', 'door']); }
  for (const [nm, x, z, deg, size] of L.screens || []) {
    const [w, h] = { L: [0.9, 0.55], M: [0.55, 0.35], S: [0.2, 0.14] }[size];
    const s = new THREE.Group(); s.name = nm;
    R(s, -w / 2 - 0.02, -h / 2 - 0.02, -0.015, w / 2 + 0.02, h / 2 + 0.02, 0.015, DEV.screenBody, 0.01);
    B(s, -w / 2, -h / 2, 0.015, w / 2, h / 2, 0.02, DEV.screenGlow);
    s.position.set(x, size === 'S' ? 1.1 : 1.45, z); s.rotation.y = THREE.MathUtils.degToRad(deg); g.add(s); reg.push([nm, 'screen', size]);
  }
  if (L.doors?.garage) {
    const [x0, z0, x1, z1] = L.doors.garage; const d = B(g, x0 - 0.06, 0, z0, x0 + 0.02, 2.7, z1, '#6d7680', { metalness: 0.4, roughness: 0.5 });
    d.name = 'cover_garage_door'; d.material = d.material.clone(); d.material.transparent = true; d.material.opacity = 0.55; reg.push(['cover_garage_door', 'cover', 'Garage']);
  }
  if (L.doors?.entry) { const [x0, z0, x1] = L.doors.entry; const d = R(g, x1, 0, z0 - 0.03, x0, 2.34, z0 + 0.03, '#3a2c22', 0.01); d.name = 'lock_entry_door'; reg.push(['lock_entry_door', 'lock', 'Entry']); }
  g.userData.registry = reg; return g;
}

function furnishGF(g) {
  place(g, F.car('#4d5d6f'), 3.0, 2.0, 0);
  place(g, F.car('#a9b1b9'), 3.0, 4.8, 0);
  R(g, 5.55, 0, 1.0, 6.05, 2.0, 3.2, '#bfbab1', 0.02);
  // Laundry
  place(g, F.bench(2.5, 0.6), 7.95, 2.0, -90);
  place(g, F.washer(), 7.95, 1.1, -90); place(g, F.washer('#e9e9e9'), 7.95, 1.75, -90);
  place(g, F.wardrobe(2.0, 0.4, 2.2, '#d8d2c8'), 6.4, 2.2, 90);
  // Ens 5 — 2400 double vanity on the west wall, WC behind the 1200H wall (north-east), shower south-east (plan p4)
  place(g, F.vanity(2.4, 0.5, 2), 8.77, 1.75, 90);
  place(g, F.shower(1.15, 1.05), 10.99, 2.62, 180);
  place(g, F.toilet(), 11.27, 0.4, 0);
  // WIR 5
  place(g, F.rail(2.8), 12.0, 1.7, 90); place(g, F.rail(2.8), 13.4, 1.7, -90);
  // Bed 5
  place(g, F.bed(1.53, 2.03, '#e9e6df', '#6b8fb3'), 15.05, 1.75, 90);
  place(g, F.rug(2.2, 1.6, '#cfc4b0'), 16.2, 1.75);
  place(g, F.sideboard(1.4), 18.8, 1.75, -90);
  place(g, F.tv(1.1, false), 18.95, 1.75, -90);
  place(g, F.plant(), 18.6, 0.4);
  // Hall / Entry
  place(g, F.sideboard(1.2, OAK), 6.4, 5.8, 90);
  place(g, F.plant(1.3), 8.0, 6.1);
  place(g, F.rug(7, 0.8, '#7d6a58', '#5e4f42'), 15.5, 4.2);
  // Spiral stair
  const st = new THREE.Group();
  for (let i = 0; i < 18; i++) { const a = Math.PI * 0.15 + i * (Math.PI * 1.25 / 18); const s = mesh(new RoundedBoxGeometry(1.25, 0.05, 0.36, 2, 0.015), std(OAK)); s.position.set(Math.cos(a) * 1.05, 0.18 * (i + 1), Math.sin(a) * 1.05); s.rotation.y = -a; st.add(s); }
  C(st, 0, 0, 0.12, 0, 3.3, '#e5e2dc');
  place(g, st, 10.5, 6.4, 0);
  // Media
  place(g, F.screen(2.6), 17.2, 6.4, -90);
  for (const z of [5.6, 6.6, 7.6]) { place(g, F.recliner('#39414d'), 14.6, z, 90); place(g, F.recliner('#39414d'), 13.3, z, 90); }
  place(g, F.rug(2.4, 3.0, '#56606e', '#444c57'), 15.6, 6.4);
  // Bath — 1000 vanity and WC on the west wall, 900x1500 shower across the south end (plan p4)
  place(g, F.vanity(1.0, 0.45), 17.58, 5.55, 90);
  place(g, F.shower(1.4, 1.3), 18.1, 7.3, 180);
  place(g, F.toilet(), 17.55, 6.35, 90);
  // Courtyard
  place(g, F.plant(1.5), 19.6, 0.5); place(g, F.plant(1.2), 21.5, 0.5); place(g, F.plant(1.0), 21.6, 3.2);
  place(g, F.armchair('#c9b99a'), 20.0, 2.2, 30); place(g, F.armchair('#c9b99a'), 21.3, 2.3, -30);
  place(g, F.table(0.6, 0.6, 0.45, '#8c7b66', '#555', true), 20.65, 2.8);
  // Alfresco
  place(g, F.dining(2.0, 0.95, 6, '#8a6b4d', '#2d3339'), 21.0, 6.4, 0);
  place(g, F.bbq(), 22.3, 7.75, 180);
  place(g, F.plant(1.2), 19.5, 7.7);
  // WIP
  place(g, F.bench(2.3, 0.6), 23.25, 0.3, 0);
  place(g, F.shelf(2.2, 0.45, 2.0), 22.3, 2.0, 90);
  place(g, F.wine(), 24.15, 2.8, -90);
  // Kitchen
  place(g, F.bench(5.6, 0.65), 27.4, 0.33, 0);
  R(g, 25.6, 0.9, 0.08, 26.5, 0.915, 0.58, '#151515', 0.01);
  const sink = B(g, 27.9, 0.9, 0.12, 28.7, 0.905, 0.52, '#9aa3ab', { metalness: 0.8, roughness: 0.2 });
  place(g, F.fridge(), 30.0, 0.4, 0);
  R(g, 24.55, 0, 2.3, 25.15, 2.3, 3.7, '#f5f5f3', 0.01);
  place(g, F.bench(3.2, 1.2, 0.92, '#f1efe9', '#3a3f45'), 27.9, 2.55, 0);
  for (const x of [26.8, 27.5, 28.2, 28.9]) place(g, F.stool(), x, 3.45);
  for (const x of [27.1, 28.7]) place(g, F.pendant(2.2, '#2d3339', 0.2), x, 2.55);
  // Dining
  place(g, F.dining(2.4, 1.05, 8, '#6f4f37', '#d8d0c3'), 32.1, 2.4, 0);
  place(g, F.pendant(2.2, '#e8d9b8', 0.35), 32.1, 2.4);
  place(g, F.sideboard(1.8), 32.1, 0.3, 0);
  // Living
  place(g, F.rug(3.4, 2.6, '#b9ad99'), 36.3, 2.4);
  place(g, F.lsofa(3.0, 2.3, '#77828f'), 36.2, 0.65, 0);
  place(g, F.table(1.2, 0.7, 0.4, '#4b3a2c'), 36.2, 2.3);
  place(g, F.tv(1.9), 36.3, 4.7, 180);
  place(g, F.armchair('#a07e5d'), 34.6, 3.3, 110);
  place(g, F.plant(1.6), 38.3, 0.4); place(g, F.plant(1.2), 34.3, 4.6);
  // Pool
  const pool = mesh(new THREE.BoxGeometry(9.7, 0.06, 2.7), std(MAT.water, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 }), false);
  pool.position.set(33.3, 0.03, 6.6); pool.name = 'pool'; g.add(pool);
  B(g, 28.2, -0.01, 5.1, 38.45, 0.02, 8.1, '#d9d3c7');
  place(g, F.lounger(), 25.0, 6.9, 0); place(g, F.lounger(), 26.2, 6.9, 0);
  place(g, F.table(0.45, 0.45, 0.4, '#8c7b66', '#555', true), 25.6, 6.3);
}

function furnishFF(g) {
  // Balcony
  place(g, F.armchair('#c9b99a'), -0.1, 2.4, 90); place(g, F.armchair('#c9b99a'), -0.1, 3.9, 90);
  place(g, F.table(0.5, 0.5, 0.45, '#8c7b66', '#555', true), -0.2, 3.15);
  place(g, F.plant(1.2), -0.55, 1.0); place(g, F.plant(1.2), -0.55, 6.1);
  // Master Bed 1
  place(g, F.bed(1.83, 2.03, '#ede8df', '#8f6a4f'), 3.55, 1.6, 0);
  place(g, F.rug(3.2, 2.4, '#d4c8b4'), 3.55, 2.7);
  place(g, F.tv(1.4, true), 3.55, 6.05, 180);
  place(g, F.armchair('#b09a7d'), 1.9, 4.9, 45);
  place(g, F.table(0.45, 0.45, 0.5, '#4b3a2c', '#333', true), 2.6, 5.5);
  // WIR 1
  place(g, F.rail(2.5), 6.4, 2.0, 90); place(g, F.rail(2.5), 7.95, 2.0, -90);
  R(g, 6.95, 0, 1.3, 7.4, 0.9, 2.7, '#e2dccf', 0.02);
  place(g, F.rail(1.8), 7.2, 5.95, 180);
  // Ens 1 — freestanding bath (west), 1920x1300 shower beside the WC, 2100 double vanity facing south (plan p5)
  place(g, F.bath(1.7, 0.8), 9.6, 0.85, 0);
  place(g, F.vanity(2.1, 0.5, 2), 10.55, 2.37, 0);
  place(g, F.shower(1.15, 1.95), 11.02, 1.0, 0);
  place(g, F.toilet(), 12.24, 0.35, 0);
  // Ens 2 — 1500 vanity and WC on the west wall, 1000x1600 shower across the south end
  place(g, F.vanity(1.5, 0.5, 1), 13.0, 0.85, 90);
  place(g, F.shower(1.5, 1.0), 13.55, 3.08, 180);
  place(g, F.toilet(), 13.0, 2.2, 90);
  // Bed 2
  place(g, F.bed(1.53, 2.03, '#e9e6df', '#b36b5a'), 16.9, 1.2, 0);
  place(g, F.wardrobe(1.8, 0.6, 2.2), 15.4, 3.2, 180);
  place(g, F.plant(), 18.5, 3.2);
  // Bed 3
  place(g, F.bed(1.53, 2.03, '#e9e6df', '#7a8e6b'), 23.6, 1.2, 0);
  place(g, F.desk(1.1, 0.5, '#d9d0c1'), 25.2, 2.9, 180); place(g, F.chair('#7a8e6b'), 25.2, 2.4, 180);
  // Ens 3 — 1500 vanity and WC on the east wall, 1000x1500 shower across the south end
  place(g, F.vanity(1.5, 0.5, 1), 27.68, 0.85, -90);
  place(g, F.shower(1.5, 1.0), 27.16, 3.08, 180);
  place(g, F.toilet(), 27.7, 2.15, -90);
  // Ens 4 — 1100x1500 shower at the west end, WC, 1200 vanity on the north wall
  place(g, F.vanity(1.2, 0.5, 1), 30.8, 0.3, 0);
  place(g, F.shower(1.5, 1.1), 28.55, 0.8, 90);
  place(g, F.toilet(), 29.65, 0.4, 0);
  // Hazel's Office (Bed 4 / Study)
  place(g, F.desk(1.8, 0.75, '#e9e3d8', 1), 32.5, 0.55, 0); place(g, F.officeChair(), 32.5, 1.2, 0);            // study nook
  const exec = F.desk(2.0, 0.9, '#6f4f37', 2); place(g, exec, 31.3, 3.2, 180);                                    // executive desk facing door
  R(exec, 0.6, 0, -0.45, 1.0, 0.72, 0.9, '#6f4f37', 0.01);                                                        // L return
  place(g, F.officeChair('#2b2f36'), 31.3, 2.45, 180);
  place(g, F.chair('#8a96a4'), 30.8, 4.25, 0); place(g, F.chair('#8a96a4'), 31.8, 4.25, 0);                 // client chairs
  place(g, F.shelf(2.4, 0.4, 2.1, '#e6e0d4'), 28.2, 3.0, 90);
  place(g, F.sofa(1.8, 0.85, '#8a6f5a'), 29.35, 2.05, 0);
  place(g, F.table(0.6, 0.6, 0.45, '#4b3a2c', '#333', true), 29.35, 3.1);
  R(g, 33.2, 0, 1.8, 33.62, 0.75, 2.8, '#3b4452', 0.02); R(g, 33.25, 0.75, 2.0, 33.58, 0.95, 2.5, '#d9dde2', 0.02); // credenza + printer
  place(g, F.plant(1.4), 28.3, 4.6); place(g, F.plant(1.0), 33.4, 4.6);
  place(g, F.rug(2.6, 2.0, '#9aa5b1', '#7c8793'), 31.0, 3.4);
  // Hall
  place(g, F.rug(12, 0.8, '#7d6a58', '#5e4f42'), 20.5, 4.3);
  // Lounge
  place(g, F.lsofa(2.8, 2.0, '#5b6b7c'), 15.4, 7.45, 180);
  place(g, F.table(1.1, 0.6, 0.4, '#4b3a2c'), 15.4, 6.1);
  place(g, F.tv(1.6), 15.4, 5.3, 0);
  place(g, F.rug(3.2, 2.2), 15.4, 6.5);
  place(g, F.armchair(), 13.3, 6.6, 90);
  place(g, F.plant(1.3), 18.5, 5.4);
  // Stair top
  const st = new THREE.Group();
  for (let i = 0; i < 4; i++) { const a = Math.PI * 1.1 + i * 0.22; const s = mesh(new RoundedBoxGeometry(1.25, 0.05, 0.36, 2, 0.015), std(OAK)); s.position.set(Math.cos(a) * 1.05, -0.2 * (4 - i), Math.sin(a) * 1.05); s.rotation.y = -a; st.add(s); }
  place(g, st, 10.45, 6.5, 0);
  // Patio
  place(g, F.lounger(), 20.0, 6.6, 180); place(g, F.lounger(), 21.0, 6.6, 180);
  place(g, F.table(0.45, 0.45, 0.4, '#8c7b66', '#555', true), 22.2, 6.5);
  place(g, F.plant(1.3), 22.6, 7.7);
}

// ---------- app ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, 1, 0.5, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight('#dfe9ff', '#2a2622', 1.15));
const sun = new THREE.DirectionalLight('#fff4e0', 2.0);
sun.position.set(12, 34, 18); sun.target.position.set(19, 0, 4);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 14, bottom: -14, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const levels = { gf: buildLevel(GF), ff: buildLevel(FF) };
furnishGF(levels.gf); furnishFF(levels.ff);
levels.gf.add(buildDevices(GF, 'gf')); levels.ff.add(buildDevices(FF, 'ff'));
scene.add(levels.gf, levels.ff);

const VIEWS = { top: { az: -6, el: 72 }, front: { az: -10, el: 50 }, street: { az: -58, el: 42 }, plan: { az: 0, el: 89.5 } };
let curView = 'top';
const state = { level: 'gf', labels: true, bg: true, cut: true, devices: true };
function levelBox() {
  const L = levels[state.level]; const hide = ['labels', 'devices'].map(n => L.getObjectByName(n)); hide.forEach(o => o.visible = false);
  const box = new THREE.Box3(); L.traverseVisible(o => { if (o.isMesh && o.name !== 'site_pad') box.expandByObject(o); });
  box.min.y = 0; box.max.y = state.cut ? 1.5 : H_EXT; apply(); return box;
}
function setView(v) {
  curView = v; const c = VIEWS[v]; const box = levelBox();
  const tgt = box.getCenter(new THREE.Vector3()); tgt.y = 0;
  const az = THREE.MathUtils.degToRad(c.az), el = THREE.MathUtils.degToRad(c.el);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pts = []; for (const x of [box.min.x, box.max.x]) for (const y of [0, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  let d = 60;
  for (let i = 0; i < 6; i++) {
    camera.position.copy(tgt).addScaledVector(dir, d); camera.lookAt(tgt); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const p of pts) { const q = p.clone().project(camera); mnx = Math.min(mnx, q.x); mxx = Math.max(mxx, q.x); mny = Math.min(mny, q.y); mxy = Math.max(mxy, q.y); }
    const ray = new THREE.Vector3((mnx + mxx) / 2, (mny + mxy) / 2, 0.5).unproject(camera).sub(camera.position).normalize();
    const hit = camera.position.clone().addScaledVector(ray, -camera.position.y / ray.y); tgt.copy(hit); tgt.y = 0;
    d *= Math.max((mxx - mnx) / 2 / 0.95, (mxy - mny) / 2 / 0.88);
  }
  camera.position.copy(tgt).addScaledVector(dir, d); controls.target.copy(tgt); controls.update();
}
function setCutaway(on) {
  for (const L of Object.values(levels)) L.traverse(o => {
    if (o.userData.kind === 'int') { o.scale.y = on ? H_CUT / H_INT : 1; o.position.y = (on ? H_CUT : H_INT) / 2; }
    if (o.userData.kind === 'hdr' || o.userData.kind === 'leaf') o.visible = !on;
  });
}
function apply() {
  levels.gf.visible = state.level === 'gf'; levels.ff.visible = state.level === 'ff';
  for (const L of Object.values(levels)) { L.getObjectByName('labels').visible = state.labels; L.getObjectByName('devices').visible = state.devices; }
  scene.background = state.bg ? new THREE.Color('#11151c') : null;
  setCutaway(state.cut);
  const tog = (id, v) => document.getElementById(id)?.classList.toggle('on', v);
  document.querySelectorAll('[data-level]').forEach(b => b.classList.toggle('on', b.dataset.level === state.level));
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === curView));
  tog('lbl', state.labels); tog('cut', state.cut); tog('dev', state.devices);
}
document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { state.level = b.dataset.level; apply(); setView(curView); apply(); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); apply(); });
document.getElementById('cut').onclick = () => { state.cut = !state.cut; apply(); };
document.getElementById('lbl').onclick = () => { state.labels = !state.labels; apply(); };
document.getElementById('dev').onclick = () => { state.devices = !state.devices; apply(); };

function exportGLB(key) {
  return new Promise((res) => {
    const L = levels[key]; const lab = L.getObjectByName('labels'); const was = L.visible; const dv = L.getObjectByName('devices').visible;
    L.remove(lab); L.visible = true; L.getObjectByName('devices').visible = true;
    // export only what is visible in cutaway mode (no door leaves / headers)
    const hidden = []; L.traverse(o => { if (!o.visible) hidden.push(o); });
    const tmp = []; hidden.forEach(o => { tmp.push([o, o.parent]); o.parent.remove(o); });
    new GLTFExporter().parse(L, (buf) => { tmp.forEach(([o, p]) => p.add(o)); L.add(lab); L.visible = was; L.getObjectByName('devices').visible = dv; res(buf); },
      (e) => { console.error(e); res(null); }, { binary: true });
  });
}
const registry = () => ({ gf: levels.gf.getObjectByName('devices').userData.registry, ff: levels.ff.getObjectByName('devices').userData.registry });
document.getElementById('glb').onclick = async () => {
  const buf = await exportGLB(state.level);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  a.download = `179YoungSt_${state.level.toUpperCase()}.glb`; a.click();
};
window.__app = { state, apply, setView, exportGLB, registry, renderer, scene, camera, controls };

function resize() { const w = app.clientWidth, h = app.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); setView(curView); }
window.addEventListener('resize', resize);
apply(); resize(); apply();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
