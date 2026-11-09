// Colour for a flow speed 0…1, blue (slow) to red (fast), as in a CFD plot. Shared by the team tiles and
// the Aerodynamics backdrop (which also runs in a worker, so this has no React in it).
const SPEED = [[0, '#1d4fd8'], [0.25, '#18b8e6'], [0.5, '#29d17a'], [0.72, '#f3e64a'], [1, '#ff3b2f']];
export const speedColour = (v) => {
  const i = SPEED.findIndex(([s]) => s >= v);
  if (i <= 0) return SPEED[0][1];
  const [a, ca] = SPEED[i - 1], [b, cb] = SPEED[i], t = (v - a) / (b - a);
  const p = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [x, y] = [p(ca), p(cb)];
  return `rgb(${x.map((n, k) => Math.round(n + (y[k] - n) * t)).join(',')})`;
};
