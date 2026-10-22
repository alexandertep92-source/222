const D = __DATA__;
const root = document.querySelector(".vp");
const stage = root.querySelector(".vp-stage");
const device = stage.querySelector(".vp-device");
const readout = root.querySelector("[data-readout]");
const live = root.querySelector("[data-live]");
const drawButton = root.querySelector("[data-draw]");
const hint = root.querySelector("[data-hint]");
const partButtons = [...root.querySelectorAll(".vp-part")];
const airEls = [...stage.querySelectorAll(".vp-air")];
const vapourEls = [...stage.querySelectorAll(".vp-vapour")];
const flowDots = [...stage.querySelectorAll(".vp-flow .iso-dots")];
const led = stage.querySelector('[data-part="led"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...device.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

const IDS = Object.keys(D.pieces);
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const ease = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

let clock = 0;
let apart = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let drawing = false;
let ledLevel = 0;
let phase = "";
const puff = M.rest();

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function announce(next) {
  if (phase === next) return;
  phase = next;
  live.textContent = next;
}

function describe() {
  const text = selected ? D.pieces[selected].say : drawing ? "drawing" : apart ? `apart · ${IDS.length - 1} assemblies` : "Assembled, ready";
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? D.stagger : [...D.stagger].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  run();
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  stage.toggleAttribute("data-focus", id !== null);
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = piece[node.piece].x;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = share === 0 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].piece].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].piece].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    device.appendChild(fragment);
    order = next;
  }
}

const home = () => IDS.every((id) => piece[id].target === 0 && piece[id].x < 0.002 && !piece[id].pending);

function startDraw() {
  if (drawing) return;
  drawing = true;
  setApart(false);
  select(null);
  drawButton.dataset.state = "on";
  describe();
  run();
}

function stopDraw() {
  if (!drawing) return;
  drawing = false;
  delete drawButton.dataset.state;
  describe();
  run();
}

function stepPuff(dt, calm) {
  const lungs = drawing && home();
  if (calm) {
    puff.kPa = lungs ? -D.draw.kPa : 0;
    puff.fired = lungs ? puff.fired + dt : 0;
    puff.firing = lungs && puff.fired < D.draw.cutoff;
    puff.celsius = puff.firing ? D.coil.steady : D.coil.ambient;
  } else M.step(puff, lungs, dt);
  const sensing = puff.kPa < -D.draw.trigger;
  stage.toggleAttribute("data-firing", puff.firing);
  stage.toggleAttribute("data-sensing", sensing);
  if (drawing) drawButton.dataset.state = puff.firing ? "firing" : "on";
  const air = calm ? 0 : ease(0, 0.6, -puff.kPa / D.draw.kPa);
  const vapour = air * ease(D.coil.vapour[0], D.coil.vapour[1], puff.celsius);
  const a = (air * (1 - vapour)).toFixed(3);
  const v = vapour.toFixed(3);
  for (const el of airEls) el.style.opacity = a;
  for (const el of vapourEls) el.style.opacity = v;
  for (const el of flowDots) el.style.opacity = air.toFixed(3);
  ledLevel = calm ? (puff.firing ? 1 : 0) : ledLevel + ((puff.firing ? 1 : 0) - ledLevel) * (1 - Math.exp(-dt / 0.05));
  if (Math.abs(ledLevel - (puff.firing ? 1 : 0)) < 0.002) ledLevel = puff.firing ? 1 : 0;
  led.style.opacity = ledLevel.toFixed(3);

  let text = null;
  if (drawing && !home()) {
    text = "closing up · arming";
    announce("closing up");
  } else if (puff.firing) {
    text = `firing ${puff.fired.toFixed(1)} s · ${M.amps().toFixed(2)} A · ${Math.round(M.watts())} W · ${Math.round(puff.celsius)} °C`;
    announce("firing");
  } else if (drawing && puff.fired >= D.draw.cutoff) {
    text = `cut off at ${D.draw.cutoff} s · ${Math.round(puff.celsius)} °C`;
    announce("cut off");
  } else if (drawing) {
    text = `draw −${(-puff.kPa).toFixed(2)} kPa`;
    announce("drawing");
  } else if (puff.celsius > 40) {
    text = `cooling · ${Math.round(puff.celsius)} °C`;
    announce("cooling");
  } else if (phase !== "" && phase !== "ready") announce("ready");
  say(selected ? D.pieces[selected].say : text ?? idleText());
  return text !== null || Math.abs(puff.kPa) > 0.002 || ledLevel > 0;
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "taking apart" : "closing up";
  return apart ? `apart · ${IDS.length - 1} assemblies` : `ready · ${D.cell.load} V · ${D.coil.ohms} Ω`;
}

const TOUR_STEP = 1.6;
function tourAt(time) {
  const listFrom = 6.6;
  const listTo = listFrom + D.order.length * TOUR_STEP;
  if (time < 0.8) return { draw: false, apart: false, part: null };
  if (time < 3.8) return { draw: true, apart: false, part: null };
  if (time < 5.8) return { draw: false, apart: false, part: null };
  if (time < listFrom) return { draw: false, apart: true, part: null };
  if (time < listTo) return { draw: false, apart: true, part: D.order[Math.floor((time - listFrom) / TOUR_STEP)] };
  if (time < listTo + 2.4) return { draw: false, apart: false, part: null };
  return null;
}

function quietTour() {
  if (touring) {
    touring = false;
    if (drawing) stopDraw();
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || drawing) return quietTour();
    touring = !still.matches;
    tourClock = 0;
    run();
  }, 3600);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    let step = tourAt(tourClock);
    if (!step) {
      tourClock = 0;
      step = tourAt(0);
    }
    if (step.draw) startDraw();
    else stopDraw();
    if (!step.draw) {
      setApart(step.apart);
      select(step.part);
    }
  }
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  place();
  const puffing = stepPuff(dt, calm);
  frame = visible && (moving || puffing || touring) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  if (drawing) return;
  setApart(true);
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    setApart(false);
  }, 260);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  quietTour();
  if (drawing) return;
  const id = pieceAt(event);
  if (!id || (apart && selected === id)) {
    select(null);
    setApart(!apart);
  } else {
    setApart(true);
    select(id);
  }
  run();
});

drawButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  quietTour();
  startDraw();
  try {
    drawButton.setPointerCapture(event.pointerId);
  } catch {}
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) drawButton.addEventListener(type, () => stopDraw());
drawButton.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  if (event.repeat) return;
  quietTour();
  startDraw();
});
drawButton.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") stopDraw();
});
drawButton.addEventListener("blur", () => stopDraw());
drawButton.addEventListener("contextmenu", (event) => event.preventDefault());

partButtons.forEach((button) => {
  const show = () => {
    quietTour();
    if (drawing) return;
    clearTimeout(leaveTimer);
    setApart(true);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(false);
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    quietTour();
    startDraw();
    return;
  }
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    stopDraw();
    select(null);
    setApart(false);
    run();
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    quietTour();
    if (drawing) return;
    setApart(!apart);
    if (!apart) select(null);
    run();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  if (drawing) return;
  setApart(true);
  select(D.order[next]);
  run();
});
stage.addEventListener("keyup", (event) => {
  if (event.key === "Enter") stopDraw();
});
stage.addEventListener("blur", () => stopDraw());
stage.addEventListener("focus", () => {
  live.textContent = "";
  phase = "";
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const wording = () => (hint.textContent = narrow.matches ? "Tap to take it apart" : "Hover to take it apart");
wording();
narrow.addEventListener("change", wording);
place();
describe();
