import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 600;
const H = 340;
const AZIMUTH = 68;
const ELEVATION = 40;
const PI = Math.PI;

// World units are millimetres. The shell, the pod and the coil head are cut through their
// middle at ZC and seen from above; the cell and the boards inside are drawn whole.
const ZC = 7;
const OUT = { w: 24, h: 14, r: 5 };
const IN = { w: 22, h: 12, r: 4 };
const POD_IN = { w: 20.2, h: 10.2, r: 3.1 };
const MOUTH = { w: 17, h: 9, r: 3.8, bore: 2.6 };
const CAP = 2.5;
const BODY_END = 89.4;
const PB = 77.4;
const POD_X = { lower: PB + 12, end: PB + 31, upper: PB + 32.4, tip: PB + 44 };
const COIL = { grommet: [3.6, 4.3], housing: [3.1, 3.6], cotton: [1.9, 3.1], mesh: [1.6, 1.9], hole: 1, cap: [1.2, 3.6], chimney: [1.2, 1.9] };
const PORT = [PB + 4, PB + 7];
const BOARD = { x0: 2.6, x1: 74, y: 7, z0: 1, z1: 1.8 };
const CELL = { x0: 11, x1: 57, y: 9.5, z0: 2.6, z1: 11.6 };
const SEAL = { x1: 59.5, z0: 6.8, z1: 7.4 };
const PCM = { x0: 60.6, x1: 61.4, y: 8, z0: 3, z1: 11 };
const BLOCK = [74, 77];
const PAD_Z = -1;
const PLATE = { x: -5, y: -14.5, w: 161, d: 34, r: 3.5 };
const PLATE_H = 3.2;
const FOOT_H = 2.2;
const PADS = [{ x: 18, y: -8, w: 14, d: 16, r: 2 }, { x: 94, y: -8, w: 14, d: 16, r: 2 }];

const PIECES = {
  pod: { name: "Pod and mouthpiece", say: `pod · ${M.POD.ml} ml round a chimney`, move: [30, 0, 0] },
  coil: { name: "Coil head", say: `coil head · ${M.COIL.ohms} Ω mesh in cotton`, move: [14, 0, 0] },
  cell: { name: "Cell", say: `cell · ${M.CELL.mAh.toLocaleString("en-US")} mAh LiPo · ${M.CELL.nominal} V`, move: [0, 0, 16] },
  board: { name: "Board and cradle", say: "board · sensor, MCU, MOSFET, USB-C", move: [0, 0, 8] },
  shell: { name: "Shell", say: "shell · aluminium sleeve, cut open", move: [0, 0, 0] },
};
const STAGGER = ["pod", "coil", "cell", "board", "shell"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, PAD_Z - PLATE_H - FOOT_H, PAD_Z),
    ...k.boxCorners({ x: 0, y: -12, w: POD_X.tip + PIECES.pod.move[0], d: 24 }, 0, 14),
    [CELL.x0, -CELL.y, CELL.z1 + PIECES.cell.move[2]],
    [CELL.x1, -CELL.y, CELL.z1 + PIECES.cell.move[2]],
  ],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const record = R.solid;
function put(piece, name, ref, svg, shapes = [], { bias = 0, cls = "" } = {}) {
  R.put({ piece, ride: piece, name: R.nameFor(name), at: ref, bias, svg: cls ? `<g class="${cls}">${svg}</g>` : svg, move: PIECES[piece].move, shapes });
}

const signed = (poly) => poly.reduce((a, [x, y], i) => {
  const [x2, y2] = poly[(i + 1) % poly.length];
  return a + x * y2 - x2 * y;
}, 0);
const screenOriented = (pts) => (signed(pts) < 0 ? [...pts].reverse() : pts);
function runsOf(flags, want) {
  const count = flags.length;
  const runs = [];
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  let run = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index] === want) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

