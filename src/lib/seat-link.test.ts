import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeLayout } from "@/lib/engine/costs";
import { createDemoWedding } from "@/lib/seed/demo";
import { buildSeatLink, parseSeatTicket, ticketLayout } from "./seat-link";

describe("find-my-seat links", () => {
  it("round-trips a guest's seat and carries no other guest names", () => {
    const ev = createDemoWedding(new Date("2026-10-23T10:00:00"));
    const layout = activeLayout(ev);
    const guest = ev.guests.find((g) => g.seatId)!;
    const url = buildSeatLink("http://localhost:3000", ev, layout, guest)!;
    const ticket = parseSeatTicket(url.split("#")[1])!;
    expect(ticket.n).toBe(guest.name);
    expect(ticket.s).toBe(Number(guest.seatId!.split(":")[1]) + 1);
    expect(ticketLayout(ticket).elements[ticket.hl].label).toBe(ticket.tl);
    const other = ev.guests.find((g) => g.id !== guest.id && g.name !== guest.name)!;
    expect(url).not.toContain(encodeURIComponent(other.name));
    expect(url.length).toBeLessThan(6000);
    if (process.env.WRITE_SEAT_LINK) writeFileSync(process.env.WRITE_SEAT_LINK, url);
  });
});
