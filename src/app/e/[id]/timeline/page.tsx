"use client";

import { MapPin, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDef } from "@/lib/catalog/elements";
import { VENDOR_CATEGORIES } from "@/lib/catalog/planning";
import { toIsoDate } from "@/lib/engine/costs";
import { addMinutes, generateSchedule, generateTasks, PHASES, sortKey, vendorArrival } from "@/lib/engine/planning";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  const { ev, layout, update } = useCurrentEvent();
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState(toIsoDate(new Date()));
  if (!ev) return null;

  const today = toIsoDate(new Date());
  const done = ev.tasks.filter((t) => t.done).length;
  const kinds = [...new Set(layout.elements.map((e) => e.kind))].filter((k) => getDef(k).category !== "seating" || k === "chair-row");
  const schedule = [...ev.schedule].sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time));
  const setTask = (id: string, patch: Record<string, unknown>, field: string) =>
    update(
      (d) =>
        void Object.assign(
          d.tasks.find((t) => t.id === id)!,
          patch,
        ),
      { coalesce: `task-${id}-${field}` },
    );
  const setSlot = (id: string, patch: Record<string, unknown>, field: string) =>
    update(
      (d) =>
        void Object.assign(
          d.schedule.find((s) => s.id === id)!,
          patch,
        ),
      { coalesce: `slot-${id}-${field}` },
    );
  const callTimes = ev.vendors.map((v) => ({ v, time: vendorArrival(ev, v.id) })).filter((x) => x.time);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <Tabs defaultValue="countdown">
        <TabsList>
          <TabsTrigger value="countdown">Planning countdown</TabsTrigger>
          <TabsTrigger value="show">Run of show</TabsTrigger>
        </TabsList>

        <TabsContent value="countdown" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
            <div className="min-w-48 flex-1">
              <p className="text-sm font-semibold">
                {done} of {ev.tasks.length} tasks done
              </p>
              <Progress value={(done / Math.max(1, ev.tasks.length)) * 100} className="mt-2" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!confirm("Replace the task list with a fresh countdown for this event date?")) return;
                update((d) => void (d.tasks = generateTasks({ type: d.type, date: d.date })));
                toast.success("Countdown regenerated for your event date");
              }}
            >
              <RefreshCw className="size-3.5" /> Regenerate
            </Button>
          </div>

          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTask.trim()) return;
              update(
                (d) =>
                  void d.tasks.push({ id: nanoid(8), title: newTask.trim(), dueDate: newDue, phase: "Details & invites", done: false }),
              );
              setNewTask("");
            }}
          >
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task, e.g. Book mehendi artist"
              className="h-9 min-w-56 flex-1"
            />
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-9 w-40" aria-label="Due date" />
            <Button type="submit" className="h-9 gap-1.5">
              <Plus className="size-4" /> Add
            </Button>
          </form>

          {PHASES.map((phase) => {
            const tasks = ev.tasks.filter((t) => t.phase === phase).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            if (!tasks.length) return null;
            return (
              <div key={phase} className="rounded-2xl border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <p className="text-sm font-semibold">{phase}</p>
                  <span className="text-xs text-muted-foreground">
                    {tasks.filter((t) => t.done).length}/{tasks.length}
                  </span>
                </div>
                <ul className="divide-y">
                  {tasks.map((t) => {
                    const overdue = !t.done && t.dueDate < today;
                    return (
                      <li key={t.id} className="group flex items-center gap-3 px-4 py-2">
                        <Checkbox
                          checked={t.done}
                          onCheckedChange={(c) => setTask(t.id, { done: !!c }, "done")}
                          aria-label={`Mark ${t.title} done`}
                        />
                        <Input
                          value={t.title}
                          onChange={(e) => setTask(t.id, { title: e.target.value }, "title")}
                          className={cn(
                            "h-7 flex-1 border-transparent bg-transparent px-1 shadow-none hover:border-input",
                            t.done && "text-muted-foreground line-through",
                          )}
                          aria-label="Task"
                        />
                        {overdue && (
                          <Badge variant="destructive" className="text-[10px]">
                            Overdue
                          </Badge>
                        )}
                        <Input
                          type="date"
                          value={t.dueDate}
                          onChange={(e) => setTask(t.id, { dueDate: e.target.value }, "due")}
                          className="h-7 w-36 text-xs"
                          aria-label="Due date"
                        />
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => update((d) => void (d.tasks = d.tasks.filter((x) => x.id !== t.id)))}
                          aria-label="Delete task"
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="show" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                {formatDate(ev.date, { weekday: "long", day: "numeric", month: "long" })} · starts {formatTime(ev.startTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                Each moment is linked to a spot on your blueprint and the vendors who make it happen.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const last = schedule[schedule.length - 1];
                  update(
                    (d) =>
                      void d.schedule.push({
                        id: nanoid(8),
                        time: last ? addMinutes(last.time, last.durationMin) : d.startTime,
                        durationMin: 30,
                        title: "New moment",
                        vendorIds: [],
                      }),
                  );
                }}
              >
                <Plus className="size-3.5" /> Moment
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  if (!confirm("Replace the run of show with a fresh template?")) return;
                  update((d) => void (d.schedule = generateSchedule(d, layout)));
                }}
              >
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
            </div>
          </div>

          <ol className="relative space-y-3 border-l-2 border-dashed border-primary/30 pl-6">
            {schedule.map((s) => {
              const pre = sortKey(ev, s.time) < 0;
              const linked = s.elementKind ? layout.elements.find((e) => e.kind === s.elementKind) : undefined;
              return (
                <li key={s.id} className="group relative rounded-xl border bg-card p-3">
                  <span
                    className={cn(
                      "absolute top-4 -left-[31px] size-3.5 rounded-full border-2 border-background",
                      pre ? "bg-stone-400" : "bg-primary",
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      value={s.time}
                      onChange={(e) => setSlot(s.id, { time: e.target.value }, "time")}
                      className="h-7 w-28 text-sm font-semibold"
                      aria-label="Time"
                    />
                    <Input
                      value={s.title}
                      onChange={(e) => setSlot(s.id, { title: e.target.value }, "title")}
                      className="h-7 min-w-48 flex-1 border-transparent px-1 font-medium shadow-none hover:border-input"
                      aria-label="Title"
                    />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={s.durationMin}
                        onChange={(e) => setSlot(s.id, { durationMin: Number(e.target.value) }, "dur")}
                        className="h-7 w-16 text-xs"
                        aria-label="Duration in minutes"
                      />{" "}
                      min
                    </div>
                    {pre && (
                      <Badge variant="secondary" className="text-[10px]">
                        Setup
                      </Badge>
                    )}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                      onClick={() => update((d) => void (d.schedule = d.schedule.filter((x) => x.id !== s.id)))}
                      aria-label="Delete moment"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <MapPin className="size-3.5 text-primary" />
                    <NativeSelect
                      value={s.elementKind ?? ""}
                      onChange={(e) => setSlot(s.id, { elementKind: e.target.value || undefined }, "kind")}
                      className="w-44"
                      aria-label="Linked blueprint spot"
                    >
                      <option value="">No location</option>
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {getDef(k).emoji} {getDef(k).label}
                        </option>
                      ))}
                    </NativeSelect>
                    {s.elementKind && !linked && <span className="text-destructive">Not on this layout</span>}
                    {ev.vendors.map((v) => {
                      const on = s.vendorIds.includes(v.id);
                      return (
                        <button
                          key={v.id}
                          onClick={() =>
                            update((d) => {
                              const slot = d.schedule.find((x) => x.id === s.id)!;
                              slot.vendorIds = on ? slot.vendorIds.filter((x) => x !== v.id) : [...slot.vendorIds, v.id];
                            })
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 transition",
                            on ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground opacity-60 hover:opacity-100",
                          )}
                          aria-pressed={on}
                        >
                          {VENDOR_CATEGORIES[v.category].emoji} {v.name}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>

          {callTimes.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Truck className="size-4 text-primary" /> Vendor call times
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    update((d) => {
                      for (const v of d.vendors) v.arrivalTime = vendorArrival(d as typeof ev, v.id) ?? v.arrivalTime;
                    });
                    toast.success("Arrival times saved to vendors");
                  }}
                >
                  Save to vendors
                </Button>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {callTimes.map(({ v, time }) => (
                  <li key={v.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-sm">
                    <span>
                      {VENDOR_CATEGORIES[v.category].emoji} {v.name}
                    </span>
                    <span className="font-medium tabular-nums">{formatTime(time!)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">30 minutes before each vendor&apos;s first moment.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