// A prism of any (also concave) section, extruded along the frame's axis: the cut shells.
function prismPaths(F, poly, s0, s1) {
  const ring = signed(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length;
  const W3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
  const capNear = G.dot3(F.a, V) > 0;
  const [nearS, farS] = capNear ? [s1, s0] : [s0, s1];
  const near = ring.map((p) => at(W3(nearS, p)));
  const far = ring.map((p) => at(W3(farS, p)));
  const normals = ring.map(([x0, y0], i) => {
    const [x1, y1] = ring[(i + 1) % n];
    return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
  });
  const facing = normals.map((m) => G.dot3(m, V) > 1e-9);
  const outline = [];
  const crease = [];
  for (const run of runsOf(facing, false)) outline.push(k.pathOf(run.map((i) => near[i])));
  for (const run of runsOf(facing, true)) {
    crease.push(k.pathOf(run.map((i) => near[i])));
    outline.push(k.pathOf(run.map((i) => far[i])));
  }
  for (let i = 0; i < n; i++) {
    const before = (i + n - 1) % n;
    if (facing[before] !== facing[i]) outline.push(k.pathOf([near[i], far[i]]));
    else if (facing[i] && G.dot3(normals[before], normals[i]) < 0.8) crease.push(k.pathOf([near[i], far[i]]));
  }
  const parts = [k.pathOf(screenOriented(near), true), k.pathOf(screenOriented(far), true)];
  const buckets = [[], [], [], [], []];
  for (let i = 0; i < n; i++) {
    if (!facing[i]) continue;
    const quad = screenOriented([near[i], near[(i + 1) % n], far[(i + 1) % n], far[i]]);
    parts.push(k.pathOf(quad, true));
    buckets[G.toneOf(normals[i], P)].push(k.pathOf(quad, true));
  }
  const capTone = G.toneOf(capNear ? F.a : G.mul3(F.a, -1), P);
  buckets[capTone].push(k.pathOf(screenOriented(near), true));
  return { fill: parts.join(""), outline: outline.join(""), crease: crease.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((b) => b.join("")) };
}

const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const centroid = (poly) => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
function xprism(piece, name, poly, x0, x1, style = {}, { inner = "", extra = "", bias = 0, cls = "", bare = false } = {}) {
  const id = `${piece}.${name}`;
  const shape = record(A.prism(XF, poly, x0, x1, { name: id }));
  const [cy, cz] = centroid(poly);
  const paths = prismPaths(XF, poly, x0, x1);
  if (bare) Object.assign(paths, { outline: "", crease: "" });
  put(piece, id, [(x0 + x1) / 2, cy, cz], S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, cls });
}
function box(piece, name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.15, steps = 2, bevel = 0, inner = "", extra = "", bias = 0, cls = "" } = {}) {
  const id = `${piece}.${name}`;
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name: id }, steps));
  put(piece, id, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, cls });
}
function zcyl(piece, name, cx, cy, r, z0, h, style = {}, { steps = 32, bevel = 0, inner = "", extra = "", bias = 0, cls = "" } = {}) {
  const id = `${piece}.${name}`;
  const shape = record(A.cylinder(cx, cy, r, z0, h, { name: id }));
  put(piece, id, [cx, cy, z0 + h / 2], S(k.cylinder(cx, cy, r, z0, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, cls });
}
function xdisc(piece, name, x0, x1, cy, cz, r, style = {}, { extra = "", bias = 0, cls = "" } = {}) {
  const id = `${piece}.${name}`;
  const F = G.frameOf([0, cy, cz], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const shape = record(A.disc(F, x0, x1, r, { name: id }));
  put(piece, id, [(x0 + x1) / 2, cy, cz], S(G.disc(x0, x1, r, F, P, { steps: 28 }), { tone: "mid", ...style }) + extra, [shape], { bias, cls });
}

// Sections in (y, z): the lower half of a rounded rectangle centred on the cut plane.
const arc = (cy, cz, r, a0, a1, n = 8) => (r <= 0 ? [[cy, cz]] : Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cy + r * Math.cos(a), cz + r * Math.sin(a)];
}));
const z0Of = (s) => ZC - s.h / 2;
const dedupe = (poly) => poly.filter((p, i) => {
  const q = poly[(i + poly.length - 1) % poly.length];
  return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
});
function chain(s, n = 8) {
  const y = s.w / 2;
  const z0 = z0Of(s);
  return dedupe([[-y, ZC], ...arc(-y + s.r, z0 + s.r, s.r, PI, 1.5 * PI, n), ...arc(y - s.r, z0 + s.r, s.r, 1.5 * PI, 2 * PI, n), [y, ZC]]);
}
const mirror = (poly) => poly.map(([y, z]) => [-y, z]).reverse();
// Where a surface round the x axis turns away from the viewer. Every cut shell is split there:
// a piece behind what it holds (its far side and the bottom up to this angle) and a piece in
// front of it (the near side beyond it), so nested sections order without interlocking.
const TT = Math.atan2(-V[1], V[2]) + 2 * PI;
const polar = ([y, z]) => {
  const a = Math.atan2(z - ZC, y);
  return a <= 1e-9 ? a + 2 * PI : a;
};
function rayOut(s) {
  const y = s.w / 2;
  const z0 = z0Of(s);
  const inside = (py, pz) => {
    if (Math.abs(py) > y || pz < z0) return false;
    if (Math.abs(py) > y - s.r && pz < z0 + s.r) return (Math.abs(py) - (y - s.r)) ** 2 + (pz - z0 - s.r) ** 2 <= s.r * s.r;
    return true;
  };
  let lo = 0;
  let hi = s.w;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inside(mid * Math.cos(TT), ZC + mid * Math.sin(TT))) lo = mid;
    else hi = mid;
  }
  return [lo * Math.cos(TT), ZC + lo * Math.sin(TT)];
}
function uPieces(o, i, n = 8) {
  const yo = o.w / 2;
  const yi = i.w / 2;
  const cy = yo - o.r;
  const cz = z0Of(o) + o.r;
  return {
    far: dedupe([[-yo, ZC], ...arc(-cy, cz, o.r, PI, 1.5 * PI, n), ...arc(-cy, cz, i.r, 1.5 * PI, PI, n), [-yi, ZC]]),
    floor: dedupe([[-cy, z0Of(o)], ...arc(cy, cz, o.r, 1.5 * PI, TT, n), ...arc(cy, cz, i.r, TT, 1.5 * PI, n), [-cy, z0Of(i)]]),
    near: dedupe([...arc(cy, cz, o.r, TT, 2 * PI, n), [yo, ZC], [yi, ZC], ...arc(cy, cz, i.r, 2 * PI, TT, n)]),
  };
}
// A cut plate of section s round a notch of radius rn on the axis: its far half, the wedge
// under the notch's near side, and the near front.
function plateParts(s, rn, n = 8) {
  const c = chain(s, n);
  const X = rayOut(s);
  const notchAt = [rn * Math.cos(TT), ZC + rn * Math.sin(TT)];
  const nearC = c.filter(([y]) => y > 0);
  const far = dedupe([...c.filter(([y]) => y < 0), [0, z0Of(s)], ...arc(0, ZC, rn, 1.5 * PI, PI, 10)]);
  const wedge = dedupe([[-0.04, z0Of(s)], ...nearC.filter((p) => polar(p) < TT), X, notchAt, ...arc(0, ZC, rn, TT, 1.5 * PI, 8).slice(1), [-0.04, ZC - rn]]);
  const near = dedupe([X, ...nearC.filter((p) => polar(p) > TT), ...arc(0, ZC, rn, 2 * PI, TT, 8)]);
  return { far, wedge, near };
}
// The liquid round a notch: behind what sits in the notch, and in front of it.
function liquidParts(s, rn, n = 8) {
  const c = chain(s, n);
  const X = rayOut(s);
  const notchAt = [rn * Math.cos(TT), ZC + rn * Math.sin(TT)];
  return {
    back: dedupe([...c.filter((p) => p[0] < 0 || (p[0] >= 0 && polar(p) < TT)), X, notchAt, ...arc(0, ZC, rn, TT, PI, 14).slice(1)]),
    front: dedupe([X, ...c.filter((p) => p[0] > 0 && polar(p) > TT), ...arc(0, ZC, rn, 2 * PI, TT, 8)]),
  };
}
// A cut tube between radii r0 and r1, in its back and front pieces.
const band = (r0, r1, a0, a1, n = 10) => dedupe([...arc(0, ZC, r1, a0, a1, n), ...arc(0, ZC, r0, a1, a0, n)]);
const tubeParts = (r0, r1) => ({ back: band(r0, r1, PI, TT), front: band(r0, r1, TT, 2 * PI, 6) });
function roundRect(w, h, r, cz, n = 6) {
  const y = w / 2;
  const z0 = cz - h / 2;
  const z1 = cz + h / 2;
  return dedupe([...arc(y - r, z0 + r, r, 1.5 * PI, 2 * PI, n), ...arc(y - r, z1 - r, r, 0, 0.5 * PI, n), ...arc(-y + r, z1 - r, r, 0.5 * PI, PI, n), ...arc(-y + r, z0 + r, r, PI, 1.5 * PI, n)]);
}
// The visible part of a piece's outside at x: a band, seam or lip on the same facets as the
// prism, so it ends exactly on the piece's silhouette and on the cut face's edge.
function seamOn(poly, x) {
  const ring = signed(poly) > 0 ? poly : [...poly].reverse();
  const n = ring.length;
  const flags = ring.map(([y0, z0], i) => {
    const [y1, z1] = ring[(i + 1) % n];
    const top = Math.abs(z0 - ZC) < 1e-6 && Math.abs(z1 - ZC) < 1e-6;
    return !top && G.dot3([0, z1 - z0, -(y1 - y0)], V) > 1e-9;
  });
  return runsOf(flags, true).map((run) => path3(run.map((i) => [x, ...ring[i]]))).join("");
}
const onFace = (y, points) => path3(points.map(([x, z]) => [x, y, z]), true);
const slot = (y, x0, x1, z0, z1) => onFace(y, k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r: Math.min(x1 - x0, z1 - z0) / 2 }, 4));

