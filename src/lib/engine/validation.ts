import { getDef, isSeating } from "@/lib/catalog/elements";
import type { EventPlan, Layout, PlacedElement } from "@/lib/types";
import { expectedGuests } from "./costs";
import { aabb, center, dist, footprint, gap, insideVenue, intersects, seatIndex, totalSeats } from "./geometry";

export type Severity = "error" | "warning" | "info";

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  elementIds: string[];
}

const MIN_AISLE = 3;
const SQFT_PER_GUEST = 12;

export function validateLayout(ev: EventPlan, layout: Layout) {
  const issues: Issue[] = [];
  const els = layout.elements;
  const guests = expectedGuests(ev);
  const seats = totalSeats(layout);
  const area = layout.venue.widthFt * layout.venue.lengthFt;
  const add = (severity: Severity, id: string, title: string, detail: string, elementIds: string[] = []) =>
    issues.push({ id, severity, title, detail, elementIds });

  for (const el of els) {
    if (!insideVenue(aabb(el), layout))
      add("error", `oob-${el.id}`, `${el.label} is outside the venue`, "Drag it back inside the walls.", [el.id]);
  }

  // Overlaps (overlay items like speakers and plants may sit on other items)
  const solid = els.filter((e) => !getDef(e.kind).overlay);
  let tight = 0;
  const tightPairs: string[][] = [];
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if (intersects(aabb(a), aabb(b), 0.1)) {
        add("error", `overlap-${a.id}-${b.id}`, `${a.label} overlaps ${b.label}`, "Move one of them so guests and staff can pass.", [
          a.id,
          b.id,
        ]);
        continue;
      }
      if (!isSeating(a.kind) && !isSeating(b.kind)) continue;
      const bothRows = a.kind === "chair-row" && b.kind === "chair-row";
      if (gap(footprint(a), footprint(b)) < (bothRows ? 1.2 : MIN_AISLE)) {
        tight++;
        tightPairs.push([a.id, b.id]);
      }
    }
  }
  if (tight > 0) {
    const ids = [...new Set(tightPairs.flat())];
    const names = ids
      .slice(0, 4)
      .map((id) => els.find((e) => e.id === id)?.label)
      .join(", ");
    add(
      "warning",
      "aisles",
      `${tight} tight aisle${tight > 1 ? "s" : ""} around seating`,
      `Keep at least ${MIN_AISLE} ft between chairs and other items so servers and guests can move. Check ${names}${ids.length > 4 ? "…" : ""}.`,
      ids,
    );
  }

  if (seats < guests) {
    add("error", "seats-short", `Short by ${guests - seats} seats`, `${guests} guests expected but only ${seats} seats on this layout.`);
  } else if (guests > 0 && seats > guests * 1.4 && seats - guests >= 10) {
    add("info", "seats-extra", `${seats - guests} empty seats`, "You could remove a few tables to save on rentals and open up space.");
  }

  const sqft = guests > 0 ? area / guests : Infinity;
  if (sqft < SQFT_PER_GUEST) {
    add(
      "warning",
      "density",
      `Crowded: ${sqft.toFixed(1)} sq ft per guest`,
      `Seated events need roughly ${SQFT_PER_GUEST}+ sq ft per guest. Consider a bigger venue or fewer guests.`,
    );
  }

  const entries = els.filter((e) => getDef(e.kind).isEntry);
  const exits = els.filter((e) => getDef(e.kind).isExit || getDef(e.kind).isEntry);
  if (entries.length === 0) add("error", "no-entry", "No entry marked", "Add an entry so guests know where to arrive.");
  const neededExits = guests > 500 ? 3 : guests > 50 ? 2 : 1;
  if (exits.length < neededExits) {
    add(
      "error",
      "exits",
      `Needs ${neededExits} exits`,
      `Venues with ${guests} people need at least ${neededExits} separate ways out. Add an emergency exit.`,
    );
  }
  for (const ex of exits) {
    const blockers = solid.filter(
      (e) => e.id !== ex.id && e.kind !== "ramp" && !getDef(e.kind).isExit && !getDef(e.kind).isEntry && gap(footprint(e), aabb(ex)) < 3,
    );
    if (blockers.length) {
      add(
        "warning",
        `blocked-${ex.id}`,
        `${ex.label} is crowded`,
        `${blockers.map((b) => b.label).join(", ")} ${blockers.length > 1 ? "are" : "is"} within 3 ft of the doorway.`,
        [ex.id, ...blockers.map((b) => b.id)],
      );
    }
  }

  const accessible = ev.guests.filter((g) => g.accessible && g.rsvp !== "no");
  if (accessible.length) {
    const seatsById = seatIndex(layout);
    const doorPoints = exits.map((e) => center(aabb(e)));
    const far = accessible.filter((g) => {
      const s = g.seatId ? seatsById.get(g.seatId) : undefined;
      if (!s || doorPoints.length === 0) return false;
      return Math.min(...doorPoints.map((p) => dist(p, s))) > 35;
    });
    if (far.length) {
      add(
        "warning",
        "access-far",
        `${far.length} wheelchair user${far.length > 1 ? "s" : ""} seated far from exits`,
        "Seat guests with mobility needs within ~35 ft of a door. Auto-seating does this for you.",
      );
    }
    if (!els.some((e) => e.kind === "ramp"))
      add("info", "no-ramp", "Add a wheelchair ramp", `${accessible.length} guests need step-free access.`);
  }

  if (guests > 40 && !els.some((e) => e.kind === "restroom"))
    add("info", "restroom", "No restrooms marked", "Mark restrooms so guests and staff can find them.");
  if (!layout.venue.indoor && guests > 100 && !els.some((e) => e.kind === "generator"))
    add("info", "power", "Outdoor venue without backup power", "Add a generator for lights and sound.");
  const kids = ev.guests.filter((g) => g.child && g.rsvp !== "no").length;
  if (kids >= 6 && !els.some((e) => e.kind === "kids-zone"))
    add("info", "kids", `${kids} kids attending`, "A kids zone keeps little guests busy and parents relaxed.");

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 18 - warnings * 6 - infos * 2));
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return { score, issues, stats: { seats, guests, area, sqftPerGuest: sqft } };
}

export type ValidationResult = ReturnType<typeof validateLayout>;

/** Elements that should be highlighted for a set of issues */
export function issueElements(issues: Issue[]): Set<string> {
  return new Set(issues.flatMap((i) => i.elementIds));
}

export function elementsByLabel(layout: Layout, query: string): PlacedElement[] {
  const q = query.trim().toLowerCase();
  return layout.elements.filter((e) => e.label.toLowerCase() === q || e.kind === q || getDef(e.kind).label.toLowerCase().includes(q));
}
