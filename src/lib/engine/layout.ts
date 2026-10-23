import { nanoid } from "nanoid";
import { chairRing, getDef, seatCount, TABLE_KINDS, type TableKind } from "@/lib/catalog/elements";
import { ZONE_KINDS } from "@/lib/catalog/planning";
import { clamp, roundHalf } from "@/lib/math";
import type { Fixture } from "@/lib/catalog/templates";
import type { EventType, Layout, PlacedElement, Venue, Zone, ZoneKind } from "@/lib/types";
import { aabb, type Box, center, defaultLabel, dist, footprint, inflate, intersects, type Point } from "./geometry";

export interface LayoutIntent {
  tableKind: TableKind;
  include: string[];
  vipRows: number;
}

export function defaultIntent(type: EventType, guestCount: number, indoor = true): LayoutIntent {
  const base: Record<EventType, string[]> = {
    wedding: ["stage", "dance-floor", "dj-booth", "speaker", "buffet", "cake-table", "photo-booth", "registration", "gift-table", "plant"],
    birthday: ["stage", "dance-floor", "dj-booth", "speaker", "buffet", "cake-table", "photo-booth", "kids-zone", "gift-table"],
    community: ["stage", "speaker", "led-screen", "buffet", "registration"],
    corporate: ["stage", "led-screen", "speaker", "buffet", "bar", "registration", "photo-booth"],
  };
  const include = [...base[type]];
  if (type === "wedding" && guestCount > 120) include.push("kids-zone");
  if (!indoor && guestCount > 100) include.push("generator");
  if (guestCount > 150) include.push("ramp");
  let tableKind: TableKind = "round-8";
  if (type === "community" && guestCount > 120) tableKind = "chair-row";
  else if (type === "wedding" && guestCount > 150) tableKind = "round-10";
  else if (type === "birthday" && guestCount < 40) tableKind = "round-6";
  return { tableKind, include, vipRows: type === "birthday" ? 0 : 1 };
}

export function sanitizeIntent(raw: Partial<LayoutIntent> | undefined, fallback: LayoutIntent): LayoutIntent {
  const tableKind = TABLE_KINDS.includes(raw?.tableKind as TableKind) ? (raw!.tableKind as TableKind) : fallback.tableKind;
  const include = (raw?.include ?? fallback.include).filter((k) => getDef(k).label !== k && getDef(k).category !== "seating");
  return {
    tableKind,
    include: include.length ? include : fallback.include,
    vipRows: Math.max(0, Math.min(3, raw?.vipRows ?? fallback.vipRows)),
  };
}

interface Builder {
  venue: Venue;
  els: PlacedElement[];
}

function asLayout(b: Builder): Layout {
  return { id: "tmp", name: "", venue: b.venue, elements: b.els, zones: [] };
}

function make(b: Builder, kind: string, x: number, y: number, w?: number, h?: number, label?: string): PlacedElement {
  const def = getDef(kind);
  return {
    id: nanoid(8),
    kind,
    x: roundHalf(x),
    y: roundHalf(y),
    w: w ?? def.w,
    h: h ?? def.h,
    rotation: 0,
    label: label ?? defaultLabel(asLayout(b), kind),
  };
}

const isDoor = (e: PlacedElement) => !!(getDef(e.kind).isEntry || getDef(e.kind).isExit);

/** True when `box` is inside the venue and keeps `clearance` ft from every solid item (3 ft from doors). */
function fits(b: Builder, box: Box, clearance: number, doorClearance = 3): boolean {
  const { widthFt: W, lengthFt: H } = b.venue;
  if (box.x < 0.5 || box.y < 0.5 || box.x + box.w > W - 0.5 || box.y + box.h > H - 0.5) return false;
  for (const e of b.els) {
    if (getDef(e.kind).overlay) continue;
    const c = isDoor(e) ? Math.max(clearance, doorClearance) : clearance;
    if (intersects(box, inflate(footprint(e), c), 0.01)) return false;
  }
  return true;
}

interface SpotOpts {
  w?: number;
  h?: number;
  clearance?: number;
  doorClearance?: number;
}

