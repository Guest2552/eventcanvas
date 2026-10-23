import { chairRing, getDef, seatCount } from "@/lib/catalog/elements";
import type { Layout, PlacedElement } from "@/lib/types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export function center(el: Box): Point {
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}

/** Axis-aligned bounding box of a (possibly rotated) element. */
export function aabb(el: PlacedElement): Box {
  const r = (((el.rotation % 360) + 360) % 360) * (Math.PI / 180);
  if (r === 0 || Math.abs(r - Math.PI) < 1e-6) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const c = center(el);
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const w = el.w * cos + el.h * sin;
  const h = el.w * sin + el.h * cos;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Bounding box including the chairs around a table. */
export function footprint(el: PlacedElement): Box {
  return inflate(aabb(el), chairRing(el.kind));
}

export function inflate(b: Box, d: number): Box {
  return { x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d };
}

export function intersects(a: Box, b: Box, tolerance = 0): boolean {
  return a.x + a.w - tolerance > b.x && b.x + b.w - tolerance > a.x && a.y + a.h - tolerance > b.y && b.y + b.h - tolerance > a.y;
}

/** Shortest distance between two boxes (0 when they touch or overlap). */
export function gap(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

export function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function insideVenue(b: Box, layout: Layout, tolerance = 0.5) {
  const v = layout.venue;
  return b.x >= -tolerance && b.y >= -tolerance && b.x + b.w <= v.widthFt + tolerance && b.y + b.h <= v.lengthFt + tolerance;
}

export function snap(v: number, step: number) {
  return step > 0 ? Math.round(v / step) * step : v;
}

export interface SeatInfo {
  id: string;
  elementId: string;
  index: number;
  label: string;
  tableLabel: string;
  /** local position inside the element, in feet */
  lx: number;
  ly: number;
  /** absolute venue position, in feet */
  x: number;
  y: number;
}

/** Seat positions relative to an element's top-left corner (un-rotated). */
export function localSeats(kind: string, w: number, h: number): Point[] {
  const def = getDef(kind);
  const n = seatCount(kind, w);
  if (n === 0) return [];
  if (def.shape === "round") {
    const r = w / 2 + 1.1;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r };
    });
  }
  if (def.shape === "rect") {
    const perSide = n / 2;
    const step = w / perSide;
    const top = Array.from({ length: perSide }, (_, i) => ({ x: step * (i + 0.5), y: -1.1 }));
    const bottom = Array.from({ length: perSide }, (_, i) => ({ x: step * (i + 0.5), y: h + 1.1 }));
    return [...top, ...bottom];
  }
  const step = w / n;
  return Array.from({ length: n }, (_, i) => ({ x: step * (i + 0.5), y: h / 2 }));
}

export function seatsForElement(el: PlacedElement): SeatInfo[] {
  const local = localSeats(el.kind, el.w, el.h);
  const c = center(el);
  const r = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return local.map((p, i) => {
    const dx = p.x - el.w / 2;
    const dy = p.y - el.h / 2;
    return {
      id: `${el.id}:${i}`,
      elementId: el.id,
      index: i,
      label: `${el.label} · Seat ${i + 1}`,
      tableLabel: el.label,
      lx: p.x,
      ly: p.y,
      x: c.x + dx * cos - dy * sin,
      y: c.y + dx * sin + dy * cos,
    };
  });
}

export function allSeats(layout: Layout): SeatInfo[] {
  return layout.elements.flatMap(seatsForElement);
}

export function seatIndex(layout: Layout): Map<string, SeatInfo> {
  return new Map(allSeats(layout).map((s) => [s.id, s]));
}

export function totalSeats(layout: Layout) {
  return layout.elements.reduce((n, el) => n + seatCount(el.kind, el.w), 0);
}

/** Next free table label like "T7" (or "R3" for chair rows). */
export function nextTableLabel(layout: Layout, prefix = "T") {
  const used = new Set(layout.elements.map((e) => e.label));
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function defaultLabel(layout: Layout, kind: string) {
  if (kind === "chair-row") return nextTableLabel(layout, "R");
  if (getDef(kind).category === "seating" && kind !== "sofa") return nextTableLabel(layout);
  const base = getDef(kind).label;
  const same = layout.elements.filter((e) => e.kind === kind).length;
  return same ? `${base} ${same + 1}` : base;
}
