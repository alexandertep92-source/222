// A typical sealed disposable vape: every number the figure shows comes from here.
export const CELL = { mAh: 550, nominal: 3.7, load: 3.7, size: [42, 15, 7] };
export const COIL = { ohms: 1.2, ambient: 22, steady: 205, heat: 0.4, cool: 0.9, vapour: [150, 190] };
export const DRAW = { kPa: 1.2, rise: 0.12, fall: 0.08, trigger: 0.25, cutoff: 8 };
// The felt holds the liquid. About 45% of the coil's power goes into the liquid, and a
// milligram of propylene glycol and glycerol takes about 1.4 J to heat and vaporise.
export const LIQUID = { ml: 2, share: 0.45, joulesPerMg: 1.4, mgPerUl: 1.1 };

export const amps = (volts = CELL.load) => volts / COIL.ohms;
export const watts = (volts = CELL.load) => (volts * volts) / COIL.ohms;
export const energyJ = (CELL.mAh / 1000) * CELL.nominal * 3600;
export const mlPerSecond = () => (watts() * LIQUID.share) / LIQUID.joulesPerMg / LIQUID.mgPerUl / 1000;
export const cellSeconds = () => energyJ / watts();
export const liquidSeconds = () => LIQUID.ml / mlPerSecond();

// One step of a puff: the draw pressure follows the lungs, the switch closes while it is past
// the trigger, the coil heats towards the wet cotton's limit, and firing time is counted.
export function step(state, drawing, dt) {
  const target = drawing ? -DRAW.kPa : 0;
  state.kPa += (target - state.kPa) * (1 - Math.exp(-dt / (drawing ? DRAW.rise : DRAW.fall)));
  const wants = state.kPa < -DRAW.trigger;
  const empty = state.used >= Math.min(cellSeconds(), liquidSeconds());
  if (wants && state.firing) state.fired += dt;
  if (wants && !state.firing && state.fired < DRAW.cutoff && !empty) state.firing = true;
  if (!wants) state.fired = 0;
  if (state.firing && (!wants || state.fired >= DRAW.cutoff || empty)) state.firing = false;
  if (state.firing) state.used += dt;
  const goal = state.firing ? COIL.steady : COIL.ambient;
  state.celsius += (goal - state.celsius) * (1 - Math.exp(-dt / (state.firing ? COIL.heat : COIL.cool)));
  return state;
}

export const rest = () => ({ kPa: 0, firing: false, fired: 0, used: 0, celsius: COIL.ambient });
export const left = (state) => ({
  ml: Math.max(0, LIQUID.ml - state.used * mlPerSecond()),
  cell: Math.max(0, 1 - state.used / cellSeconds()),
});
