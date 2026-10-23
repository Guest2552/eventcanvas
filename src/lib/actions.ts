/**
 * Plan mutations shared by the UI and the AI assistant's tools.
 * All functions take an immer draft of the event.
 */
import type { Draft } from "immer";
import { nanoid } from "nanoid";
import { getDef } from "@/lib/catalog/elements";
import { ZONE_KINDS } from "@/lib/catalog/planning";
import { aabb, center, defaultLabel, type Point } from "@/lib/engine/geometry";
import { findFreeSpot } from "@/lib/engine/layout";
import type { BudgetSuggestion } from "@/lib/engine/offline";
import { draftLayout } from "@/lib/store";
import type { EventPlan, Layout, PlacedElement, ZoneKind } from "@/lib/types";

type D = Draft<EventPlan>;

/** Finds elements by label ("T4"), kind ("dj-booth") or catalog name ("photo booth"). */
export function resolveElements(layout: Layout, query: string): PlacedElement[] {
  const q = query.trim().toLowerCase().replace(/s$/, "");
  if (!q) return [];
  const byLabel = layout.elements.filter((e) => e.label.toLowerCase() === q || e.label.toLowerCase() === query.trim().toLowerCase());
  if (byLabel.length) return byLabel;
  const byKind = layout.elements.filter((e) => e.kind === q || e.kind === q.replace(/\s+/g, "-"));
  if (byKind.length) return byKind;
  const byName = layout.elements.filter((e) => getDef(e.kind).label.toLowerCase().includes(q) || e.label.toLowerCase().includes(q));
  if (byName.length) return byName;
  // Loose phrasing like "the DJ" or "kidzone"
  const alias = resolveKind(q.replace(/^the\s+/, "")) ?? resolveKind(q.replace(/zone$/, " zone"));
  return alias ? layout.elements.filter((e) => e.kind === alias) : [];
}

export function resolveKind(query: string): string | null {
  const q = query.trim().toLowerCase();
  const direct = q.replace(/\s+/g, "-");
  if (getDef(direct).label !== direct) return direct;
  const aliases: Record<string, string> = {
    table: "round-8", "round table": "round-8", "dining table": "round-8", chairs: "chair-row", "chair row": "chair-row", dj: "dj-booth", "photo booth": "photo-booth",
    "selfie booth": "photo-booth", cake: "cake-table", buffet: "buffet", food: "buffet", bar: "bar", drinks: "bar", "dance floor": "dance-floor", stage: "stage",
    mandap: "mandap", "kids area": "kids-zone", "kids zone": "kids-zone", "play area": "kids-zone", screen: "led-screen", "led wall": "led-screen", speakers: "speaker",
    speaker: "speaker", flowers: "plant", plants: "plant", gifts: "gift-table", "gift table": "gift-table", registration: "registration", "help desk": "registration",
    restroom: "restroom", toilet: "restroom", washroom: "restroom", exit: "exit", entry: "entry", entrance: "entry", ramp: "ramp", generator: "generator", sofa: "sofa", lounge: "sofa",
  };
  for (const [k, v] of Object.entries(aliases)) if (q.includes(k)) return v;
  return null;
}

function refPoint(layout: Layout, ref?: string): Point | undefined {
  if (!ref) return undefined;
  const target = resolveElements(layout, ref)[0];
  if (target) return center(aabb(target));
  const zone = layout.zones.find((z) => z.name.toLowerCase().includes(ref.toLowerCase()) || z.kind === ref.toLowerCase());
  if (zone) return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
  return undefined;
}

export function addElement(d: D, kind: string, opts: { x?: number; y?: number; near?: string; label?: string } = {}): PlacedElement | null {
  const layout = draftLayout(d) as Layout;
  const def = getDef(kind);
  let pos: Point | null;
  if (opts.x !== undefined && opts.y !== undefined) {
    pos = { x: Math.round((opts.x - def.w / 2) * 2) / 2, y: Math.round((opts.y - def.h / 2) * 2) / 2 };
  } else {
    pos = findFreeSpot(layout, kind, { near: refPoint(layout, opts.near) });
  }
  if (!pos) return null;
  const el: PlacedElement = { id: nanoid(8), kind, x: pos.x, y: pos.y, w: def.w, h: def.h, rotation: 0, label: opts.label ?? defaultLabel(layout, kind) };
  draftLayout(d).elements.push(el);
  return el;
}

