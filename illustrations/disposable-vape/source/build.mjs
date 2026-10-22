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

// World units are millimetres. The aluminium tube, its plugs and seals, the felt and the air
// tube are cut through their middle at ZC and seen from above; the cell and the airflow switch
// inside are drawn whole.
const ZC = 6.5;
const OUT = { w: 20, h: 13, r: 4 };
const IN = { w: 18.8, h: 11.8, r: 3.4 };
const MOUTH = { w: 15, h: 8, r: 3.5, bore: 2 };
const X = { flange: 1, plug: 5, led: 5.4, seat: 8.8, flap: 10.6, cell: 12, cellEnd: 54, bulk: 57, felt: 95, seal: 97, collar: 99, tip: 107 };
const TUBE = { r: [1.8, 2.2], x0: 56, hole: [60, 64] };
const WICK = { r: [1.1, 1.8], x: [58, 66] };
const HELIX = { r: 1.0, x: [59, 65], turns: 7, wire: 0.15 };
const SENSOR = { r: 3.5, seat: 3.6 };
const CELL = { y: 7.5, z0: 1.4, z1: 8.4 };
const FLAP = { z0: 4.6, z1: 5.2 };
const LEAD = { y: 8.6, z: 5.4, r: 0.25 };
const BORE = 1;
const PAD_Z = -1;
const PLATE = { x: -14, y: -13.5, w: 141, d: 31, r: 3.5 };
const PLATE_H = 3.2;
const FOOT_H = 2.2;
const PADS = [{ x: 16, y: -7, w: 14, d: 14, r: 2 }, { x: 76, y: -7, w: 14, d: 14, r: 2 }];

const PIECES = {
  mouth: { name: "Mouthpiece", say: "mouthpiece · press-fitted, no refill port", move: [16, 0, 0] },
  tank: { name: "Felt tank and coil", say: `tank · ${M.LIQUID.ml} ml soaked in felt round the air tube`, move: [0, 0, 16] },
  cell: { name: "Cell", say: `cell · ${M.CELL.mAh} mAh LiPo · no charging port`, move: [0, 0, 8] },
  base: { name: "Airflow switch and base", say: "airflow switch · fires the cell straight into the coil", move: [-10, 0, 0] },
  shell: { name: "Shell", say: "shell · aluminium tube, cut open", move: [0, 0, 0] },
};
const STAGGER = ["mouth", "base", "tank", "cell", "shell"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, PAD_Z - PLATE_H - FOOT_H, PAD_Z),
    ...k.boxCorners({ x: PIECES.base.move[0], y: -10, w: X.tip + PIECES.mouth.move[0] - PIECES.base.move[0], d: 20 }, 0, 13),
    [X.bulk, -10, OUT.h + PIECES.tank.move[2]],
    [X.felt, -10, OUT.h + PIECES.tank.move[2]],
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
const RULE = { x: -3, y: PLATE.y + PLATE.d - 5.6, w: 128, d: 3.2, r: 0.5 };
back.push(S(k.slabOf(RULE, PAD_Z, 0.3, P, 3), { tone: "lo", crease: "none" }));
{
  const t = k.topTicks(0, 120, 1, 10, RULE.y, PAD_Z + 0.3, [0.9, 2.1], P);
  back.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  back.push(Ln(k.lineOnTop([0, RULE.y], [0, RULE.y + 2.6], PAD_Z + 0.3, P), { tone: "hi" }));
}
const LABEL = { x: 108.5, y: PLATE.y + 2.4, w: 16, d: 6.8, r: 0.8 };
back.push(S(k.slabOf(LABEL, PAD_Z, 0.4, P, 3), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 0.8), PAD_Z + 0.4, P, 3), { tone: "faint" }));
back.push(Ln([10, 6, 8].map((w, i) => k.lineOnTop([LABEL.x + 2.2, LABEL.y + 2 + i * 2], [LABEL.x + 2.2 + w, LABEL.y + 2 + i * 2], PAD_Z + 0.4, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w - 1.8, LABEL.y + 1.6, PAD_Z + 0.4]), at([LABEL.x + LABEL.w - 1.8, LABEL.y + LABEL.d - 1.6, PAD_Z + 0.4])], { size: 0.45 }));
back.push(`<path class="iso-halo" d="${k.haloOf({ x: 0, y: -9, w: X.tip, d: 18, r: 4 }, 0, 4, P)}"/>`);
for (const pad of PADS) {
  back.push(S(k.slabOf(pad, PAD_Z, 1, P, 4, 0.3), { tone: "lo" }));
  record(A.slab(pad, PAD_Z, 1, { name: "stand.pad", ground: true }, 4));
}


