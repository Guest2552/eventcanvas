import type { SeatVisual } from "@/components/blueprint/types";
import type { SeatInfo } from "@/lib/engine/geometry";
import type { Booking, EventPlan, Guest, Layout } from "@/lib/types";

export const SEAT_COLORS = {
  empty: "#ffffff",
  yes: "#e11d48",
  pending: "#fecdd3",
  vip: "#f59e0b",
  accessible: "#0ea5e9",
  booked: "#7c3aed",
  checked: "#16a34a",
  selected: "#111827",
};

export const SEAT_LEGEND: { label: string; color: string; border?: string }[] = [
  { label: "Empty", color: SEAT_COLORS.empty, border: "#a8a29e" },
  { label: "Confirmed", color: SEAT_COLORS.yes },
  { label: "RSVP pending", color: SEAT_COLORS.pending, border: "#e11d48" },
  { label: "VIP", color: SEAT_COLORS.vip },
  { label: "Wheelchair", color: SEAT_COLORS.accessible },
];

export function guestsBySeat(ev: EventPlan): Map<string, Guest> {
  const m = new Map<string, Guest>();
  for (const g of ev.guests) if (g.seatId && g.rsvp !== "no") m.set(g.seatId, g);
  return m;
}

export function bookingsBySeat(ev: EventPlan, layout: Layout): Map<string, Booking> {
  return new Map(ev.bookings.filter((b) => b.layoutId === layout.id).map((b) => [b.seatId, b]));
}

export function guestSeatVisual(g: Guest | undefined, seat: SeatInfo, opts: { highlightGuestId?: string; live?: boolean } = {}): SeatVisual {
  if (!g) return { fill: SEAT_COLORS.empty, stroke: "#a8a29e", tooltip: `${seat.label} · empty` };
  const selected = opts.highlightGuestId === g.id;
  let fill = g.rsvp === "yes" ? SEAT_COLORS.yes : SEAT_COLORS.pending;
  if (g.vip) fill = SEAT_COLORS.vip;
  if (g.accessible) fill = SEAT_COLORS.accessible;
  if (opts.live) fill = g.checkedIn ? SEAT_COLORS.checked : "#e7e5e4";
  return {
    fill,
    stroke: selected ? SEAT_COLORS.selected : g.rsvp === "yes" || opts.live ? "#ffffff" : "#e11d48",
    tooltip: `${g.name} · ${seat.tableLabel} seat ${seat.index + 1}${g.vip ? " · VIP" : ""}${g.accessible ? " · ♿" : ""}${opts.live ? (g.checkedIn ? " · checked in" : " · not arrived") : g.rsvp !== "yes" ? ` · RSVP ${g.rsvp}` : ""}`,
  };
}