/** Scans the floor on a 1 ft grid and returns the free top-left position with the lowest score. */
function bestSpot(b: Builder, kind: string, score: (c: Point) => number, opts: SpotOpts = {}): Point | null {
  const def = getDef(kind);
  const w = opts.w ?? def.w;
  const h = opts.h ?? def.h;
  const ring = chairRing(kind);
  const { widthFt: W, lengthFt: H } = b.venue;
  let best: Point | null = null;
  let bestScore = Infinity;
  for (let y = 1; y + h <= H - 0.5; y += 1) {
    for (let x = 1; x + w <= W - 0.5; x += 1) {
      if (!fits(b, inflate({ x, y, w, h }, ring), opts.clearance ?? 2, opts.doorClearance)) continue;
      const s = score({ x: x + w / 2, y: y + h / 2 });
      if (s < bestScore) {
        bestScore = s;
        best = { x, y };
      }
    }
  }
  return best;
}

function placeBest(b: Builder, kind: string, score: (c: Point) => number, opts: SpotOpts & { label?: string } = {}) {
  const spot = bestSpot(b, kind, score, opts);
  if (!spot) return null;
  const el = make(b, kind, spot.x, spot.y, opts.w, opts.h, opts.label);
  b.els.push(el);
  return el;
}

/** Public helper for the editor and AI tools: free spot closest to `near`, or furthest from `awayFrom`. */
export function findFreeSpot(
  layout: Layout,
  kind: string,
  opts: { near?: Point; awayFrom?: Point; w?: number; h?: number; ignoreId?: string } = {},
): Point | null {
  const b: Builder = { venue: layout.venue, els: layout.elements.filter((e) => e.id !== opts.ignoreId) };
  const target = opts.near ?? { x: layout.venue.widthFt / 2, y: layout.venue.lengthFt / 2 };
  const score = opts.awayFrom ? (c: Point) => -dist(c, opts.awayFrom!) : (c: Point) => dist(c, target);
  // 3 ft matches the aisle rule in the safety check; tighter spots are a fallback for packed rooms
  for (const clearance of [3, 2, 1]) {
    const spot = bestSpot(b, kind, score, { w: opts.w, h: opts.h, clearance });
    if (spot) return spot;
  }
  return null;
}

/** Greedy scan-line packing of tables, then keeps the ones nearest the stage. */
function packSeating(b: Builder, kind: string, needed: number, anchor: Point, minY = 0): PlacedElement[] {
  const def = getDef(kind);
  const ring = chairRing(kind);
  const rows = kind === "chair-row";
  const fw = def.w + 2 * ring;
  const fh = def.h + 2 * ring;
  const gapX = rows ? 4 : 3;
  const gapY = rows ? 1.5 : 3;
  const { widthFt: W, lengthFt: H } = b.venue;
  const packed: Box[] = [];
  const clearOfPacked = (box: Box) =>
    packed.every((p) => !intersects(box, { x: p.x - gapX, y: p.y - gapY, w: p.w + 2 * gapX, h: p.h + 2 * gapY }, 0.01));

  for (let y = Math.max(1, Math.ceil(minY)); y + fh <= H - 0.5; y += 1) {
    for (let x = 1; x + fw <= W - 0.5; x += 1) {
      const box = { x, y, w: fw, h: fh };
      if (!clearOfPacked(box) || !fits(b, box, 3)) continue;
      packed.push(box);
      x += fw + gapX - 1;
    }
  }

  const per = seatCount(kind, def.w);
  const chosen = packed
    .map((p) => ({ p, d: dist({ x: p.x + fw / 2, y: p.y + fh / 2 }, anchor) }))
    .sort((a, c) => a.d - c.d)
    .slice(0, Math.ceil(needed / per))
    .map(({ p }) => p)
    .sort((a, c) => Math.round(a.y / 4) - Math.round(c.y / 4) || a.x - c.x);

  const prefix = rows ? "R" : "T";
  const used = new Set(b.els.map((e) => e.label));
  let n = 1;
  return chosen.map((p) => {
    while (used.has(`${prefix}${n}`)) n++;
    const el = make(b, kind, p.x + ring, p.y + ring, undefined, undefined, `${prefix}${n++}`);
    b.els.push(el);
    return el;
  });
}

function zone(kind: ZoneKind, name: string, box: Box): Zone {
  return {
    id: nanoid(8),
    kind,
    name,
    color: ZONE_KINDS[kind].color,
    x: roundHalf(box.x),
    y: roundHalf(box.y),
    w: roundHalf(box.w),
    h: roundHalf(box.h),
  };
}

function bbox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