// ---- shell: one aluminium tube, cut through the middle ----
const sleeve = uPieces(OUT, IN);
{
  xprism("shell", "tube.far", sleeve.far, X.flange, X.seal, { tone: "mid" });
  xprism("shell", "tube.floor", sleeve.floor, X.flange, X.seal, { tone: "mid" });
  xprism("shell", "tube.near", sleeve.near, X.flange, X.seal, { tone: "mid" }, {
    inner: Ln(seamOn(sleeve.near, X.flange + 1.6) + seamOn(sleeve.near, X.seal - 1.6), { tone: "faint" }),
  });
}

// a cut plate: its far half, the wedge under its notch and its near front
function plate(piece, name, parts, x0, x1, style = { tone: "mid" }, { inner = "", ...options } = {}) {
  xprism(piece, `${name}.far`, parts.far, x0, x1, style, options);
  xprism(piece, `${name}.wedge`, parts.wedge, x0, x1, style, options);
  xprism(piece, `${name}.near`, parts.near, x0, x1, style, { ...options, inner });
}
const tubeOf = (piece, name, [r0, r1], x0, x1, style, options = {}) => {
  const parts = tubeParts(r0, r1);
  xprism(piece, `${name}.back`, parts.back, x0, x1, style, options.back ?? options);
  xprism(piece, `${name}.front`, parts.front, x0, x1, style, options.front ?? options);
};

