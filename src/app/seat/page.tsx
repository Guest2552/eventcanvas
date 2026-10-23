"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { Brand } from "@/components/brand";
import { formatDate, formatTime } from "@/lib/format";
import { parseSeatTicket, type SeatTicket, ticketLayout } from "@/lib/seat-link";

export default function SeatPage() {
  // The seat details travel in the URL hash, which browsers never send to a server
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
    () => null,
  );
  const ticket: SeatTicket | null | undefined = useMemo(() => (hash === null ? undefined : parseSeatTicket(hash)), [hash]);
  const layout = useMemo(() => (ticket ? ticketLayout(ticket) : null), [ticket]);

  if (ticket === undefined) return null;
  if (!ticket || !layout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <Brand />
        <p className="mt-4 font-semibold">This seat link looks incomplete.</p>
        <p className="text-sm text-muted-foreground">Ask your host to share it again.</p>
      </div>
    );
  }
  const tableId = `e${ticket.hl}`;

  return (
    <div className="bg-festive flex min-h-screen flex-col items-center p-4">
      <main id="main" tabIndex={-1} className="w-full max-w-md space-y-4 outline-none">
        <div className="flex justify-center pt-2">
          <Brand href="#" />
        </div>
        <div className="overflow-hidden rounded-3xl border bg-card shadow-xl">
          <div className="bg-primary p-5 text-primary-foreground">
            <p className="text-xs uppercase opacity-80">Welcome, {ticket.n.split(" ")[0]}! 🎉</p>
            <p className="mt-1 font-heading text-2xl leading-tight font-semibold">{ticket.e}</p>
            <p className="mt-2 flex items-center gap-1 text-sm opacity-90">
              <CalendarDays className="size-4" /> {formatDate(ticket.d, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(ticket.t)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
              <MapPin className="size-4" /> {ticket.v}, {ticket.c}
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x border-b border-dashed text-center">
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Guest</p>
              <p className="truncate text-sm font-semibold">{ticket.n}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Table</p>
              <p className="font-heading text-2xl font-semibold text-primary">{ticket.tl}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Seat</p>
              <p className="font-heading text-2xl font-semibold">{ticket.s}</p>
            </div>
          </div>
          <div className="h-80">
            <BlueprintCanvas
              layout={layout}
              mode="view"
              showGrid={false}
              focusIds={new Set([tableId])}
              seatVisual={(s) => (s.elementId === tableId && s.index === ticket.s - 1 ? { fill: "#e11d48", stroke: "#881337" } : { fill: "#f5f5f4", stroke: "#d6d3d1" })}
            />
          </div>
          <p className="p-3 text-center text-xs text-muted-foreground">Your table is highlighted. Pinch or scroll to zoom. The stage is at the top.</p>
        </div>
      </main>
    </div>
  );
}
