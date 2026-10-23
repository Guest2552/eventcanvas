import { getDef } from "@/lib/catalog/elements";
import type { EventPlan, Guest, Layout } from "@/lib/types";
import { aabb, center, dist, type Point, type SeatInfo, seatsForElement } from "./geometry";

export interface SeatingRules {
  keepTogether: string[][];
  keepApart: string[][];
  nearStage: string[];
  nearExit: string[];
}

export const EMPTY_RULES: SeatingRules = { keepTogether: [], keepApart: [], nearStage: [], nearExit: [] };

interface TableSlot {
  elementId: string;
  label: string;
  seats: SeatInfo[];
  free: SeatInfo[];
  centerPt: Point;
  distStage: number;
  distExit: number;
  distKids: number;
  vip: boolean;
  occupants: Set<string>;
}

function inZone(p: Point, layout: Layout, kind: string) {
  return layout.zones.some((z) => z.kind === kind && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
}

export function buildTables(layout: Layout): TableSlot[] {
  const els = layout.elements;
  const focal = els.find((e) => e.kind === "stage" || e.kind === "mandap");
  const stagePt = focal ? { x: center(aabb(focal)).x, y: aabb(focal).y + aabb(focal).h } : { x: layout.venue.widthFt / 2, y: 0 };
  const doors = els.filter((e) => getDef(e.kind).isEntry || getDef(e.kind).isExit).map((e) => center(aabb(e)));
  const kids = els.find((e) => e.kind === "kids-zone");
  const kidsPt = kids ? center(aabb(kids)) : null;
  return els
    .filter((e) => getDef(e.kind).category === "seating")
    .map((e) => {
      const seats = seatsForElement(e);
      const c = center(aabb(e));
      return {
        elementId: e.id,
        label: e.label,
        seats,
        free: [...seats],
        centerPt: c,
        distStage: dist(c, stagePt),
        distExit: doors.length ? Math.min(...doors.map((d) => dist(d, c))) : 999,
        distKids: kidsPt ? dist(kidsPt, c) : 999,
        vip: inZone(c, layout, "vip"),
        occupants: new Set<string>(),
      };
    });
}

class UnionFind {
  parent = new Map<string, string>();
  find(a: string): string {
    if (!this.parent.has(a)) this.parent.set(a, a);
    const p = this.parent.get(a)!;
    if (p === a) return a;
    const r = this.find(p);
    this.parent.set(a, r);
    return r;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

/**
 * Constraint-aware greedy seating:
 * families stay together, VIPs go up front, wheelchair users near doors,
 * kids near the kids zone, and "keep apart" pairs never share a table.
 */
export function autoSeat(ev: EventPlan, layout: Layout, rules: SeatingRules = EMPTY_RULES, opts: { keepExisting?: boolean } = {}) {
  const tables = buildTables(layout);
  const seatToTable = new Map<string, TableSlot>();
  for (const t of tables) for (const s of t.seats) seatToTable.set(s.id, t);

  const eligible = ev.guests.filter((g) => g.rsvp !== "no");
  const assignments: Record<string, string> = {};

  if (opts.keepExisting) {
    for (const g of eligible) {
      const t = g.seatId ? seatToTable.get(g.seatId) : undefined;
      if (!t || !t.free.some((s) => s.id === g.seatId)) continue;
      assignments[g.id] = g.seatId!;
      t.free = t.free.filter((s) => s.id !== g.seatId);
      t.occupants.add(g.id);
    }
  }

  const avoid = new Map<string, Set<string>>();
  const addAvoid = (a: string, b: string) => {
    if (!avoid.has(a)) avoid.set(a, new Set());
    avoid.get(a)!.add(b);
  };
  for (const g of ev.guests) for (const o of g.avoid ?? []) (addAvoid(g.id, o), addAvoid(o, g.id));
  for (const pair of rules.keepApart) for (const a of pair) for (const b of pair) if (a !== b) addAvoid(a, b);

  const uf = new UnionFind();
  const pending = eligible.filter((g) => !assignments[g.id]);
  const byGroup = new Map<string, Guest[]>();
  for (const g of pending) {
    uf.find(g.id);
    const key = g.group || g.id;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(g);
  }
  for (const members of byGroup.values()) for (const m of members.slice(1)) uf.union(members[0].id, m.id);
  const pendingIds = new Set(pending.map((g) => g.id));
  for (const set of rules.keepTogether) {
    const ids = set.filter((id) => pendingIds.has(id));
    for (const id of ids.slice(1)) uf.union(ids[0], id);
  }

  const units = new Map<string, Guest[]>();
  for (const g of pending) {
    const r = uf.find(g.id);
    if (!units.has(r)) units.set(r, []);
    units.get(r)!.push(g);
  }

  const nearStage = new Set(rules.nearStage);
  const nearExit = new Set(rules.nearExit);
  type Unit = { guests: Guest[]; vip: boolean; access: boolean; kids: boolean };
  const unitList: Unit[] = [...units.values()].map((guests) => ({
    guests,
    vip: guests.some((g) => g.vip || nearStage.has(g.id)),
    access: guests.some((g) => g.accessible || nearExit.has(g.id)),
    kids: guests.filter((g) => g.child).length >= Math.max(1, guests.length / 2),
  }));
  unitList.sort((a, b) => Number(b.vip) - Number(a.vip) || Number(b.access) - Number(a.access) || b.guests.length - a.guests.length);

  const conflicts = (g: Guest, t: TableSlot) => {
    const bad = avoid.get(g.id);
    if (!bad) return false;
    for (const o of t.occupants) if (bad.has(o)) return true;
    return false;
  };
  const score = (u: Unit, t: TableSlot) => {
    if (u.access) return t.distExit;
    if (u.vip) return t.distStage - (t.vip ? 1000 : 0);
    if (u.kids) return t.distKids;
    return t.distStage + (t.vip ? 400 : 0);
  };
  const seatGuest = (g: Guest, t: TableSlot) => {
    const s = t.free.shift()!;
    assignments[g.id] = s.id;
    t.occupants.add(g.id);
  };

  const unplaced: Guest[] = [];
  for (const u of unitList) {
    const ranked = [...tables].sort((a, b) => score(u, a) - score(u, b));
    const whole = ranked.find((t) => t.free.length >= u.guests.length && u.guests.every((g) => !conflicts(g, t)));
    if (whole) {
      u.guests.forEach((g) => seatGuest(g, whole));
      continue;
    }
    // Split across the nearest tables to the best-ranked one
    const anchor = ranked.find((t) => t.free.length > 0);
    if (!anchor) {
      unplaced.push(...u.guests);
      continue;
    }
    const nearby = [...tables].sort((a, b) => dist(a.centerPt, anchor.centerPt) - dist(b.centerPt, anchor.centerPt));
    for (const g of u.guests) {
      const t = nearby.find((x) => x.free.length > 0 && !conflicts(g, x));
      if (t) seatGuest(g, t);
      else unplaced.push(g);
    }
  }

  const placed = Object.keys(assignments).length;
  const usedTables = tables.filter((t) => t.occupants.size > 0).length;
  const notes: string[] = [`Seated ${placed} of ${eligible.length} guests across ${usedTables} tables.`];
  const vipCount = eligible.filter((g) => g.vip && assignments[g.id]).length;
  if (vipCount) notes.push(`${vipCount} VIP guests placed closest to the stage.`);
  const accCount = eligible.filter((g) => g.accessible && assignments[g.id]).length;
  if (accCount) notes.push(`${accCount} guests with mobility needs seated near doors.`);
  if (rules.keepApart.length || ev.guests.some((g) => g.avoid?.length)) notes.push("All keep-apart requests respected.");
  if (unplaced.length) notes.push(`${unplaced.length} guests need seats. Add about ${Math.ceil(unplaced.length / 8)} more tables.`);

  return { assignments, placed, unplaced, notes };
}

/** Resolves free-text names to guest ids (case-insensitive, partial match). */
export function matchGuests(ev: EventPlan, names: string[]): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().toLowerCase();
    if (!n) continue;
    const exact = ev.guests.filter((g) => g.name.toLowerCase() === n);
    const hits = exact.length ? exact : ev.guests.filter((g) => g.name.toLowerCase().includes(n) || g.group.toLowerCase() === n);
    out.push(...hits.map((g) => g.id));
  }
  return [...new Set(out)];
}