// ---- base: the bottom plug with its air inlet, the LED, and the airflow switch in its seat ----
{
  const flange = plateParts(OUT, BORE);
  plate("base", "plug.flange", flange, 0, X.flange, { tone: "mid" }, {});
  plate("base", "plug", plateParts(IN, BORE), X.flange, X.plug, { tone: "mid" });
  box("base", "led", [X.plug, -0.6, ZC - 0.9], [X.led, 0.6, ZC - 0.3], { tone: "hi" }, { r: 0.05 });
  put("base", "base.led.glow", [X.led, 0, ZC - 0.3], `<g class="vp-led" data-part="led">${Dots([at([X.plug + 0.2, 0, ZC - 0.3])], { size: 1.6, tone: "hi" })}</g>`, [A.ball([X.plug + 0.2, 0, ZC - 0.3], 0.3, { name: "base.led.glow" })], { bias: 0.05 });
  plate("base", "seat", plateParts(IN, SENSOR.seat), X.plug, X.seat, { tone: "lo" }, { cls: "vp-rubber-solid" });
  const F = G.frameOf([0, 0, ZC], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const face = [
    Ln(G.circleOf(F, X.seat, 2.3, P, 48) + G.circleOf(F, X.seat, 1.1, P, 32), { tone: "mid" }),
    Dots([[-2.4, -1.6], [2.4, -1.6], [-1.2, 2.1], [1.2, 2.1]].map(([y, z]) => at([X.seat, y, ZC + z])), { size: 0.55, tone: "hi" }),
  ].join("");
  xdisc("base", "switch", X.led, X.seat, 0, ZC, SENSOR.r, { tone: "hi" }, { extra: face, cls: "vp-sensor" });
}

// ---- cell: a pouch on foam, its seal and two tabs soldered to the switch ----
{
  box("cell", "foam", [X.cell + 1, -5.5, 0.6], [X.cellEnd - 1, 5.5, CELL.z0], { tone: "lo" }, { r: 0.6, steps: 3 });
  const pouch = { x: X.cell, y: -CELL.y, w: X.cellEnd - X.cell, d: CELL.y * 2, r: 1 };
  const band = (x) => path3([[x, -CELL.y, CELL.z1], [x, CELL.y, CELL.z1], [x, CELL.y, CELL.z0]]);
  const label = { x: 26, y: -5.4, w: 20, d: 10.8, r: 0.6 };
  const inner = [
    Ln(k.sideSeam(pouch, (CELL.z0 + CELL.z1) / 2 - 1, P, 4), { tone: "faint" }),
    Ln(band(17) + band(22), { tone: "lo" }),
    Ln(k.planOutline(label, CELL.z1, P, 3), { tone: "faint" }),
    Ln([13, 9].map((w, i) => k.lineOnTop([label.x + 2, label.y + 6.6 + i * 1.6], [label.x + 2 + w, label.y + 6.6 + i * 1.6], CELL.z1, P)).join(""), { tone: "lo", free: true }),
  ].join("");
  const text = k.faceTextSvg(k.topMatrix([label.x + 2, label.y + 3.8], CELL.z1, P), `${M.CELL.nominal}V ${M.CELL.mAh}mAh`, { size: 2, tone: "mid" });
  box("cell", "pouch", [X.cell, -CELL.y, CELL.z0], [X.cellEnd, CELL.y, CELL.z1], { tone: "mid" }, { r: 1, steps: 4, bevel: 0.4, inner, extra: text });
  box("cell", "seal", [X.flap, -CELL.y, FLAP.z0], [X.cell, CELL.y, FLAP.z1], { tone: "mid" }, {
    r: 0.2,
    inner: Ln([11.1, 11.6].map((x) => k.lineOnTop([x, -CELL.y], [x, CELL.y], FLAP.z1, P)).join(""), { tone: "faint" }),
  });
  for (const [y0, y1] of [[-3.2, -1.6], [1.6, 3.2]]) box("cell", "tab", [X.seat, y0, 4.8], [X.flap, y1, 5.0], { tone: "hi" }, { r: 0.05, extra: Dots([at([X.seat + 0.4, (y0 + y1) / 2, 5.0])], { size: 0.6, tone: "hi" }) });
}

// ---- tank: the rubber bulkhead, the air tube with its wicking holes, the cotton and the
// wound coil inside it, the felt that holds the liquid, the top seal and the coil's leads ----
{
  plate("tank", "bulkhead", plateParts(IN, TUBE.r[1]), X.cellEnd, X.bulk, { tone: "lo" }, { cls: "vp-rubber-solid" });
  plate("tank", "topseal", plateParts(IN, TUBE.r[1]), X.felt, X.seal, { tone: "lo" }, { cls: "vp-rubber-solid" });
  tubeOf("tank", "airtube", TUBE.r, TUBE.x0, TUBE.hole[0], { tone: "hi" });
  tubeOf("tank", "airtube", TUBE.r, TUBE.hole[1], X.seal, { tone: "hi" });
  const [w0, w1] = WICK.r;
  const fibres = (side) => Ln([0.5].map((t) => path3([[WICK.x[0], side * (w0 + (w1 - w0) * t), ZC], [WICK.x[1], side * (w0 + (w1 - w0) * t), ZC]])).join(""), { tone: "faint" });
  tubeOf("tank", "cotton", WICK.r, WICK.x[0], WICK.x[1], { tone: "hi" }, { back: { inner: fibres(-1), cls: "vp-cotton" }, front: { inner: fibres(1), cls: "vp-cotton" } });
  const felt = (rn, x0, x1) => {
    const parts = liquidParts(IN, rn);
    xprism("tank", "felt.back", parts.back, x0, x1, { tone: "lo", crease: "none" }, { cls: "vp-liquid", bare: true });
    xprism("tank", "felt.front", parts.front, x0, x1, { tone: "lo", crease: "none" }, { cls: "vp-liquid", bare: true });
  };
  felt(TUBE.r[1], X.bulk, TUBE.hole[0] + 0.05);
  felt(TUBE.r[0], TUBE.hole[0], TUBE.hole[1]);
  felt(TUBE.r[1], TUBE.hole[1] - 0.05, X.felt);
  const strands = [];
  for (const side of [-1, 1]) for (const y of [3.4, 5, 6.6, 8.2]) strands.push(path3([[X.bulk, side * y, ZC], [X.felt, side * y, ZC]]));
  put("tank", "tank.fibres", [(X.bulk + X.felt) / 2, 0, ZC], Ln(strands.join(""), { tone: "faint" }), [A.box([X.bulk, -9, ZC - 0.05], [X.felt, 9, ZC], { name: "tank.fibres" })], { bias: 0.3 });
  // the coil: only the turns below the cut remain, seen inside the cotton
  const turns = [];
  const pitch = (HELIX.x[1] - HELIX.x[0]) / HELIX.turns;
  for (let t = 0; t < HELIX.turns; t++) {
    const points = [];
    for (let i = 0; i <= 18; i++) {
      const a = PI + ((TT + 0.12 - PI) * i) / 18;
      const x = HELIX.x[0] + pitch * (t + (a - PI) / (2 * PI));
      points.push([x, HELIX.r * Math.cos(a), ZC + HELIX.r * Math.sin(a)]);
    }
    turns.push(points);
  }
  put("tank", "tank.coil", [(HELIX.x[0] + HELIX.x[1]) / 2, -0.6, ZC - 0.8], `<g class="vp-mesh">${Ln(turns.map((points) => path3(points)).join(""), { tone: "hi", className: "vp-wire" })}</g>`, turns.map((points) => A.tube(points, HELIX.wire, { name: "tank.coil" })), { bias: 0.02 });
  // the leads run back beside the cell from the bulkhead to the switch
  for (const side of [-1, 1]) {
    const name = `tank.lead${side < 0 ? "-" : "+"}`;
    const route = G.fillet([[X.seat, side * 1.2, ZC + 2.1], [X.seat + 1, side * 1.2, ZC + 2.1], [X.flap, side * LEAD.y, LEAD.z], [X.cellEnd, side * LEAD.y, LEAD.z]], 1.2, 10, { P, tube: LEAD.r });
    R.route(name, route, LEAD.r, { piece: "tank", move: PIECES.tank.move, ride: "tank", limp: true, free: [true, false] });
    tubePieces(route, LEAD.r, P, { maxLength: 6, spacing: 0.4 }).forEach((piece, index) =>
      put("tank", `${name}:${index}`, piece.mid, tubeSvg(piece, { tone: side < 0 ? "hi" : "mid" }), [A.tube(piece.points, piece.radii, { name })], { bias: 0.02 }),
    );
    for (const end of [route[0], route[route.length - 1]]) put("tank", `${name}.solder`, end, Dots([at(end)], { size: 0.6, tone: "hi" }), [A.ball(end, 0.6 / KS, { name: `${name}.solder` })], { bias: 0.05 });
  }
}

// ---- mouthpiece: a collar on the tube and a tip with a bore ----
{
  plate("mouth", "collar", plateParts(OUT, MOUTH.bore), X.seal, X.collar);
  const tip = plateParts(MOUTH, MOUTH.bore);
  plate("mouth", "tip", tip, X.collar, X.tip, { tone: "mid" }, { inner: Ln(seamOn(tip.near, X.tip - 1.2), { tone: "faint" }) });
}

// ---- the air path: through the bulkhead, the coil and the tube, shown while someone draws ----
const FLOW = { y: -0.2, z: ZC - 0.45 };
for (const [piece, x0, x1, tip] of [["tank", X.cellEnd + 0.4, X.seal, "from"], ["mouth", X.seal, X.tip, "to"]]) {
  const points = [[x0, FLOW.y, FLOW.z], [x1, FLOW.y, FLOW.z]];
  const d = path3(points);
  const dot = tip === "from" ? points[0] : points[1];
  const svg = `<g class="vp-flow">${Ln(d, { tone: "mid", flow: true, className: "vp-air" })}${Ln(d, { tone: "lit", flow: true, className: "vp-vapour" })}${Dots([at(dot)], { size: 0.8, tone: "hi" })}</g>`;
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
const ORDER = ["mouth", "tank", "cell", "base", "shell"];
const DATA = {
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER,
  coil: M.COIL,
  draw: M.DRAW,
};

const LABEL_TEXT =
  "A sealed disposable vape lying on a bench plate, its aluminium tube cut through the middle: a bottom plug with an air inlet and an LED, an airflow switch in a rubber seat, a 550 mAh pouch cell on foam with its tabs soldered to the switch, a rubber bulkhead, an air tube with two wicking holes holding a cotton wick and a wound coil, a felt sleeve soaked with the liquid around the tube, a top seal, and a press-fitted mouthpiece. Two leads run back beside the cell from the coil to the switch.";
const svgBody = `<g class="vp-stand">${back.join("")}</g><g class="vp-device">${groups.join("")}</g>`;
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: svgBody });

