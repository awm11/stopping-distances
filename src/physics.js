// The physics behind every tab.
// Thinking distance = speed x reaction time.  Braking distance comes from the car's deceleration,
// which is worked out here but never shown to students (they have not met v^2 = u^2 + 2as or F = ma yet).
// With a 0.67 s reaction time and 6.53 m/s^2 on a dry road, this reproduces the Highway Code chart.

export const MPH = 0.44704;            // 1 mph in m/s
export const RT0 = 0.67;               // Highway Code reaction time (s)
export const A0 = (70 * MPH) ** 2 / (2 * 75);   // dry-road deceleration that gives 75 m braking from 70 mph
export const CAR_LEN = 4;              // m, the Highway Code's "average car length"

export const UNITS = {
  mph: { key: 'mph', k: MPH, label: 'mph', min: 10, max: 70, step: 5, dp: 0 },
  kmh: { key: 'kmh', k: 1 / 3.6, label: 'km/h', min: 15, max: 115, step: 5, dp: 0 },
  ms: { key: 'ms', k: 1, label: 'm/s', min: 4, max: 32, step: 1, dp: 1 },
};
export const UNIT_LIST = [UNITS.mph, UNITS.kmh, UNITS.ms];

// Factors. "add" is extra reaction time (s); "mult" multiplies the braking distance.
export const DRIVER = [
  { key: 'tired', label: 'Tired', add: 0.3 },
  { key: 'impaired', label: 'Alcohol or drugs', add: 0.4 },
];
export const DISTRACTIONS = [
  { key: 'none', label: 'None', add: 0 },
  { key: 'phone', label: 'Phone', add: 0.5 },
  { key: 'dog', label: 'Dog', add: 0.3 },
  { key: 'toddler', label: 'Toddler', add: 0.3 },
  { key: 'burger', label: 'Burger', add: 0.3 },
  { key: 'music', label: 'Loud music', add: 0.3 },
];
// Highway Code: wet = at least double, icy = up to ten times the braking distance
export const ROADS = [
  { key: 'dry', label: 'Dry', mult: 1 },
  { key: 'wet', label: 'Wet', mult: 2 },
  { key: 'icy', label: 'Icy', mult: 10 },
];
export const CAR = [
  { key: 'tyres', label: 'Worn tyres', mult: 1.5 },
  { key: 'brakes', label: 'Worn brakes', mult: 1.5 },
];

export const DEFAULTS = {
  speed: 30 * MPH, baseRT: RT0,
  tired: false, impaired: false, distraction: 'none',
  road: 'dry', tyres: false, brakes: false,
  hazard: 40,
};

export function compute(s, speed = s.speed) {
  let tr = s.baseRT;
  for (const d of DRIVER) if (s[d.key]) tr += d.add;
  tr += (DISTRACTIONS.find(d => d.key === s.distraction) || DISTRACTIONS[0]).add;
  let m = (ROADS.find(r => r.key === s.road) || ROADS[0]).mult;
  for (const c of CAR) if (s[c.key]) m *= c.mult;
  m = Math.min(m, 10);   // the Highway Code's worst case is ten times the braking distance, so factors don't stack past that
  const a = A0 / m, v = speed;
  const think = v * tr, brake = (v * v) / (2 * a);
  return { v, tr, a, think, brake, stop: think + brake, tBrake: v / a };
}

// What a "normal" driver in a normal car on a dry road would do at this speed
export const baseline = s => compute({ ...DEFAULTS, baseRT: s.baseRT }, s.speed);

// The factors that are switched on, as short labels
export function activeFactors(s) {
  const out = [];
  for (const d of DRIVER) if (s[d.key]) out.push(d.label);
  if (s.distraction !== 'none') out.push(DISTRACTIONS.find(d => d.key === s.distraction).label);
  if (s.road !== 'dry') out.push(ROADS.find(r => r.key === s.road).label + ' road');
  for (const c of CAR) if (s[c.key]) out.push(c.label);
  return out;
}

export const toUnit = (v, u) => v / UNITS[u].k;
export const fmtSpeed = (v, u, withUnit = true) => {
  const U = UNITS[u];
  return toUnit(v, u).toFixed(U.dp) + (withUnit ? ' ' + U.label : '');
};
export const fmt = (x, dp = 1) => (Math.abs(x) < 0.05 && dp === 1 ? '0.0' : x.toFixed(dp));
export const fmtM = x => (x >= 100 ? x.toFixed(0) : x.toFixed(1)) + ' m';

// Ruler-drop conversion (t = sqrt(2d/g), g = 9.8 m/s^2)
export const rulerTime = cm => Math.sqrt((2 * cm) / 100 / 9.8);

// Neat axis steps
export function niceStep(max, target = 5) {
  const raw = max / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
export const niceMax = (max, target = 5) => { const s = niceStep(max, target); return Math.max(s, Math.ceil(max / s - 1e-9) * s); };