export function moveElement(d: D, target: string, opts: { near?: string; awayFrom?: string; x?: number; y?: number }): { moved: PlacedElement; distance: number } | null {
  const layout = draftLayout(d) as Layout;
  const el = resolveElements(layout, target)[0];
  if (!el) return null;
  const before = center(aabb(el));
  let pos: Point | null = null;
  if (opts.x !== undefined && opts.y !== undefined) pos = { x: opts.x, y: opts.y };
  else if (opts.awayFrom) {
    const from = refPoint(layout, opts.awayFrom);
    if (from) pos = findFreeSpot(layout, el.kind, { awayFrom: from, w: el.w, h: el.h, ignoreId: el.id });
  } else if (opts.near) {
    const near = refPoint(layout, opts.near);
    if (near) pos = findFreeSpot(layout, el.kind, { near, w: el.w, h: el.h, ignoreId: el.id });
  }
  if (!pos) return null;
  const draftEl = draftLayout(d).elements.find((e) => e.id === el.id)!;
  draftEl.x = pos.x;
  draftEl.y = pos.y;
  const after = { x: pos.x + el.w / 2, y: pos.y + el.h / 2 };
  return { moved: { ...el, x: pos.x, y: pos.y }, distance: Math.round(Math.hypot(after.x - before.x, after.y - before.y)) };
}

/** Swaps the positions of two items (centre to centre), keeping each inside the venue. */
export function swapElements(d: D, a: string, b: string): { a: PlacedElement; b: PlacedElement } | null {
  const layout = draftLayout(d) as Layout;
  const ea = resolveElements(layout, a)[0];
  const eb = resolveElements(layout, b)[0];
  if (!ea || !eb || ea.id === eb.id) return null;
  const ca = center(aabb(ea));
  const cb = center(aabb(eb));
  const { widthFt: W, lengthFt: H } = layout.venue;
  const put = (el: PlacedElement, c: Point) => {
    const target = draftLayout(d).elements.find((e) => e.id === el.id)!;
    target.x = Math.round(Math.min(Math.max(0, c.x - el.w / 2), W - el.w) * 2) / 2;
    target.y = Math.round(Math.min(Math.max(0, c.y - el.h / 2), H - el.h) * 2) / 2;
  };
  // Copy before mutating: drafts are revoked once the update finishes
  const result = { a: { ...ea }, b: { ...eb } };
  put(ea, cb);
  put(eb, ca);
  return result;
}

export function removeElements(d: D, ids: string[]) {
  const layout = draftLayout(d);
  const set = new Set(ids);
  layout.elements = layout.elements.filter((e) => !set.has(e.id));
  for (const g of d.guests) if (g.seatId && set.has(g.seatId.split(":")[0])) g.seatId = undefined;
  d.bookings = d.bookings.filter((b) => !set.has(b.seatId.split(":")[0]));
}

export function duplicateElement(d: D, id: string): PlacedElement | null {
  const layout = draftLayout(d);
  const src = layout.elements.find((e) => e.id === id);
  if (!src) return null;
  const copy: PlacedElement = { ...src, id: nanoid(8), x: src.x + 2, y: src.y + 2, label: defaultLabel(layout as Layout, src.kind) };
  layout.elements.push(copy);
  return copy;
}

export function addZone(d: D, box: { x: number; y: number; w: number; h: number }, kind: ZoneKind = "custom", name = "New zone") {
  const zone = { id: nanoid(8), name, kind, color: ZONE_KINDS[kind].color, ...box };
  draftLayout(d).zones.push(zone);
  return zone;
}

export function applySuggestion(d: D, s: BudgetSuggestion) {
  if (!s.action) return false;
  if (s.action.type === "perPlate") {
    d.budget.perPlate = s.action.value;
    return true;
  }
  if (s.action.type === "removeTables") {
    const layout = draftLayout(d);
    const kind = s.action.kind;
    // Remove the emptiest tables of that kind first (furthest from the stage on ties)
    const occupancy = new Map<string, number>();
    for (const g of d.guests) if (g.seatId) occupancy.set(g.seatId.split(":")[0], (occupancy.get(g.seatId.split(":")[0]) ?? 0) + 1);
    const candidates = layout.elements
      .filter((e) => e.kind === kind)
      .sort((a, b) => (occupancy.get(a.id) ?? 0) - (occupancy.get(b.id) ?? 0) || b.y - a.y)
      .slice(0, s.action.count)
      .map((e) => e.id);
    removeElements(d, candidates);
    return true;
  }
  return false;
}
