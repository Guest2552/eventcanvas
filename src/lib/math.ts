/** Small numeric helpers shared by the layout engine and the canvas. */

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to the nearest half foot, the snapping step used across the blueprint. */
export function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

/** Rounds to the nearest even integer (video/canvas sizes that must divide cleanly). */
export function roundEven(value: number) {
  return Math.round(value / 2) * 2;
}
