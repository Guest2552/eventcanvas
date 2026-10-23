import { describe, expect, it } from "vitest";
import { getDef } from "@/lib/catalog/elements";
import { VENUE_TEMPLATES } from "@/lib/catalog/templates";
import { createDemoCommunity, createDemoWedding } from "@/lib/seed/demo";
import { activeLayout, blueprintCosts, budgetSummary } from "./costs";
import { buildLayout, createEventPlan } from "./factory";
import { aabb, allSeats, intersects, seatsForElement, totalSeats } from "./geometry";
import { parsePrompt, offlineOptimize } from "./offline";
import { generateTasks, vendorChecklist } from "./planning";
import { autoSeat } from "./seating";
import { validateLayout } from "./validation";

const today = new Date("2026-10-23T10:00:00");

describe("auto-layout", () => {
  it.each([
    ["banquet", 165, "wedding"],
    ["lawn", 300, "wedding"],
    ["auditorium", 320, "community"],
    ["community-hall", 120, "corporate"],
    ["terrace", 50, "birthday"],
    ["home", 20, "birthday"],
  ] as const)("fits %s for %i guests without overlaps", (templateId, guests, type) => {
    const layout = buildLayout({ templateId, guestCount: guests, type });
    const solid = layout.elements.filter((e) => !getDef(e.kind).overlay);
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++) expect(intersects(aabb(solid[i]), aabb(solid[j]), 0.1), `${solid[i].label} vs ${solid[j].label}`).toBe(false);
    expect(totalSeats(layout)).toBeGreaterThanOrEqual(guests);
  });

  it("every template produces a layout with no safety errors", () => {
    for (const t of VENUE_TEMPLATES) {
      const guests = Math.round((t.venue.widthFt * t.venue.lengthFt) / 50);
      const ev = createEventPlan({ name: "x", type: "wedding", date: "2026-12-12", startTime: "18:00", city: "Chennai", guestCount: guests, budgetTotal: 500000, theme: "", templateId: t.id }, today);
      const { issues } = validateLayout(ev, activeLayout(ev));
      expect(issues.filter((i) => i.severity === "error").map((i) => i.title), t.id).toEqual([]);
    }
  });
});

describe("seats", () => {
  it("round tables seat their capacity and rotate with the table", () => {
    const el = { id: "t", kind: "round-8", x: 10, y: 10, w: 6, h: 6, rotation: 0, label: "T1" };
    expect(seatsForElement(el)).toHaveLength(8);
    const rect = { id: "r", kind: "banquet-12", x: 10, y: 10, w: 12, h: 3, rotation: 90, label: "T2" };
    const seats = seatsForElement(rect);
    expect(seats).toHaveLength(12);
    const xs = seats.map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(6);
  });
});

describe("budget", () => {
  it("links blueprint items to rentals and guests to catering", () => {
    const ev = createDemoWedding(today);
    const s = budgetSummary(ev, today);
    const rentals = s.categories.find((c) => c.category === "rentals")!;
    expect(rentals.committed).toBe(blueprintCosts(activeLayout(ev), ev.city).total);
    expect(s.cateringFromEstimate).toBe(false);
    expect(s.committed).toBeGreaterThan(0);
    expect(s.dues.length).toBeGreaterThan(0);
  });

  it("optimizer finds savings with actionable suggestions", () => {
    const ev = createDemoWedding(today);
    const suggestions = offlineOptimize(ev, budgetSummary(ev, today));
    expect(suggestions.length).toBeGreaterThan(2);
    expect(suggestions.every((s) => s.saving > 0)).toBe(true);
  });
});

describe("seating", () => {
  it("seats everyone, keeps families together and respects keep-apart", () => {
    const ev = createDemoWedding(today);
    const layout = activeLayout(ev);
    const { assignments, unplaced } = autoSeat(ev, layout);
    expect(unplaced).toHaveLength(0);
    const tableOf = (gid: string) => assignments[gid]?.split(":")[0];
    const avoider = ev.guests.find((g) => g.avoid?.length)!;
    expect(tableOf(avoider.id)).not.toBe(tableOf(avoider.avoid![0]));
    const seatIds = Object.values(assignments);
    expect(new Set(seatIds).size).toBe(seatIds.length);
    const family = ev.guests.filter((g) => g.group === "Krishnan family" && g.rsvp !== "no");
    expect(new Set(family.map((g) => tableOf(g.id))).size).toBe(1);
  });

  it("VIPs sit closer to the stage than average guests", () => {
    const ev = createDemoWedding(today);
    const layout = activeLayout(ev);
    const seats = new Map(allSeats(layout).map((s) => [s.id, s]));
    const stage = layout.elements.find((e) => e.kind === "stage")!;
    const d = (gid: string) => {
      const s = seats.get(ev.guests.find((g) => g.id === gid)!.seatId!)!;
      return Math.hypot(s.x - (stage.x + stage.w / 2), s.y - (stage.y + stage.h));
    };
    const vip = ev.guests.filter((g) => g.vip && g.seatId).map((g) => d(g.id));
    const rest = ev.guests.filter((g) => !g.vip && g.seatId).map((g) => d(g.id));
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(vip)).toBeLessThan(avg(rest));
  });
});

describe("planning", () => {
  it("compresses the countdown when the event is soon", () => {
    const tasks = generateTasks({ type: "wedding", date: "2026-11-22" }, today);
    expect(tasks.every((t) => t.dueDate >= "2026-10-23")).toBe(true);
    expect(tasks.some((t) => t.phase === "Event week")).toBe(true);
  });

  it("checklist flags vendors required by placed items", () => {
    const ev = createDemoCommunity(today);
    const items = vendorChecklist(ev, activeLayout(ev));
    expect(items.find((i) => i.category === "av")?.status).toBe("booked");
    expect(items.some((i) => i.status === "missing")).toBe(true);
  });

  it("parses a one-line brief offline", () => {
    const p = parsePrompt("Tamil wedding reception for 300 guests in Coimbatore on 12 Dec, budget 8 lakh, marigold theme", today);
    expect(p.type).toBe("wedding");
    expect(p.guestCount).toBe(300);
    expect(p.budgetTotal).toBe(800000);
    expect(p.city).toBe("Coimbatore");
    expect(p.date).toBe("2026-12-12");
    expect(p.theme.toLowerCase()).toContain("marigold");
  });
});
