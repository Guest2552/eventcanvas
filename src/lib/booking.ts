import type { SeatInfo } from "@/lib/engine/geometry";
import type { EventPlan, Layout } from "@/lib/types";

/** A seat is VIP-priced when its table sits inside a VIP zone. */
export function vipSeatIds(layout: Layout, seats: SeatInfo[]): Set<string> {
  const vipZones = layout.zones.filter((z) => z.kind === "vip");
  return new Set(seats.filter((s) => vipZones.some((z) => s.x >= z.x && s.x <= z.x + z.w && s.y >= z.y && s.y <= z.y + z.h)).map((s) => s.id));
}

/** Seats already taken by a booking or a seated guest. */
export function takenSeatIds(ev: EventPlan, layout: Layout): Set<string> {
  const taken = new Set(ev.bookings.filter((b) => b.layoutId === layout.id).map((b) => b.seatId));
  for (const g of ev.guests) if (g.seatId && g.rsvp !== "no") taken.add(g.seatId);
  return taken;
}
