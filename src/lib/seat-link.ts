import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { EventPlan, Guest, Layout } from "@/lib/types";

/** Everything the guest-facing "Find my seat" page needs, and nothing about other guests. */
export interface SeatTicket {
  n: string;
  e: string;
  d: string;
  t: string;
  v: string;
  c: string;
  tl: string;
  s: number;
  l: { w: number; h: number; els: [string, number, number, number, number, number, string][] };
  hl: number;
}

export function buildSeatLink(origin: string, ev: EventPlan, layout: Layout, guest: Guest): string | null {
  if (!guest.seatId) return null;
  const [elementId, idx] = guest.seatId.split(":");
  const elIndex = layout.elements.findIndex((e) => e.id === elementId);
  if (elIndex < 0) return null;
  const el = layout.elements[elIndex];
  const ticket: SeatTicket = {
    n: guest.name,
    e: ev.name,
    d: ev.date,
    t: ev.startTime,
    v: layout.venue.name,
    c: ev.city,
    tl: el.label,
    s: Number(idx) + 1,
    l: {
      w: layout.venue.widthFt,
      h: layout.venue.lengthFt,
      els: layout.elements.map((e) => [e.kind, e.x, e.y, e.w, e.h, e.rotation, e.label]),
    },
    hl: elIndex,
  };
  // The hash fragment never reaches the server
  return `${origin}/seat#${compressToEncodedURIComponent(JSON.stringify(ticket))}`;
}

export function parseSeatTicket(hash: string): SeatTicket | null {
  try {
    const raw = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    return raw ? (JSON.parse(raw) as SeatTicket) : null;
  } catch {
    return null;
  }
}

export function ticketLayout(t: SeatTicket): Layout {
  return {
    id: "ticket",
    name: t.v,
    venue: { name: t.v, widthFt: t.l.w, lengthFt: t.l.h, indoor: true },
    elements: t.l.els.map(([kind, x, y, w, h, rotation, label], i) => ({ id: `e${i}`, kind, x, y, w, h, rotation, label })),
    zones: [],
  };
}
