"use client";

import { AlertTriangle, ArrowRight, CalendarClock, CircleAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { ScoreRing, StatTile } from "@/components/event/score-ring";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { BOOKED_STATUSES } from "@/lib/catalog/planning";
import { budgetSummary, daysUntil } from "@/lib/engine/costs";
import { totalSeats } from "@/lib/engine/geometry";
import { sortKey, vendorChecklist } from "@/lib/engine/planning";
import { validateLayout } from "@/lib/engine/validation";
import { formatDate, formatTime, inrShort } from "@/lib/format";
import { openAssistant } from "@/lib/assistant-bus";
import { guestSeatVisual, guestsBySeat } from "@/lib/seat-visuals";

const QUICK_PROMPTS = [
  "Move the DJ booth away from the VIP tables",
  "We're over budget. What should we cut?",
  "Add a photo booth near the entry",
  "Write a WhatsApp RSVP reminder for pending guests",
];

export default function OverviewPage() {
  const { ev, layout, update } = useCurrentEvent();
  const summary = useMemo(() => (ev ? budgetSummary(ev) : null), [ev]);
  const validation = useMemo(() => (ev ? validateLayout(ev, layout) : null), [ev, layout]);
  const checklist = useMemo(() => (ev ? vendorChecklist(ev, layout) : []), [ev, layout]);
  const seatMap = useMemo(() => (ev ? guestsBySeat(ev) : new Map()), [ev]);
  if (!ev || !summary || !validation) return null;

  const days = daysUntil(ev.date);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");
  const confirmed = ev.guests.filter((g) => g.rsvp === "yes").length;
  const seated = attending.filter((g) => g.seatId && seatMap.get(g.seatId)?.id === g.id).length;
  const tasksDone = ev.tasks.filter((t) => t.done).length;
  const upcoming = ev.tasks.filter((t) => !t.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const booked = ev.vendors.filter((v) => BOOKED_STATUSES.includes(v.status)).length;
  const missing = checklist.filter((c) => c.essential && c.status === "missing");
  const budgetPct = Math.min(100, (summary.committed / Math.max(1, summary.total)) * 100);
  const schedule = [...ev.schedule].sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time)).slice(0, 6);

  const alerts = [
    ...validation.issues.filter((i) => i.severity === "error").map((i) => ({ text: i.title, href: "/blueprint", tone: "error" as const })),
    ...(summary.overBy > 0 ? [{ text: `Over budget by ${inrShort(summary.overBy)}`, href: "/budget", tone: "error" as const }] : []),
    ...summary.dues.filter((d) => d.overdue).map((d) => ({ text: `Payment overdue: ${d.label}`, href: "/budget", tone: "error" as const })),
    ...missing.slice(0, 3).map((m) => ({ text: `No ${m.label.toLowerCase()} yet`, href: "/vendors", tone: "warn" as const })),
    ...(attending.length - seated > 0 && ev.guests.length ? [{ text: `${attending.length - seated} guests without a seat`, href: "/guests", tone: "warn" as const }] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
          <div className="absolute -top-16 -right-16 size-56 rounded-full bg-marigold/20 blur-2xl" />
          <p className="text-sm text-muted-foreground">{formatDate(ev.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {formatTime(ev.startTime)}</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-heading text-6xl leading-none font-semibold text-primary tabular-nums">{Math.max(0, days)}</span>
            <span className="pb-1 text-lg text-muted-foreground">{days === 1 ? "day" : "days"} to go</span>
          </div>
          <p className="mt-3 text-sm">
            {layout.venue.name}, {ev.city} · Theme: <span className="font-medium">{ev.theme || "Not set"}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} onClick={() => openAssistant(p)} className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs transition hover:border-primary/50 hover:text-primary">
                <Sparkles className="size-3 text-primary" /> {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/e/${ev.id}/budget`} className="rounded-xl border bg-card p-3 transition hover:border-primary/40">
            <p className="text-[11px] font-medium text-muted-foreground">Budget committed</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {inrShort(summary.committed)} <span className="text-xs font-normal text-muted-foreground">/ {inrShort(summary.total)}</span>
            </p>
            <Progress value={budgetPct} className="mt-2" />
            <p className={summary.overBy ? "mt-1 text-[11px] text-destructive" : "mt-1 text-[11px] text-muted-foreground"}>{summary.overBy ? `${inrShort(summary.overBy)} over` : `${inrShort(summary.remaining)} left · ${inrShort(summary.perHead)}/guest`}</p>
          </Link>
          <Link href={`/e/${ev.id}/blueprint`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/40">
            <ScoreRing value={validation.score} size={54} />
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Layout safety</p>
              <p className="text-xs">{validation.issues.length ? `${validation.issues.length} to review` : "All clear"}</p>
            </div>
          </Link>
          <StatTile label="RSVPs" value={ev.guests.length ? `${confirmed} / ${ev.guests.length}` : ev.guestCount} sub={ev.guests.length ? `${ev.guests.filter((g) => g.rsvp === "pending").length} pending` : "Planned head-count"} />
          <StatTile label="Seated" value={`${seated} / ${attending.length || ev.guestCount}`} sub={`${totalSeats(layout)} seats on the blueprint`} />
          <StatTile label="Tasks done" value={`${tasksDone} / ${ev.tasks.length}`} sub={upcoming[0] ? `Next: ${upcoming[0].title.slice(0, 26)}…` : "All done"} />
          <StatTile label="Vendors booked" value={`${booked} / ${checklist.length}`} sub={missing.length ? `${missing.length} essentials missing` : "Essentials covered"} />
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {alerts.slice(0, 6).map((a) => (
            <Link key={a.text} href={`/e/${ev.id}${a.href}`} className={a.tone === "error" ? "inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive" : "inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-amber-800"}>
              {a.tone === "error" ? <CircleAlert className="size-3.5" /> : <AlertTriangle className="size-3.5" />} {a.text}
            </Link>
          ))}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">{layout.name}</p>
            <Link href={`/e/${ev.id}/blueprint`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Open studio <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="h-[360px]">
            <BlueprintCanvas layout={layout} mode="view" showGrid={false} seatVisual={(s) => guestSeatVisual(seatMap.get(s.id), s)} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Up next</p>
              <Link href={`/e/${ev.id}/timeline`} className="text-xs text-primary hover:underline">
                All tasks
              </Link>
            </div>
            <ul className="space-y-1.5">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={t.done} onCheckedChange={(c) => update((d) => void (d.tasks.find((x) => x.id === t.id)!.done = !!c))} aria-label={`Mark ${t.title} done`} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {formatDate(t.dueDate, { day: "numeric", month: "short" })}
                  </Badge>
                </li>
              ))}
              {upcoming.length === 0 && <li className="text-sm text-muted-foreground">Everything is done. Enjoy the party! 🎉</li>}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <CalendarClock className="size-4 text-primary" /> Run of show
              </p>
              <Link href={`/e/${ev.id}/timeline`} className="text-xs text-primary hover:underline">
                Edit
              </Link>
            </div>
            <ol className="space-y-1.5">
              {schedule.map((s) => (
                <li key={s.id} className="flex gap-3 text-sm">
                  <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{formatTime(s.time)}</span>
                  <span className="min-w-0 truncate">{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
