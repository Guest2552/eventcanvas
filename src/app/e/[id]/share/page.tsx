"use client";

import { Copy, ExternalLink, IndianRupee, Link2, Ticket, Trash2 } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { StatTile } from "@/components/event/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { seatIndex } from "@/lib/engine/geometry";
import { inr } from "@/lib/format";
import { buildSeatLink } from "@/lib/seat-link";

export default function SharePage() {
  const { ev, layout, update } = useCurrentEvent();
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const seats = useMemo(() => (layout ? seatIndex(layout) : new Map()), [layout]);
  if (!ev) return null;

  const bookUrl = `${origin}/book/${ev.id}`;
  const bookings = ev.bookings.filter((b) => b.layoutId === layout.id);
  const revenue = bookings.reduce((s, b) => s + (b.passType === "vip" ? ev.booking.priceVip : ev.booking.priceGeneral), 0);
  const seatedGuests = ev.guests.filter((g) => g.seatId && g.rsvp !== "no" && seats.has(g.seatId));
  const setB = (patch: Partial<typeof ev.booking>, field: string) => update((d) => void Object.assign(d.booking, patch), { coalesce: `booking-${field}` });

  const copy = async (text: string, msg: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success(msg);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Ticket className="size-5 text-primary" /> Public seat booking
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Let attendees pick their own seats on your blueprint, BookMyShow style. Great for community nights, concerts and fundraisers. Seats inside a VIP zone use VIP pricing.</p>
            </div>
            <Switch checked={ev.booking.enabled} onCheckedChange={(enabled) => setB({ enabled }, "enabled")} aria-label="Enable public booking" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm leading-none font-medium text-xs">Page title</span>
              <Input value={ev.booking.title} onChange={(e) => setB({ title: e.target.value }, "title")} />
            </label>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-sm leading-none font-medium text-xs">General pass (₹)</span>
              <Input type="number" min={0} value={ev.booking.priceGeneral} onChange={(e) => setB({ priceGeneral: Number(e.target.value) }, "pg")} />
            </label>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-sm leading-none font-medium text-xs">VIP pass (₹)</span>
              <Input type="number" min={0} value={ev.booking.priceVip} onChange={(e) => setB({ priceVip: Number(e.target.value) }, "pv")} />
            </label>
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-sm leading-none font-medium text-xs">Max seats per booking</span>
              <Input type="number" min={1} max={20} value={ev.booking.maxPerOrder} onChange={(e) => setB({ maxPerOrder: Math.max(1, Number(e.target.value)) }, "max")} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
            <code className="min-w-0 flex-1 truncate text-xs">{bookUrl}</code>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(bookUrl, "Booking link copied")}>
              <Copy className="size-3.5" /> Copy
            </Button>
            <Link href={`/book/${ev.id}`} target="_blank" className={buttonVariants({ size: "sm", className: "gap-1" })}>
              <ExternalLink className="size-3.5" /> Open booking page
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Demo note: plans are stored in this browser, so open the booking page in another tab here. Bookings appear on your blueprint instantly. Hosting it for real attendees would need a shared database.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-5">
          {origin && <QRCodeSVG value={bookUrl} size={170} fgColor="#1c1917" level="M" marginSize={1} />}
          <p className="text-center text-xs text-muted-foreground">Print this QR on posters or share it on WhatsApp groups.</p>
          <div className="grid w-full grid-cols-2 gap-2">
            <StatTile label="Seats booked" value={bookings.length} />
            <StatTile label="Collected" value={inr(revenue)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <IndianRupee className="size-4 text-primary" /> Bookings ({bookings.length})
          </p>
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {bookings
            .slice()
            .reverse()
            .map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <Badge variant="outline">{seats.get(b.seatId)?.label ?? "Removed seat"}</Badge>
                <Badge className={b.passType === "vip" ? "bg-marigold text-foreground" : ""} variant={b.passType === "vip" ? "default" : "secondary"}>
                  {b.passType.toUpperCase()}
                </Badge>
                <Button size="icon-xs" variant="ghost" onClick={() => update((d) => void (d.bookings = d.bookings.filter((x) => x.id !== b.id)))} aria-label="Cancel booking">
                  <Trash2 />
                </Button>
              </li>
            ))}
          {bookings.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No bookings yet. Open the booking page and grab a seat to try it.</li>}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="size-4 text-primary" /> &ldquo;Find my seat&rdquo; links for guests
        </p>
        <p className="mb-3 text-xs text-muted-foreground">Each link shows one guest their table on a mini map. It works on any phone and contains only that guest&apos;s own name and seat.</p>
        <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {seatedGuests.slice(0, 60).map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <span className="text-xs text-muted-foreground">{seats.get(g.seatId!)?.tableLabel}</span>
              <Button size="icon-xs" variant="ghost" onClick={() => copy(buildSeatLink(origin, ev, layout, g) ?? "", `Seat link for ${g.name} copied`)} aria-label={`Copy seat link for ${g.name}`}>
                <Copy />
              </Button>
            </div>
          ))}
          {seatedGuests.length === 0 && <p className="text-xs text-muted-foreground">Seat guests on the Guests page first.</p>}
        </div>
      </section>
    </div>
  );
}