const PARTS = ORDER.map((id, index) => `<button type="button" class="vp-part" data-part="${id}"><span class="vp-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 4</span><span class="iso-plate-corner" data-corner="title">Disposable vape · cutaway</span><span class="iso-plate-corner" data-corner="readout" data-readout>sealed · ${M.LIQUID.ml.toFixed(2)} ml · cell 100%</span></div>`;
const controls = `<div class="vp-controls"><button type="button" class="vp-draw" data-draw aria-label="Draw: press and hold to inhale"><span class="vp-lamp" aria-hidden="true"></span>Hold to draw</button><span class="vp-hint" data-hint>Hover to take it apart</span><span class="vp-sr" aria-live="polite" data-live></span></div>`;
const stage = `<div class="vp-stage" tabindex="0" role="slider" aria-label="Disposable vape, cut open. Hover or use the arrow keys to take it apart part by part; hold Enter or the Draw button to inhale and fire the coil; Escape puts it back together." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Assembled, sealed">${svg}</div>`;
const caption =
  `A sealed disposable vape, cut open. It has no circuit board and no charging port: the airflow switch in the base is a pressure sensor with its own switch. ` +
  `Breathing in pulls about ${M.DRAW.kPa} kPa; past ${M.DRAW.trigger} kPa it connects the ${M.CELL.load} V cell across the ${M.COIL.ohms} Ω wound coil, ${M.amps().toFixed(2)} A and ${M.watts().toFixed(1)} W, and lights the LED in the base. ` +
  `The coil heats the wet cotton to about ${M.COIL.steady} °C, and the ${M.LIQUID.ml} ml of liquid, soaked into a felt sleeve, reaches the cotton through two holes in the air tube. ` +
  `The cell's ${(M.energyJ / 1000).toFixed(1)} kJ lasts about ${Math.round(M.cellSeconds())} s of firing and the felt runs dry after about ${Math.round(M.liquidSeconds())} s, so both give out after roughly ${Math.round(M.liquidSeconds() / 100) * 100} one-second puffs, and the whole thing is thrown away.`;
const keys = `<span class="iso-keys"><span class="iso-key"><svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>The coil, lit while current flows</span><span class="iso-key"><svg class="iso-swatch" data-mark="dashed" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>Air, then vapour, through the coil and tube</span><span class="iso-key"><svg class="iso-swatch" data-mark="flat" viewBox="0 0 16 10"><path d="M1 5h14"/></svg>Felt soaked with liquid, cut with the tube</span></span>`;
const body = `<figure class="iso-figure vp"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="vp-parts">${PARTS}</span>${keys}<span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "vape.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const MODEL = `const M = (() => {\n${readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "")}\nreturn { CELL, COIL, DRAW, LIQUID, amps, watts, energyJ, mlPerSecond, cellSeconds, liquidSeconds, step, rest, left };\n})();\n`;
const page = k.pageHtml({ title: "Disposable vape", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + MODEL + LIVE, width: 760 });
const name = THEME === "light" ? "disposable-vape-light.html" : "disposable-vape.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `scale ${KS.toFixed(2)} px/mm`);

A.auditOrExit(R, P, {});
