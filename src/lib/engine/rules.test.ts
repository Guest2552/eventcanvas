import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { takenSeatIds, vipSeatIds } from "@/lib/booking";
import { allSeats } from "@/lib/engine/geometry";
import { guestSeatVisual, SEAT_COLORS } from "@/lib/seat-visuals";
import { createDemoCommunity, createDemoWedding } from "@/lib/seed/demo";
import type { EventPlan } from "@/lib/types";
import { activeLayout, daysUntil, shiftDate } from "./costs";
import { offlineIdeas, offlineWrite, parsePrompt, type WriteKind } from "./offline";
import { addMinutes, sortKey, vendorArrival } from "./planning";
import { validateLayout } from "./validation";

const today = new Date("2026-10-23T10:00:00");
const titles = (ev: EventPlan) =>
  validateLayout(ev, activeLayout(ev))
    .issues.map((i) => i.title)
    .join(" | ");

describe("layout safety rules", () => {
  const base = createDemoWedding(today);

  it("flags overlapping items and items outside the walls", () => {
    const ev = produce(base, (d) => {
      const els = d.layouts[0].elements;
      const tables = els.filter((e) => e.kind === "round-10");
      tables[1].x = tables[0].x;
      tables[1].y = tables[0].y;
      tables[2].x = -20;
    });
    expect(titles(ev)).toMatch(/overlaps/);
    expect(titles(ev)).toMatch(/outside the venue/);
    expect(validateLayout(ev, activeLayout(ev)).score).toBeLessThan(80);
  });

  it("requires an entry and enough exits for the crowd", () => {
    const ev = produce(base, (d) => {
      d.layouts[0].elements = d.layouts[0].elements.filter((e) => e.kind !== "entry" && e.kind !== "exit");
    });
    expect(titles(ev)).toMatch(/No entry marked/);
    expect(titles(ev)).toMatch(/Needs 2 exits/);
  });

  it("warns when a doorway is crowded and when seats run short", () => {
    const ev = produce(base, (d) => {
      const els = d.layouts[0].elements;
      const exit = els.find((e) => e.kind === "exit")!;
      const table = els.find((e) => e.kind === "round-10")!;
      table.x = exit.x + 3;
      table.y = exit.y;
      d.layouts[0].elements = els.filter((e) => e.kind !== "round-10" || e.id === table.id);
    });
    expect(titles(ev)).toMatch(/is crowded/);
    expect(titles(ev)).toMatch(/Short by \d+ seats/);
  });
});

describe("timeline helpers", () => {
  it("wraps times past midnight and keeps setup slots before the start", () => {
    expect(addMinutes("23:30", 45)).toBe("00:15");
    expect(addMinutes("06:00", -90)).toBe("04:30");
    const ev = { startTime: "18:00" };
    expect(sortKey(ev, "14:00")).toBeLessThan(sortKey(ev, "18:00"));
    expect(sortKey(ev, "00:30")).toBeGreaterThan(sortKey(ev, "23:00"));
  });

  it("calls vendors 30 minutes before their first moment", () => {
    const ev = createDemoWedding(today);
    const caterer = ev.vendors.find((v) => v.category === "catering")!;
    const first = ev.schedule.filter((s) => s.vendorIds.includes(caterer.id)).sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time))[0];
    expect(vendorArrival(ev, caterer.id)).toBe(addMinutes(first.time, -30));
    expect(daysUntil(shiftDate("2026-10-23", 10), today)).toBe(10);
  });
});

describe("offline generators", () => {
  it("parses birthdays, relative dates, rupee amounts and outdoor venues", () => {
    const b = parsePrompt("Aarav's 5th birthday in 3 weeks, 40 guests in Chennai, budget ₹1,50,000", today);
    expect(b).toMatchObject({ type: "birthday", guestCount: 40, budgetTotal: 150000, date: shiftDate("2026-10-23", 21) });
    expect(b.name).toMatch(/Aarav's 5th Birthday/);
    expect(parsePrompt("Outdoor garden wedding reception, 200 guests", today).templateId).toBe("lawn");
    expect(parsePrompt("Company offsite for 80 people", today).type).toBe("corporate");
  });

  it("writes every message kind with the event's details", () => {
    const ev = createDemoWedding(today);
    for (const kind of ["invitation", "welcome-speech", "thank-you", "whatsapp-reminder", "vendor-enquiry"] as WriteKind[]) {
      expect(offlineWrite(kind, ev, "")).toContain(ev.name);
    }
  });

  it("adapts the menu to the guest list", () => {
    const ev = produce(createDemoWedding(today), (d) => void (d.guests[0].dietary = "jain"));
    expect(offlineIdeas(ev).menu.some((c) => c.course === "Jain counter")).toBe(true);
    expect(offlineIdeas(ev).themes).toHaveLength(3);
  });
});

describe("seat helpers", () => {
  it("prices VIP-zone seats and blocks taken ones", () => {
    const ev = createDemoCommunity(today);
    const layout = activeLayout(ev);
    const seats = allSeats(layout);
    expect(vipSeatIds(layout, seats).size).toBeGreaterThan(0);
    const taken = takenSeatIds(ev, layout);
    for (const b of ev.bookings) expect(taken.has(b.seatId)).toBe(true);
  });

  it("colours seats by guest status", () => {
    const ev = createDemoWedding(today);
    const seat = allSeats(activeLayout(ev))[0];
    expect(guestSeatVisual(undefined, seat).fill).toBe(SEAT_COLORS.empty);
    const vip = { ...ev.guests[0], vip: true, accessible: false };
    expect(guestSeatVisual(vip, seat).fill).toBe(SEAT_COLORS.vip);
    expect(guestSeatVisual({ ...vip, checkedIn: true }, seat, { live: true }).fill).toBe(SEAT_COLORS.checked);
  });
});
