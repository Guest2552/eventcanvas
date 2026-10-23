"use client";

import { CalendarDays, Loader2, MapPin, Ticket, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { takenSeatIds, vipSeatIds } from "@/lib/booking";
import { allSeats } from "@/lib/engine/geometry";
import { formatDate, formatTime, inr } from "@/lib/format";
import { activeLayoutOf, updateEvent, useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BookPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Book />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 size-5 animate-spin" /> Loading seats…
    </div>
  );
}

function Book() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useStore((s) => s.hydrated);
  const ev = useStore((s) => s.events[id]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState<Booking[] | null>(null);
  const layout = ev ? activeLayoutOf(ev) : null;
  const seats = useMemo(() => (layout ? allSeats(layout) : []), [layout]);
  const vip = useMemo(() => (layout ? vipSeatIds(layout, seats) : new Set<string>()), [layout, seats]);
  const taken = useMemo(() => (ev && layout ? takenSeatIds(ev, layout) : new Set<string>()), [ev, layout]);
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);

  if (!hydrated) return <Loading />;
  if (!ev || !layout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">This booking page isn&apos;t available here.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          EventCanvas demo plans live in the organiser&apos;s browser. Open this link in the same browser the event was created in.
        </p>
      </div>
    );
  }
  if (!ev.booking.enabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">Bookings are closed</p>
        <p className="text-sm text-muted-foreground">The organiser hasn&apos;t opened seat booking for {ev.name}.</p>
      </div>
    );
  }

  const price = (sid: string) => (vip.has(sid) ? ev.booking.priceVip : ev.booking.priceGeneral);
  const total = selected.reduce((s, sid) => s + price(sid), 0);
  const available = seats.length - taken.size;

  const toggle = (sid: string) => {
    if (taken.has(sid)) return;
    setSelected((cur) => {
      if (cur.includes(sid)) return cur.filter((x) => x !== sid);
      if (cur.length >= ev.booking.maxPerOrder) {
        toast.error(`You can book up to ${ev.booking.maxPerOrder} seats at once`);
        return cur;
      }
      return [...cur, sid];
    });
  };

  const confirm = () => {
    if (!name.trim()) {
      toast.error("Enter a name for the booking");
      return;
    }
    const fresh = useStore.getState().events[id];
    const nowTaken = fresh ? takenSeatIds(fresh, activeLayoutOf(fresh)) : taken;
    const clash = selected.filter((s) => nowTaken.has(s));
    if (clash.length) {
      setSelected((cur) => cur.filter((s) => !clash.includes(s)));
      toast.error("Someone just booked one of your seats. Please pick another.");
      return;
    }
    const made: Booking[] = selected.map((seatId) => ({
      id: nanoid(8),
      seatId,
      layoutId: layout.id,
      name: name.trim(),
      passType: vip.has(seatId) ? "vip" : "general",
      createdAt: new Date().toISOString(),
    }));
    updateEvent(id, (d) => void d.bookings.push(...made), { history: false });
    setConfirmed(made);
    setSelected([]);
  };

  if (confirmed) {
    return (
      <div className="bg-festive flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border bg-card shadow-xl">
          <div className="bg-primary p-5 text-primary-foreground">
            <p className="text-xs uppercase opacity-80">Booking confirmed</p>
            <p className="mt-1 font-heading text-2xl font-semibold">{ev.name}</p>
            <p className="mt-1 text-sm opacity-90">
              {formatDate(ev.date, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(ev.startTime)} · {layout.venue.name}
              , {ev.city}
            </p>
          </div>
          <div className="relative border-b border-dashed p-5">
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-semibold">{confirmed[0].name}</p>
            <p className="mt-3 text-xs text-muted-foreground">Seats</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {confirmed.map((b) => (
                <span
                  key={b.id}
                  className={cn("rounded-md px-2 py-0.5 text-sm font-medium", b.passType === "vip" ? "bg-marigold/30" : "bg-muted")}
                >
                  {seatById.get(b.seatId)?.tableLabel}-{(seatById.get(b.seatId)?.index ?? 0) + 1} {b.passType === "vip" && "· VIP"}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-5">
            <QRCodeSVG value={`EVENTCANVAS:${ev.id}:${confirmed.map((b) => b.id).join(",")}`} size={140} marginSize={1} />
            <p className="text-xs text-muted-foreground">Show this QR at the entry</p>
            <p className="text-sm font-semibold">
              Paid: {inr(confirmed.reduce((s, b) => s + (b.passType === "vip" ? ev.booking.priceVip : ev.booking.priceGeneral), 0))}
            </p>
            <Button variant="outline" className="mt-2 w-full" onClick={() => setConfirmed(null)}>
              Book more seats
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Brand href="#" className="text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-sans text-base font-semibold tracking-normal">{ev.booking.title || ev.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />{" "}
                {formatDate(ev.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, {formatTime(ev.startTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {layout.venue.name}, {ev.city}
              </span>
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{available} seats available</span>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 outline-none">
        <BlueprintCanvas
          layout={layout}
          mode="seats"
          showGrid={false}
          showZones
          seatVisual={(s) => {
            if (selected.includes(s.id))
              return { fill: "#16a34a", stroke: "#14532d", tooltip: `${s.label} · selected · ${inr(price(s.id))}` };
            if (taken.has(s.id)) return { fill: "#d6d3d1", stroke: "#d6d3d1", tooltip: `${s.label} · sold`, clickable: false };
            return vip.has(s.id)
              ? { fill: "#fffbeb", stroke: "#d97706", tooltip: `${s.label} · VIP · ${inr(ev.booking.priceVip)}` }
              : { fill: "#ffffff", stroke: "#16a34a", tooltip: `${s.label} · ${inr(ev.booking.priceGeneral)}` };
          }}
          onSeatClick={(s) => toggle(s.id)}
        />
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-3 rounded-full bg-card/95 px-4 py-1.5 text-[11px] shadow">
          <Legend color="#ffffff" border="#16a34a" label={`Available ${inr(ev.booking.priceGeneral)}`} />
          <Legend color="#fffbeb" border="#d97706" label={`VIP ${inr(ev.booking.priceVip)}`} />
          <Legend color="#16a34a" border="#14532d" label="Selected" />
          <Legend color="#d6d3d1" border="#d6d3d1" label="Sold" />
        </div>
        <p className="absolute bottom-3 left-3 rounded-md bg-card/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
          All eyes this way: the stage is at the top 🎤
        </p>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-live="polite">
            {selected.length === 0 ? (
              <span className="text-sm text-muted-foreground">Tap seats on the map to select (up to {ev.booking.maxPerOrder})</span>
            ) : (
              selected.map((sid) => (
                <span
                  key={sid}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                >
                  {seatById.get(sid)?.tableLabel}-{(seatById.get(sid)?.index ?? 0) + 1}
                  <button
                    onClick={() => toggle(sid)}
                    aria-label={`Remove seat ${seatById.get(sid)?.tableLabel} ${(seatById.get(sid)?.index ?? 0) + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          {/* Keyboard and screen-reader alternative to tapping seats on the map */}
          <NativeSelect
            value=""
            onChange={(e) => e.target.value && toggle(e.target.value)}
            aria-label="Add a seat without using the map"
            className="w-48"
          >
            <option value="">Add a seat…</option>
            {layout.elements
              .filter((el) => seats.some((s) => s.elementId === el.id && !taken.has(s.id) && !selected.includes(s.id)))
              .map((el) => (
                <optgroup key={el.id} label={el.label}>
                  {seats
                    .filter((s) => s.elementId === el.id && !taken.has(s.id) && !selected.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {el.label} seat {s.index + 1} · {vip.has(s.id) ? "VIP " : ""}
                        {inr(price(s.id))}
                      </option>
                    ))}
                </optgroup>
              ))}
          </NativeSelect>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-9 w-44"
            aria-label="Your name"
          />
          <Button size="lg" className="h-9 gap-1.5" disabled={selected.length === 0} onClick={confirm}>
            <Ticket className="size-4" /> {selected.length ? `Pay ${inr(total)}` : "Select seats"}
          </Button>
        </div>
        <p className="pb-2 text-center text-[10px] text-muted-foreground">Demo checkout: no real payment is taken.</p>
      </footer>
    </div>
  );
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-3 rounded-full border-2" style={{ background: color, borderColor: border }} /> {label}
    </span>
  );
}
