// A typical refillable pod vape: every number the figure shows comes from here.
export const CELL = { mAh: 1000, nominal: 3.7, full: 4.2, load: 3.8, size: [50, 19, 9] };
export const COIL = { ohms: 0.8, ambient: 22, steady: 225, heat: 0.35, cool: 0.8, vapour: [150, 200] };
export const DRAW = { kPa: 1.2, rise: 0.12, fall: 0.08, trigger: 0.25, cutoff: 10 };
export const POD = { ml: 2 };

export const amps = (volts = CELL.load) => volts / COIL.ohms;
export const watts = (volts = CELL.load) => (volts * volts) / COIL.ohms;
export const energyJ = (CELL.mAh / 1000) * CELL.nominal * 3600;
export const puffsPerCharge = (seconds) => Math.floor(energyJ / (watts() * seconds));

// One step of the puff: the draw pressure follows the lungs, the board fires while it is
// below the trigger, and the coil heats towards the boiling wick and cools when it stops.
export function step(state, drawing, dt) {
  const target = drawing ? -DRAW.kPa : 0;
  const tau = drawing ? DRAW.rise : DRAW.fall;
  state.kPa += (target - state.kPa) * (1 - Math.exp(-dt / tau));
  const wants = state.kPa < -DRAW.trigger;
  if (wants && state.firing) state.fired += dt;
  if (wants && !state.firing && state.fired < DRAW.cutoff) state.firing = true;
  if (!wants) state.fired = 0;
  if (state.firing && (!wants || state.fired >= DRAW.cutoff)) state.firing = false;
  const goal = state.firing ? COIL.steady : COIL.ambient;
  state.celsius += (goal - state.celsius) * (1 - Math.exp(-dt / (state.firing ? COIL.heat : COIL.cool)));
  return state;
}

export const rest = () => ({ kPa: 0, firing: false, fired: 0, celsius: COIL.ambient });
