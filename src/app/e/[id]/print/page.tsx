"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Button, buttonVariants } from "@/components/ui/button";
import { getDef } from "@/lib/catalog/elements";
import { EVENT_TYPES, VENDOR_CATEGORIES, VENDOR_STATUSES } from "@/lib/catalog/planning";
import { budgetSummary } from "@/lib/engine/costs";
import { seatIndex } from "@/lib/engine/geometry";
import { sortKey } from "@/lib/engine/planning";
import { validateLayout } from "@/lib/engine/validation";
import { formatDate, formatTime, inr } from "@/lib/format";
import { guestSeatVisual, guestsBySeat } from "@/lib/seat-visuals";

export default function PrintPage() {
  const { ev, layout } = useCurrentEvent();
  const summary = useMemo(() => (ev ? budgetSummary(ev) : null), [ev]);
  const bySeat = useMemo(() => (ev ? guestsBySeat(ev) : new Map()), [ev]);
  if (!ev || !summary) return null;

  const seats = seatIndex(layout);
  const validation = validateLayout(ev, layout);
  const tables = layout.elements
    .filter((e) => getDef(e.kind).category === "seating")
    .map((t) => ({ t, guests: ev.guests.filter((g) => g.seatId?.startsWith(`${t.id}:`) && g.rsvp !== "no").sort((a, b) => Number(a.seatId!.split(":")[1]) - Number(b.seatId!.split(":")[1])) }))
    .filter((x) => x.guests.length);
  const schedule = [...ev.schedule].sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time));

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-[13px] text-stone-900 print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/e/${ev.id}`} className={buttonVariants({ variant: "ghost", className: "gap-1" })}>
          <ArrowLeft className="size-4" /> Back to plan
        </Link>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="size-4" /> Print / Save as PDF
        </Button>
      </div>

      <header className="border-b-2 border-primary pb-4">
        <p className="text-xs tracking-widest text-primary uppercase">{EVENT_TYPES[ev.type].label} plan · EventCanvas</p>
        <h1 className="mt-1 text-3xl font-semibold">{ev.name}</h1>
        <p className="mt-1 text-stone-600">
          {formatDate(ev.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {formatTime(ev.startTime)} · {layout.venue.name}, {ev.city} · Theme: {ev.theme}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["Guests", `${ev.guests.filter((g) => g.rsvp !== "no").length || ev.guestCount}`],
            ["Budget", inr(summary.total)],
            ["Committed", inr(summary.committed)],
            ["Layout safety", `${validation.score}/100`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border p-2">
              <p className="text-[10px] text-stone-500 uppercase">{k}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="mt-5">
        <h2 className="mb-2 text-lg font-semibold">Venue blueprint: {layout.name}</h2>
        <div className="h-[480px] overflow-hidden rounded-lg border">
          <BlueprintCanvas layout={layout} mode="view" showGrid seatVisual={(s) => guestSeatVisual(bySeat.get(s.id), s)} />
        </div>
      </section>

      <section className="print-break mt-6">
        <h2 className="mb-2 text-lg font-semibold">Run of show</h2>
        <table className="w-full border-collapse">
          <tbody>
            {schedule.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="w-20 py-1.5 font-medium tabular-nums">{formatTime(s.time)}</td>
                <td className="py-1.5">{s.title}</td>
                <td className="py-1.5 text-stone-500">{s.elementKind ? getDef(s.elementKind).label : ""}</td>
                <td className="py-1.5 text-right text-stone-500">{s.durationMin} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Budget</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-[11px] text-stone-500 uppercase">
              <th className="py-1">Category</th>
              <th className="py-1 text-right">Planned</th>
              <th className="py-1 text-right">Committed</th>
              <th className="py-1 text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {summary.categories
              .filter((c) => c.allocated || c.committed)
              .map((c) => (
                <tr key={c.category} className="border-b">
                  <td className="py-1.5">{c.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{inr(c.allocated)}</td>
                  <td className="py-1.5 text-right tabular-nums">{inr(c.committed)}</td>
                  <td className="py-1.5 text-right tabular-nums">{inr(c.paid)}</td>
                </tr>
              ))}
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right">{inr(summary.total)}</td>
              <td className="py-1.5 text-right">{inr(summary.committed)}</td>
              <td className="py-1.5 text-right">{inr(summary.paid)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Vendors</h2>
        <table className="w-full border-collapse">
          <tbody>
            {ev.vendors.map((v) => (
              <tr key={v.id} className="border-b">
                <td className="py-1.5">
                  {VENDOR_CATEGORIES[v.category].emoji} {v.name}
                </td>
                <td className="py-1.5 text-stone-500">{VENDOR_CATEGORIES[v.category].label}</td>
                <td className="py-1.5">{VENDOR_STATUSES.find((s) => s.id === v.status)?.label}</td>
                <td className="py-1.5 text-stone-500">{v.contact}</td>
                <td className="py-1.5 text-right">{v.arrivalTime ? `Arrive ${formatTime(v.arrivalTime)}` : ""}</td>
                <td className="py-1.5 text-right tabular-nums">{v.quote ? inr(v.quote) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {tables.length > 0 && (
        <section className="print-break mt-6">
          <h2 className="mb-2 text-lg font-semibold">Seating chart</h2>
          <div className="columns-2 gap-4 sm:columns-3">
            {tables.map(({ t, guests }) => (
              <div key={t.id} className="mb-3 break-inside-avoid rounded-lg border p-2">
                <p className="font-semibold">
                  {t.label} <span className="text-[11px] font-normal text-stone-500">· {guests.length} guests</span>
                </p>
                <ol className="mt-1 space-y-0.5 text-[12px]">
                  {guests.map((g) => (
                    <li key={g.id}>
                      {seats.get(g.seatId!)?.index !== undefined ? `${(seats.get(g.seatId!)?.index ?? 0) + 1}. ` : ""}
                      {g.name} {g.vip ? "⭐" : ""} {g.dietary !== "veg" ? `(${g.dietary})` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Open tasks</h2>
        <ul className="columns-2 gap-6">
          {ev.tasks
            .filter((t) => !t.done)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((t) => (
              <li key={t.id} className="break-inside-avoid py-0.5">
                ☐ {t.title} <span className="text-stone-500">({formatDate(t.dueDate, { day: "numeric", month: "short" })})</span>
              </li>
            ))}
        </ul>
      </section>
      <p className="mt-8 text-center text-[10px] text-stone-400">Generated by EventCanvas on {new Date().toLocaleDateString("en-IN")}</p>
    </div>
  );
}