export function fixturesToElements(venue: Venue, fixtures: Fixture[]): PlacedElement[] {
  const b: Builder = { venue, els: [] };
  for (const f of fixtures) b.els.push(make(b, f.kind, f.x, f.y, f.w, f.h, f.label));
  return b.els;
}

/** Items dropped first when a small venue can't seat everyone. */
const OPTIONAL = [
  "kids-zone",
  "photo-booth",
  "bar",
  "sofa",
  "gift-table",
  "dj-booth",
  "dance-floor",
  "cake-table",
  "registration",
  "led-screen",
  "buffet",
  "stage",
  "mandap",
];

function attempt(venue: Venue, fixtures: PlacedElement[], guestCount: number, intent: LayoutIntent) {
  const W = venue.widthFt;
  const H = venue.lengthFt;
  const b: Builder = { venue, els: fixtures.map((f) => ({ ...f, id: nanoid(8) })) };
  const has = (k: string) => intent.include.includes(k);
  const entry = b.els.find((e) => getDef(e.kind).isEntry);
  const entryPt = entry ? center(aabb(entry)) : { x: W / 2, y: H };

  let focal: PlacedElement | null = null;
  const focalKind = has("mandap") ? "mandap" : has("stage") ? "stage" : null;
  if (focalKind) {
    const def = getDef(focalKind);
    const w = Math.round(clamp(guestCount * 0.1 + 10, Math.min(10, W * 0.35), Math.min(def.w, W * 0.35)));
    const h = Math.round(clamp(focalKind === "mandap" ? w : w * 0.45, 5, Math.min(def.h, H * 0.18)));
    focal = placeBest(b, focalKind, (c) => dist(c, { x: W / 2, y: 0 }), { w, h });
  }
  if (focal && has("mandap") && has("stage"))
    placeBest(b, "stage", (c) => dist(c, { x: W / 2, y: 0 }) + (c.y > focal!.y + focal!.h ? 50 : 0));
  const fb = focal ? aabb(focal) : { x: W / 2 - 5, y: 0, w: 10, h: 2 };

  if (focal && has("led-screen")) b.els.push(make(b, "led-screen", fb.x + fb.w / 2 - 6, fb.y + 0.5));
  if (focal && has("speaker")) {
    b.els.push(make(b, "speaker", fb.x - 2.5, fb.y + fb.h - 2));
    b.els.push(make(b, "speaker", fb.x + fb.w + 0.5, fb.y + fb.h - 2));
  }
  if (has("dj-booth")) placeBest(b, "dj-booth", (c) => dist(c, { x: fb.x + fb.w + 7, y: fb.y + fb.h / 2 }));
  if (has("cake-table")) placeBest(b, "cake-table", (c) => dist(c, { x: fb.x - 5, y: fb.y + fb.h }));

  let dance: PlacedElement | null = null;
  if (has("dance-floor")) {
    const s = Math.round(clamp(Math.sqrt(guestCount * 2.5), 9, Math.max(9, Math.min(20, W * 0.22, H * 0.25))));
    dance = placeBest(b, "dance-floor", (c) => dist(c, { x: W / 2, y: fb.y + fb.h + 5 + s / 2 }), { w: s, h: s });
  }

  const wallScore = (preferLeft: boolean | null) => (c: Point) => {
    const side = preferLeft === null ? Math.min(c.x, W - c.x) : preferLeft ? c.x : W - c.x;
    return side + 0.3 * Math.abs(c.y - H * 0.45);
  };
  let buffetLeft: boolean | null = null;
  if (has("buffet")) {
    const len = Math.round(clamp(guestCount / 10, 8, Math.min(20, H * 0.3)));
    const buffet = placeBest(b, "buffet", wallScore(null), { w: 4, h: len });
    if (buffet) buffetLeft = buffet.x < W / 2;
  }
  if (has("bar")) placeBest(b, "bar", wallScore(buffetLeft === null ? null : !buffetLeft), { w: 4, h: 10 });
  if (has("photo-booth")) placeBest(b, "photo-booth", (c) => dist(c, { x: 0, y: H * 0.85 }));
  if (has("kids-zone")) {
    const s = Math.round(clamp(guestCount / 12, 10, Math.min(15, W * 0.18)));
    placeBest(b, "kids-zone", (c) => dist(c, { x: W, y: H * 0.85 }), { w: s, h: s });
  }
  if (entry) {
    if (has("registration")) placeBest(b, "registration", (c) => dist(c, { x: entry.x + entry.w + 7, y: entry.y - 4 }));
    if (has("gift-table")) placeBest(b, "gift-table", (c) => dist(c, { x: entry.x - 5, y: entry.y - 4 }));
    if (has("ramp")) placeBest(b, "ramp", (c) => dist(c, { x: entry.x - 4, y: entry.y + 1 }), { clearance: 0.5, doorClearance: 0.5 });
    if (has("plant")) {
      for (const px of [entry.x - 3.5, entry.x + entry.w + 0.5]) {
        if (px >= 0 && px + 3 <= W) b.els.push(make(b, "plant", px, Math.min(entry.y - 0.5, H - 3)));
      }
    }
  }
  if (has("generator")) placeBest(b, "generator", (c) => dist(c, { x: W, y: 0 }) + (c.y < 10 ? 0 : 0));
  if (has("sofa")) placeBest(b, "sofa", (c) => dist(c, { x: W * 0.8, y: H * 0.6 }));

  for (const kind of intent.include) {
    if (b.els.some((e) => e.kind === kind) || getDef(kind).category === "seating" || getDef(kind).overlay) continue;
    placeBest(b, kind, (c) => Math.min(c.x, W - c.x, H - c.y) + dist(c, entryPt) * 0.1);
  }

  const anchor = focal ? { x: fb.x + fb.w / 2, y: fb.y + fb.h } : { x: W / 2, y: 0 };
  const needed = guestCount;
  // Audience rows must face the stage, so none go beside it
  const minY = focal && intent.tableKind === "chair-row" ? fb.y + fb.h + 3 : 0;
  const tables = packSeating(b, intent.tableKind, needed, anchor, minY);
  let seats = tables.reduce((n, t) => n + seatCount(t.kind, t.w), 0);
  for (const backup of ["round-6", "rect-6"]) {
    if (seats >= needed || intent.tableKind === "chair-row") break;
    const extra = packSeating(b, backup, needed - seats, anchor);
    tables.push(...extra);
    seats += extra.reduce((n, t) => n + seatCount(t.kind, t.w), 0);
  }

  const zones: Zone[] = [];
  if (focal) zones.push(zone("ceremony", focal.kind === "mandap" ? "Mandap" : "Stage", inflate(fb, 2)));
  if (dance) zones.push(zone("dance", "Dance floor", inflate(aabb(dance), 1.5)));
  if (intent.vipRows > 0 && tables.length > 3) {
    const k = Math.max(2, Math.round(tables.length * 0.12 * intent.vipRows));
    const vip = [...tables].sort((p, q) => dist(center(aabb(p)), anchor) - dist(center(aabb(q)), anchor)).slice(0, k);
    zones.push(zone("vip", intent.tableKind === "chair-row" ? "Front rows (VIP)" : "VIP tables", inflate(bbox(vip.map(footprint)), 1)));
  }
  const kids = b.els.find((e) => e.kind === "kids-zone");
  if (kids) zones.push(zone("kids", "Kids corner", inflate(aabb(kids), 1)));
  for (const f of b.els.filter((e) => e.kind === "buffet" || e.kind === "bar"))
    zones.push(zone("service", f.kind === "bar" ? "Bar" : "Food court", inflate(aabb(f), 2)));

  return { elements: b.els, zones, seats, needed };
}

/**
 * Deterministic layout engine. The AI only decides *what* goes in the room (the intent);
 * this places everything on the floor plan with aisles and clearances, dropping optional
 * extras if the room can't otherwise seat everyone.
 */
export function autoLayout(input: { venue: Venue; fixtures: PlacedElement[]; guestCount: number; intent: LayoutIntent }) {
  let intent = { ...input.intent, include: [...input.intent.include] };
  let result = attempt(input.venue, input.fixtures, input.guestCount, intent);
  const dropped: string[] = [];
  for (const kind of OPTIONAL) {
    if (result.seats >= result.needed) break;
    if (!intent.include.includes(kind)) continue;
    intent = { ...intent, include: intent.include.filter((k) => k !== kind) };
    dropped.push(kind);
    result = attempt(input.venue, input.fixtures, input.guestCount, intent);
  }
  return { elements: result.elements, zones: result.zones, seats: result.seats, dropped };
}