// ---- stand: a bench plate with feet, a millimetre rule from the device's end, two pads ----
const back = [];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const PLATE_Z = PAD_Z - PLATE_H;
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, PLATE_Z - FOOT_H, PLATE_H, P)}"/>`);
for (const [x, y] of byDepth(k.corners(PLATE, 9))) {
  back.push(S(k.cylinder(x, y, 3.4, PLATE_Z - FOOT_H, 0.7, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 2.6, PLATE_Z - FOOT_H + 0.7, FOOT_H - 0.7, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, PLATE_Z, PLATE_H, P, 8, 0.7), { tone: "mid", inner: Ln(k.sideSeam(PLATE, PLATE_Z + 1.2, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 2.2), PAD_Z, P), { tone: "lo" }));
const plateScrews = k.corners(PLATE, 4.6);
back.push(Ln(plateScrews.map(([x, y]) => k.ring(x, y, 1.0, PAD_Z, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(plateScrews.map(([x, y]) => at([x, y, PAD_Z])), { size: 0.5 }));
record(A.slab(PLATE, PLATE_Z, PLATE_H, { name: "stand.plate", ground: true }, 8));
const RULE = { x: -3, y: PLATE.y + PLATE.d - 5.6, w: 156, d: 3.2, r: 0.5 };
back.push(S(k.slabOf(RULE, PAD_Z, 0.3, P, 3), { tone: "lo", crease: "none" }));
{
  const t = k.topTicks(0, 150, 1, 10, RULE.y, PAD_Z + 0.3, [0.9, 2.1], P);
  back.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  back.push(Ln(k.lineOnTop([0, RULE.y], [0, RULE.y + 2.6], PAD_Z + 0.3, P), { tone: "hi" }));
}
const LABEL = { x: 128, y: PLATE.y + 2.6, w: 22, d: 7.4, r: 0.8 };
back.push(S(k.slabOf(LABEL, PAD_Z, 0.4, P, 3), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 0.8), PAD_Z + 0.4, P, 3), { tone: "faint" }));
back.push(Ln([15, 10, 12].map((w, i) => k.lineOnTop([LABEL.x + 2.2, LABEL.y + 2 + i * 2], [LABEL.x + 2.2 + w, LABEL.y + 2 + i * 2], PAD_Z + 0.4, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w - 1.8, LABEL.y + 1.6, PAD_Z + 0.4]), at([LABEL.x + LABEL.w - 1.8, LABEL.y + LABEL.d - 1.6, PAD_Z + 0.4])], { size: 0.45 }));
back.push(`<path class="iso-halo" d="${k.haloOf({ x: 0, y: -11, w: POD_X.tip, d: 22, r: 5 }, 0, 4, P)}"/>`);
for (const pad of PADS) {
  back.push(S(k.slabOf(pad, PAD_Z, 1, P, 4, 0.3), { tone: "lo" }));
  record(A.slab(pad, PAD_Z, 1, { name: "stand.pad", ground: true }, 4));
}

// ---- shell: the anodised sleeve and its end cap, cut through the middle ----
{
  xprism("shell", "cap", chain(OUT), 0, CAP, { tone: "mid" }, { inner: Ln(seamOn(chain(OUT), 1.2), { tone: "faint" }) });
  const u = uPieces(OUT, IN);
  xprism("shell", "sleeve.far", u.far, CAP, BODY_END, { tone: "mid" });
  xprism("shell", "sleeve.floor", u.floor, CAP, BODY_END, { tone: "mid" });
  const LED_AT = [75.5, OUT.w / 2, 6.1];
  const nearInner = [
    Ln(seamOn(u.near, BODY_END - 0.8), { tone: "faint" }),
    `<path class="vp-dark" d="${slot(OUT.w / 2, 79.6, 84.6, 5.5, 6.6)}"/>`,
    Ln(slot(OUT.w / 2, 79.6, 84.6, 5.5, 6.6), { tone: "lo" }),
    `<path class="vp-dark" d="${k.sideRing(LED_AT, 0.45, "y", P)}"/>`,
    Ln(k.sideRing(LED_AT, 0.45, "y", P), { tone: "lo" }),
  ].join("");
  xprism("shell", "sleeve.near", u.near, CAP, BODY_END, { tone: "mid" }, {
    inner: nearInner,
    extra: `<g class="vp-led" data-part="led">${Dots([at(LED_AT)], { size: 1.1, tone: "hi" })}</g>`,
  });
}

// ---- board: one long PCB on the floor, USB-C at the bottom, sensor and MOSFET at the top,
// and the plastic cradle the pod clicks into ----
{
  const top = BOARD.z1;
  const silk = (x0, y0, x1, y1) => k.planOutline({ x: x0 - 0.3, y: y0 - 0.3, w: x1 - x0 + 0.6, d: y1 - y0 + 0.6, r: 0.2 }, top, P, 2);
  const vias = [[11.5, -1.6], [11.5, 0], [11.5, 1.6], [59.8, -1.6], [59.8, 0], [59.8, 1.6], [61.6, 5.6], [61.6, -5.6], [73.4, -1.0], [66.2, 6.2]];
  const traces = [-1.6, 0, 1.6].map((y) => k.lineOnTop([11.5, y], [59.8, y], top, P)).join("");
  const inner = [
    Ln([silk(4, 5.2, 7, 6.8), silk(3.2, -6.6, 4.8, -5.8), silk(5.4, -6.6, 7, -5.8), silk(62.6, -2.2, 64.4, 2.2), silk(64.8, -6.4, 69.6, -2.6), silk(70.4, -6.4, 73.6, -3.2)].join(""), { tone: "faint" }),
    Ln(k.ring(69, 3.6, 3.75, top, P, 32), { tone: "faint" }),
    Ln(traces, { tone: "faint" }),
  ].join("");
  box("board", "pcb", [BOARD.x0, -BOARD.y, BOARD.z0], [BOARD.x1, BOARD.y, BOARD.z1], { tone: "mid" }, {
    r: 0.6,
    steps: 3,
    inner,
    extra: Dots(vias.map(([x, y]) => at([x, y, top])), { size: 0.45, tone: "mid" }) + Dots([[3.6, 6.2], [72.8, 6.2], [3.6, -6.2]].map(([x, y]) => at([x, y, top])), { size: 0.7, tone: "lo" }),
  });
  const usb = roundRect(8.94, 3.2, 1.6, top + 1.6);
  xprism("board", "usb-c", usb, CAP, 9.8, { tone: "hi" }, { inner: Ln(path3([[CAP, 0, top + 3.2], [9.8, 0, top + 3.2]]), { tone: "faint" }) });
  for (const x of [3.6, 8.4]) for (const s of [-1, 1]) box("board", "usb-c.tab", [x - 0.5, s > 0 ? 4.47 : -5.27, top], [x + 0.5, s > 0 ? 5.27 : -4.47, top + 0.9], { tone: "mid" }, { r: 0.1 });
  box("board", "charger", [4, 5.2, top], [7, 6.8, top + 1.1], { tone: "lo" }, { r: 0.12, extra: Dots([at([4.4, 5.6, top + 1.1])], { size: 0.35, tone: "mid" }) });
  for (const [x0, x1] of [[3.2, 4.8], [5.4, 7]]) box("board", "cap", [x0, -6.6, top], [x1, -5.8, top + 0.6], { tone: "hi" }, { r: 0.08 });
  box("board", "header", [62.6, -2.2, top], [64.4, 2.2, top + 0.8], { tone: "lo" }, { r: 0.1 });
  zcyl("board", "sensor", 69, 3.6, 3.4, top, 3.4, { tone: "lo" }, {
    cls: "vp-sensor",
    extra: Ln(k.ring(69, 3.6, 2.1, top + 3.4, P, 32), { tone: "mid" }) + Ln(k.ring(69, 3.6, 0.9, top + 3.4, P, 24), { tone: "lo" }) + Dots([at([69, 3.6, top + 3.4])], { size: 0.5, tone: "mid" }),
  });
  const legs = [];
  for (const x of [65.4, 66.67, 67.94, 69.2]) for (const [y0, y1] of [[-7, -6.4], [-2.6, -2.0]]) legs.push([x, y0, y1]);
  for (const [x, y0, y1] of legs) box("board", "mcu.leg", [x - 0.2, y0, top], [x + 0.2, y1, top + 0.45], { tone: "hi" }, { r: 0.05 });
  box("board", "mcu", [64.8, -6.4, top], [69.6, -2.6, top + 1.5], { tone: "lo" }, { r: 0.2, bevel: 0.15, extra: Dots([at([65.4, -3.2, top + 1.5])], { size: 0.45, tone: "mid" }) });
  box("board", "mosfet", [70.4, -6.4, top], [73.6, -3.2, top + 0.9], { tone: "lo" }, { r: 0.15, bevel: 0.12, inner: Ln(k.planOutline({ x: 71, y: -5.8, w: 2, d: 2, r: 0.2 }, top + 0.9, P, 2), { tone: "faint" }), extra: Dots([at([70.9, -3.7, top + 0.9])], { size: 0.35, tone: "mid" }) });
  for (const [x0, y0] of [[62.8, 3.4], [62.8, 5.2], [72.8, 0.6], [70.6, -2.4], [66.2, -1.6]]) box("board", "passive", [x0, y0, top], [x0 + 1.6, y0 + 0.8, top + 0.5], { tone: "hi" }, { r: 0.06 });
  const block = roundRect(IN.w, IN.h, IN.r, ZC, 8);
  const face = BLOCK[1];
  const blockExtra = [
    `<path class="vp-dark" d="${k.sideRing([face, 0, 4.2], 0.9, "x", P)}"/>`,
    Ln(k.sideRing([face, 0, 4.2], 0.9, "x", P), { tone: "lo" }),
    Ln(k.ring(75.5, -8.6, 0.7, IN.h + 1, P, 16) + k.ring(75.5, 8.6, 0.7, IN.h + 1, P, 16), { tone: "lo" }),
    Dots([at([75.5, -8.6, IN.h + 1]), at([75.5, 8.6, IN.h + 1])], { size: 0.45 }),
  ].join("");
  xprism("board", "cradle", block, BLOCK[0], BLOCK[1], { tone: "mid" }, { extra: blockExtra });
  for (const y of [-7.2, 7.2]) {
    const F = G.frameOf([0, y, ZC], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    xdisc("board", "magnet", face, face + 0.4, y, ZC, 2, { tone: "hi" }, { extra: Ln(G.circleOf(F, face + 0.4, 1.45, P, 40), { tone: "lo" }) });
  }
  for (const y of [-3.4, 3.4]) {
    xdisc("board", "pogo.barrel", face, face + 0.25, y, 9.6, 0.75, { tone: "mid" });
    xdisc("board", "pogo.tip", face + 0.25, face + 0.4, y, 9.6, 0.45, { tone: "hi" });
  }
}

// ---- cell: a pouch on a foam pad, its seal, tabs and protection board, and a lead to the board ----
{
  box("cell", "foam", [12, -6.8, BOARD.z1], [56, 6.8, CELL.z0], { tone: "lo" }, { r: 0.6, steps: 3 });
  const band = (x) => path3([[x, -CELL.y, CELL.z1], [x, CELL.y, CELL.z1], [x, CELL.y, CELL.z0]]);
  const label = { x: 31, y: -6.5, w: 20, d: 13, r: 0.6 };
  const pouch = { x: CELL.x0, y: -CELL.y, w: CELL.x1 - CELL.x0, d: CELL.y * 2, r: 1 };
  const inner = [
    Ln(k.sideSeam(pouch, (CELL.z0 + CELL.z1) / 2 - 1.2, P, 4), { tone: "faint" }),
    Ln(band(19) + band(25), { tone: "lo" }),
    Ln(k.planOutline(label, CELL.z1, P, 3), { tone: "faint" }),
    Ln([14, 9, 11].map((w, i) => k.lineOnTop([label.x + 2, label.y + 8 + i * 1.6], [label.x + 2 + w, label.y + 8 + i * 1.6], CELL.z1, P)).join(""), { tone: "lo", free: true }),
  ].join("");
  const text = k.faceTextSvg(k.topMatrix([label.x + 2, label.y + 4.6], CELL.z1, P), `${M.CELL.nominal}V ${M.CELL.mAh}mAh`, { size: 2.1, tone: "mid" });
  box("cell", "pouch", [CELL.x0, -CELL.y, CELL.z0], [CELL.x1, CELL.y, CELL.z1], { tone: "mid" }, { r: 1, steps: 4, bevel: 0.4, inner, extra: text });
  box("cell", "seal", [CELL.x1, -CELL.y, SEAL.z0], [SEAL.x1, CELL.y, SEAL.z1], { tone: "mid" }, {
    r: 0.2,
    inner: Ln([57.8, 58.6].map((x) => k.lineOnTop([x, -CELL.y], [x, CELL.y], SEAL.z1, P)).join(""), { tone: "faint" }),
  });
  for (const [y0, y1] of [[-6, -3], [3, 6]]) box("cell", "tab", [SEAL.x1, y0, 6.95], [PCM.x0, y1, 7.25], { tone: "hi" }, { r: 0.05, extra: Dots([at([60.05, (y0 + y1) / 2 - 0.7, 7.25]), at([60.05, (y0 + y1) / 2 + 0.7, 7.25])], { size: 0.35, tone: "mid" }) });
  box("cell", "pcm", [PCM.x0, -PCM.y, PCM.z0], [PCM.x1, PCM.y, PCM.z1], { tone: "mid" }, { r: 0.1 });
  const pcmPart = (name, y0, y1, z0, z1) => {
    const F = G.frameOf([0, (y0 + y1) / 2, (z0 + z1) / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const poly = [[y0 - (y0 + y1) / 2, z0 - (z0 + z1) / 2], [y1 - (y0 + y1) / 2, z0 - (z0 + z1) / 2], [y1 - (y0 + y1) / 2, z1 - (z0 + z1) / 2], [y0 - (y0 + y1) / 2, z1 - (z0 + z1) / 2]];
    const id = `cell.${name}`;
    const shape = record(A.prism(F, poly, PCM.x1, PCM.x1 + 0.9, { name: id }));
    put("cell", id, [PCM.x1 + 0.45, (y0 + y1) / 2, (z0 + z1) / 2], S(prismPaths(F, poly, PCM.x1, PCM.x1 + 0.9), { tone: "lo" }), [shape]);
  };
  pcmPart("protector", 2.4, 5.4, 7.4, 9.0);
  pcmPart("switch", -5.6, -2.6, 4.2, 8.6);
  box("cell", "plug", [62.6, -2, BOARD.z1 + 0.8], [64.4, 2, 5.0], { tone: "mid" }, { r: 0.2, bevel: 0.12 });
  const LEAD_R = 0.32;
  for (const [y, tone] of [[-1, "hi"], [1, "mid"]]) {
    const name = `cell.lead${y < 0 ? "-" : "+"}`;
    const route = G.fillet([[PCM.x1, y, 10.2], [63.5, y, 10.2], [63.5, y, 5.0]], 0.9, 10, { P, tube: LEAD_R });
    R.route(name, route, LEAD_R, { piece: "cell", move: PIECES.cell.move, ride: "cell", limp: true });
    tubePieces(route, LEAD_R, P, { maxLength: 3, spacing: 0.4 }).forEach((piece, index) =>
      put("cell", `${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii, { name })], { bias: 0.02 }),
    );
    for (const end of [route[0], route[route.length - 1]]) put("cell", `${name}.solder`, end, Dots([at(end)], { size: 0.55, tone: "hi" }), [A.ball(end, 0.55 / KS, { name: `${name}.solder` })], { bias: 0.05 });
  }
}

// ---- pod: the reservoir with its chimney, the liquid, the end wall and the mouthpiece ----
{
  const lower = uPieces(IN, POD_IN);
  const upper = uPieces(OUT, POD_IN);
  xprism("pod", "lower.far", lower.far, PB, POD_X.lower, { tone: "mid" });
  xprism("pod", "lower.floor", lower.floor, PB, POD_X.lower, { tone: "mid" });
  xprism("pod", "lower.near", lower.near, PB, POD_X.lower, { tone: "mid" });
  const plate = (name, parts, x0, x1, options = {}) => {
    xprism("pod", `${name}.far`, parts.far, x0, x1, { tone: "mid" });
    xprism("pod", `${name}.wedge`, parts.wedge, x0, x1, { tone: "mid" });
    xprism("pod", `${name}.near`, parts.near, x0, x1, { tone: "mid" }, options);
  };
  plate("base", plateParts(POD_IN, COIL.grommet[1]), PB, PB + 1.4);
  xprism("pod", "upper.far", upper.far, POD_X.lower, POD_X.upper, { tone: "mid" });
  xprism("pod", "upper.floor", upper.floor, POD_X.lower, POD_X.upper, { tone: "mid" });
  const plug = { x0: PB + 15, x1: PB + 21, z0: 5.4, z1: 6.7 };
  xprism("pod", "upper.near", upper.near, POD_X.lower, POD_X.upper, { tone: "mid" }, {
    inner: [`<path class="vp-rubber" d="${slot(OUT.w / 2, plug.x0, plug.x1, plug.z0, plug.z1)}"/>`, Ln(slot(OUT.w / 2, plug.x0, plug.x1, plug.z0, plug.z1), { tone: "lo" }), Ln(seamOn(upper.near, POD_X.lower + 0.9), { tone: "faint" })].join(""),
  });
  plate("wall", plateParts(POD_IN, COIL.chimney[1]), POD_X.end, POD_X.upper);
  const mouth = plateParts(MOUTH, MOUTH.bore);
  plate("mouth", mouth, POD_X.upper, POD_X.tip, { inner: Ln(seamOn(mouth.near, POD_X.tip - 1.4), { tone: "faint" }) });
  const chimney = tubeParts(...COIL.chimney);
  xprism("pod", "chimney.back", chimney.back, POD_X.lower, POD_X.upper, { tone: "mid" });
  xprism("pod", "chimney.front", chimney.front, POD_X.lower, POD_X.upper, { tone: "mid" });
  const liquid = (rn, x0, x1) => {
    const parts = liquidParts(POD_IN, rn);
    xprism("pod", "liquid.back", parts.back, x0, x1, { tone: "lo", crease: "none" }, { cls: "vp-liquid", bare: true });
    xprism("pod", "liquid.front", parts.front, x0, x1, { tone: "lo", crease: "none" }, { cls: "vp-liquid", bare: true });
  };
  liquid(COIL.housing[1], PB + 1.4, POD_X.lower + 0.05);
  liquid(COIL.chimney[1], POD_X.lower, POD_X.end);
}

// ---- coil head: grommet, housing with a juice port, cotton, and the mesh that heats ----
{
  const q = (name, [r0, r1], x0, x1, style, options) => {
    const parts = tubeParts(r0, r1);
    xprism("coil", `${name}.back`, parts.back, x0, x1, style, options?.far ?? options);
    xprism("coil", `${name}.front`, parts.front, x0, x1, style, options?.near ?? options);
  };
  q("grommet", COIL.grommet, PB, PB + 1.4, { tone: "lo" }, { cls: "vp-rubber-solid" });
  q("plug", [COIL.hole, COIL.housing[0]], PB, PB + 1.6, { tone: "mid" });
  q("housing", COIL.housing, PB, PORT[0], { tone: "mid" });
  q("housing", COIL.housing, PORT[1], PB + 11.2, { tone: "mid" });
  q("cap", COIL.cap, PB + 11.2, POD_X.lower, { tone: "mid" });
  const [w0, w1] = COIL.cotton;
  const fibres = (side) => Ln([0.35, 0.65].map((t) => path3([[PB + 1.6, side * (w0 + (w1 - w0) * t), ZC], [PB + 10.4, side * (w0 + (w1 - w0) * t), ZC]])).join(""), { tone: "faint" });
  q("cotton", COIL.cotton, PB + 1.6, PB + 10.4, { tone: "hi" }, { far: { inner: fibres(-1), cls: "vp-cotton" }, near: { inner: fibres(1), cls: "vp-cotton" } });
  const [m0] = COIL.mesh;
  const holes = [];
  for (let x = PB + 3.0; x <= PB + 9.05; x += 0.6) for (const a of [1.12, 1.25, 1.38]) holes.push(at([x, m0 * Math.cos(a * PI), ZC + m0 * Math.sin(a * PI)]));
  q("mesh", COIL.mesh, PB + 2.6, PB + 9.4, { tone: "hi" }, { far: { cls: "vp-mesh", extra: Dots(holes, { size: 0.32, tone: "lo" }) }, near: { cls: "vp-mesh" } });
}

// ---- the air path: in through the coil and up the chimney, shown while someone draws ----
const FLOW = { y: -0.2, z: ZC - 0.5 };
for (const [piece, x0, x1, ends] of [["coil", PB + 0.4, POD_X.lower, "from"], ["pod", POD_X.lower, POD_X.tip, "to"]]) {
  const points = [[x0, FLOW.y, FLOW.z], [x1, FLOW.y, FLOW.z]];
  const d = path3(points);
  const tip = ends === "from" ? points[0] : points[1];
  const svg = `<g class="vp-flow" data-flow-part>${Ln(d, { tone: "mid", flow: true, className: "vp-air" })}${Ln(d, { tone: "lit", flow: true, className: "vp-vapour" })}${Dots([at(tip)], { size: 0.8, tone: "hi" })}</g>`;
  put(piece, `${piece}.flow`, [(x0 + x1) / 2, FLOW.y, FLOW.z], svg, [A.tube(points, 0.08, { name: `${piece}.flow` })], { bias: 0.01 });
}

A.settle(R, P);
const items = R.items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(3)}" data-m="${mx},${my},${mz}" data-i="${index}">${item.svg}</g>`;
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const ORDER = ["pod", "coil", "cell", "board", "shell"];
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER,
  cell: M.CELL,
  coil: M.COIL,
  draw: M.DRAW,
};

const LABEL_TEXT =
  "A refillable pod vape lying on a bench plate, its aluminium shell, pod and coil head cut through the middle: a USB-C port and a long circuit board on the floor, a 1,000 mAh pouch cell on foam with its protection board and a lead to the board, an airflow sensor, microcontroller and MOSFET at the top of the board, a plastic cradle with two magnets and two sprung pins, and the pod, whose liquid surrounds a coil head of mesh in cotton and a chimney that runs to the mouthpiece.";
const svgBody = `<g class="vp-stand">${back.join("")}</g><g class="vp-device">${groups.join("")}</g>`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: svgBody });

const PARTS = ORDER.map((id, index) => `<button type="button" class="vp-part" data-part="${id}"><span class="vp-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 3</span><span class="iso-plate-corner" data-corner="title">Pod vape · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>ready · ${M.CELL.load} V · ${M.COIL.ohms} Ω</span></div>`;
const controls = `<div class="vp-controls"><button type="button" class="vp-draw" data-draw aria-label="Draw: press and hold to inhale"><span class="vp-lamp" aria-hidden="true"></span>Hold to draw</button><span class="vp-hint" data-hint>Hover to take it apart</span><span class="vp-sr" aria-live="polite" data-live></span></div>`;
const stage = `<div class="vp-stage" tabindex="0" role="slider" aria-label="Pod vape, cut open. Hover or use the arrow keys to take it apart part by part; hold Enter or the Draw button to inhale and fire the coil; Escape puts it back together." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Assembled, ready">${svg}</div>`;
const PUFF = 3;
const caption =
  `A refillable pod vape, cut open. Breathing in pulls about ${M.DRAW.kPa} kPa below the room through the inlet slot; past ${M.DRAW.trigger} kPa the airflow sensor trips, and the board's MOSFET switches the ${M.CELL.load} V cell across the ${M.COIL.ohms} Ω mesh: ${M.amps().toFixed(2)} A, ${Math.round(M.watts())} W. ` +
  `The mesh heats the wet cotton to about ${M.COIL.steady} °C, too cool to glow, and the liquid vaporises into the air rising through it, up the chimney and out of the mouthpiece. ` +
  `The board cuts off after ${M.DRAW.cutoff} s. A full ${M.CELL.mAh.toLocaleString("en-US")} mAh cell holds ${(M.energyJ / 1000).toFixed(1)} kJ, about ${M.puffsPerCharge(PUFF)} puffs of ${PUFF} s.`;
const keys = `<span class="iso-keys"><span class="iso-key"><svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>The mesh coil, lit while current flows</span><span class="iso-key"><svg class="iso-swatch" data-mark="dashed" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>Air, then vapour, through the coil and chimney</span><span class="iso-key"><svg class="iso-swatch" data-mark="flat" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>Liquid in the pod, cut with it</span></span>`;
const body = `<figure class="iso-figure vp"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="vp-parts">${PARTS}</span>${keys}<span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "vape.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const MODEL = `const M = (() => {\n${readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "")}\nreturn { CELL, COIL, DRAW, POD, amps, watts, energyJ, puffsPerCharge, step, rest };\n})();\n`;
const page = k.pageHtml({ title: "Pod vape", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + MODEL + LIVE, width: 760 });
const name = THEME === "light" ? "pod-vape-light.html" : "pod-vape.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `scale ${KS.toFixed(2)} px/mm`);

A.auditOrExit(R, P, {});
