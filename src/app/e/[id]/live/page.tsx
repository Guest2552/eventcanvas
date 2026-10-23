"use client";

import { AlarmClock, CheckCircle2, Radio, Search, Truck, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { VENDOR_CATEGORIES } from "@/lib/catalog/planning";
import { toIsoDate } from "@/lib/engine/costs";
import { addMinutes, sortKey } from "@/lib/engine/planning";
import { formatTime } from "@/lib/format";
import { guestSeatVisual, guestsBySeat } from "@/lib/seat-visuals";
import { cn } from "@/lib/utils";

export default function LivePage() {
  const { ev, layout, update } = useCurrentEvent();
  const schedule = useMemo(() => (ev ? [...ev.schedule].sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time)) : []), [ev]);
  const isToday = ev ? toIsoDate(new Date()) === ev.date : false;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const first = schedule[0] ? sortKey(ev, schedule[0].time) : -60;
  const lastSlot = schedule[schedule.length - 1];
  const last = lastSlot ? sortKey(ev, lastSlot.time) + lastSlot.durationMin : 300;
  const [clock, setClock] = useState(() =>
    isToday && ev ? sortKey(ev, `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`) : 30,
  );
  const [q, setQ] = useState("");
  const bySeat = useMemo(() => (ev ? guestsBySeat(ev) : new Map()), [ev]);
  if (!ev) return null;

  const clockTime = addMinutes(ev.startTime, clock);
  const current = schedule.find((s) => sortKey(ev, s.time) <= clock && clock < sortKey(ev, s.time) + s.durationMin);
  const next = schedule.find((s) => sortKey(ev, s.time) > clock);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");
  const checked = attending.filter((g) => g.checkedIn).length;
  const matches = q.trim() ? attending.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const vendors = ev.vendors.filter((v) => v.arrivalTime);
  const late = vendors.filter((v) => !v.arrived && sortKey(ev, v.arrivalTime!) < clock);

  const toggleCheckIn = (gid: string) => {
    const g = ev.guests.find((x) => x.id === gid);
    update((d) => {
      const x = d.guests.find((y) => y.id === gid)!;
      x.checkedIn = !x.checkedIn;
    });
    if (g && !g.checkedIn)
      toast.success(
        `${g.name} checked in${g.seatId ? `, seat ${g.seatId && layout.elements.find((e) => e.id === g.seatId!.split(":")[0])?.label}` : ""}`,
      );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <section className="rounded-2xl border bg-foreground p-4 text-background">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-primary" />
            </span>
            <span className="text-sm font-semibold tracking-wide uppercase">Live</span>
          </div>
          <div className="font-heading text-4xl font-semibold tabular-nums">{formatTime(clockTime)}</div>
          <div className="min-w-48 flex-1">
            <p className="text-xs opacity-70">Now</p>
            <p className="font-semibold">{current?.title ?? (clock < first ? "Before setup" : "Between moments")}</p>
            {next && (
              <p className="text-xs opacity-70">
                Next: {next.title} at {formatTime(next.time)} (in {sortKey(ev, next.time) - clock} min)
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70">Checked in</p>
            <p className="text-2xl font-semibold tabular-nums">
              {checked}/{attending.length}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] whitespace-nowrap opacity-70">{isToday ? "Event clock" : "Simulate the day"}</span>
          <input
            type="range"
            min={first}
            max={last}
            step={5}
            value={clock}
            onChange={(e) => setClock(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
            aria-label="Event clock"
          />
          {isToday && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() =>
                setClock(sortKey(ev, `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`))
              }
            >
              Now
            </Button>
          )}
        </div>
      </section>

      {late.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          <AlarmClock className="size-4" /> Running late: {late.map((v) => `${v.name} (due ${formatTime(v.arrivalTime!)})`).join(", ")}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Radio className="size-4 text-primary" /> Arrivals by seat
            </p>
            <span className="text-xs text-muted-foreground">Green = arrived · click a seat to check in</span>
          </div>
          <div className="h-[460px]">
            <BlueprintCanvas
              layout={layout}
              mode="seats"
              showGrid={false}
              seatVisual={(s) => guestSeatVisual(bySeat.get(s.id), s, { live: true })}
              onSeatClick={(s) => bySeat.get(s.id) && toggleCheckIn(bySeat.get(s.id)!.id)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <UserCheck className="size-4 text-primary" /> Guest check-in
            </p>
            <Progress value={(checked / Math.max(1, attending.length)) * 100} />
            <div className="relative mt-3">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a guest name…"
                className="pl-8"
                aria-label="Find guest to check in"
              />
            </div>
            <ul className="mt-2 space-y-1">
              {matches.map((g) => {
                const table = g.seatId ? layout.elements.find((e) => e.id === g.seatId!.split(":")[0])?.label : null;
                return (
                  <li key={g.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {g.name} {g.vip && "⭐"}
                    </span>
                    <span className="text-xs text-muted-foreground">{table ? `Table ${table}` : "No seat"}</span>
                    <Button size="xs" variant={g.checkedIn ? "secondary" : "default"} onClick={() => toggleCheckIn(g.id)}>
                      {g.checkedIn ? "Undo" : "Check in"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Truck className="size-4 text-primary" /> Vendor arrivals
            </p>
            <ul className="space-y-1.5">
              {vendors.map((v) => {
                const isLate = !v.arrived && sortKey(ev, v.arrivalTime!) < clock;
                return (
                  <li key={v.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {VENDOR_CATEGORIES[v.category].emoji} {v.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatTime(v.arrivalTime!)}</span>
                    <button
                      onClick={() => update((d) => void (d.vendors.find((x) => x.id === v.id)!.arrived = !v.arrived))}
                      aria-label={`Mark ${v.name} arrived`}
                    >
                      {v.arrived ? (
                        <Badge className="bg-emerald-600 text-white">Arrived</Badge>
                      ) : isLate ? (
                        <Badge variant="destructive">Late</Badge>
                      ) : (
                        <Badge variant="outline">Expected</Badge>
                      )}
                    </button>
                  </li>
                );
              })}
              {vendors.length === 0 && <li className="text-xs text-muted-foreground">Set vendor arrival times on the Timeline page.</li>}
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">Run of show</p>
            <ol className="space-y-1">
              {schedule.map((s) => {
                const start = sortKey(ev, s.time);
                const state = clock >= start + s.durationMin ? "done" : clock >= start ? "live" : "next";
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                      state === "live" && "bg-primary/10 font-semibold text-primary",
                      state === "done" && "text-muted-foreground line-through",
                    )}
                  >
                    {state === "done" ? <CheckCircle2 className="size-3.5" /> : <span className="size-3.5" />}
                    <span className="w-14 tabular-nums">{formatTime(s.time)}</span>
                    <span className="truncate">{s.title}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>
      <p className="text-center text-[11px] text-muted-foreground">
        Tip: open this page in a second tab of this browser and check-ins sync between tabs instantly.
      </p>
    </div>
  );
}
