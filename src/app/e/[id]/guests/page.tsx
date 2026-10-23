"use client";

import { Download, Eraser, Link2, Pencil, Plus, Search, Trash2, Upload, Wand2 } from "lucide-react";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BlueprintCanvas } from "@/components/blueprint/canvas";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { seatIndex } from "@/lib/engine/geometry";
import { aiApi } from "@/lib/ai-client";
import { autoSeat, EMPTY_RULES, matchGuests, type SeatingRules } from "@/lib/engine/seating";
import { blankGuest, DIET_LABELS, GUEST_CSV_TEMPLATE, parseGuestRows } from "@/lib/guests";
import { buildSeatLink } from "@/lib/seat-link";
import { GuestEditorDialog } from "@/components/guests/guest-editor-dialog";
import { SmartSeatingDialog } from "@/components/guests/smart-seating-dialog";
import { guestSeatVisual, guestsBySeat, SEAT_LEGEND } from "@/lib/seat-visuals";
import type { Guest, Rsvp } from "@/lib/types";
import { cn } from "@/lib/utils";

const RSVP_STYLE: Record<Rsvp, string> = {
  yes: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  maybe: "bg-sky-100 text-sky-800",
  no: "bg-stone-200 text-stone-600",
};

export default function GuestsPage() {
  const { ev, layout, update } = useCurrentEvent();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [seatOpen, setSeatOpen] = useState(false);
  const [rules, setRules] = useState("");
  const [seating, setSeating] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const seats = useMemo(() => (layout ? seatIndex(layout) : new Map()), [layout]);
  const bySeat = useMemo(() => (ev ? guestsBySeat(ev) : new Map<string, Guest>()), [ev]);
  if (!ev) return null;

  const seatOf = (g: Guest) => (g.seatId && bySeat.get(g.seatId)?.id === g.id ? seats.get(g.seatId) : undefined);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");
  const seatedCount = attending.filter((g) => seatOf(g)).length;
  const count = (fn: (g: Guest) => boolean) => ev.guests.filter(fn).length;
  const groups = [...new Set(ev.guests.map((g) => g.group).filter(Boolean))].sort();

  const list = ev.guests.filter((g) => {
    if (q && !`${g.name} ${g.group}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "unseated") return g.rsvp !== "no" && !seatOf(g);
    if (filter === "vip") return g.vip;
    if (filter === "pending") return g.rsvp === "pending" || g.rsvp === "maybe";
    if (filter === "access") return g.accessible;
    if (filter.startsWith("group:")) return g.group === filter.slice(6);
    return true;
  });
  const selectedGuest = ev.guests.find((g) => g.id === selected);
  const focusIds = selectedGuest && seatOf(selectedGuest) ? new Set([seatOf(selectedGuest)!.elementId]) : undefined;

  const assignSeat = (seatId: string) => {
    const occupant = bySeat.get(seatId);
    if (!selectedGuest) {
      if (occupant) setSelected(occupant.id);
      else toast.info("Pick a guest from the list first, then click an empty seat.");
      return;
    }
    if (occupant?.id === selectedGuest.id) return;
    const from = seatOf(selectedGuest)?.id;
    update((d) => {
      const g = d.guests.find((x) => x.id === selectedGuest.id)!;
      g.seatId = seatId;
      if (occupant) d.guests.find((x) => x.id === occupant.id)!.seatId = from;
    });
    const label = seats.get(seatId)?.label;
    toast.success(occupant ? `Swapped ${selectedGuest.name} with ${occupant.name}` : `${selectedGuest.name} → ${label}`);
  };

  const runAutoSeat = async () => {
    setSeating(true);
    let parsed: SeatingRules = EMPTY_RULES;
    let usedAi = false;
    if (rules.trim()) {
      const data = await aiApi.seating({ rules, guests: ev.guests.map((g) => ({ name: g.name, group: g.group })) });
      if (data) {
        parsed = {
          keepTogether: data.rules.keepTogether.map((s) => matchGuests(ev, s)),
          keepApart: data.rules.keepApart.map((s) => matchGuests(ev, s)),
          nearStage: matchGuests(ev, data.rules.nearStage),
          nearExit: matchGuests(ev, data.rules.nearExit),
        };
        usedAi = data.source === "ai";
      }
    }
    const result = autoSeat(ev, layout, parsed);
    update((d) => {
      for (const g of d.guests) g.seatId = result.assignments[g.id];
    });
    setNotes([
      ...(rules.trim()
        ? [
            usedAi
              ? "AI understood your seating rules."
              : "AI was unavailable, so the default rules were used (families together, VIPs up front).",
          ]
        : []),
      ...result.notes,
    ]);
    setSeating(false);
    toast.success(`Seated ${result.placed} guests`);
  };

  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const guests = parseGuestRows(res.data);
        update((d) => void d.guests.push(...guests));
        toast.success(`Imported ${guests.length} guests`);
      },
      error: () => toast.error("Couldn't read that CSV"),
    });
  };

  const downloadSample = () => {
    const csv = GUEST_CSV_TEMPLATE;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "guest-list-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareLink = async (g: Guest) => {
    const url = buildSeatLink(window.location.origin, ev, layout, g);
    if (!url) {
      toast.error("Seat this guest first");
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success(`Seat link for ${g.name} copied`, { action: { label: "Open", onClick: () => window.open(url, "_blank") } });
  };

  const saveGuest = () => {
    if (!editing || !editing.name.trim()) {
      toast.error("Name is required");
      return;
    }
    update((d) => {
      const i = d.guests.findIndex((g) => g.id === editing.id);
      if (i >= 0) d.guests[i] = editing;
      else d.guests.push(editing);
    });
    setEditing(null);
  };

  const stats = [
    { label: "Invited", value: ev.guests.length },
    { label: "Confirmed", value: count((g) => g.rsvp === "yes") },
    { label: "Pending", value: count((g) => g.rsvp === "pending" || g.rsvp === "maybe") },
    { label: "Declined", value: count((g) => g.rsvp === "no") },
    { label: "Seated", value: `${seatedCount}/${attending.length}` },
    {
      label: "Veg · Non-veg",
      value: `${count((g) => g.rsvp !== "no" && g.dietary !== "non-veg")} · ${count((g) => g.rsvp !== "no" && g.dietary === "non-veg")}`,
    },
    { label: "Kids", value: count((g) => g.child && g.rsvp !== "no") },
    { label: "Wheelchair", value: count((g) => g.accessible && g.rsvp !== "no") },
  ];

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <div className="flex flex-wrap gap-2 border-b bg-card px-4 py-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-background px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setSeatOpen(true)}>
            <Wand2 className="size-3.5" /> Auto-seat
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(blankGuest())}>
            <Plus className="size-3.5" /> Guest
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Import CSV
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={downloadSample} aria-label="Download CSV template">
            <Download />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 flex-col border-b lg:w-[440px] lg:border-r lg:border-b-0">
          <div className="flex gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guests or groups"
                className="h-8 pl-8"
                aria-label="Search guests"
              />
            </div>
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40" aria-label="Filter guests">
              <option value="all">All guests</option>
              <option value="unseated">Needs a seat</option>
              <option value="pending">RSVP pending</option>
              <option value="vip">VIP</option>
              <option value="access">Wheelchair</option>
              {groups.map((g) => (
                <option key={g} value={`group:${g}`}>
                  {g}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div aria-live="polite">
            {selectedGuest && (
              <div className="space-y-2 border-b bg-primary/5 px-3 py-2 text-xs text-primary">
                <p>
                  <span className="font-semibold">{selectedGuest.name}</span> selected. Click any seat on the map to{" "}
                  {seatOf(selectedGuest) ? "move them (occupied seats swap)" : "seat them"}, or pick one here:
                </p>
                {/* Keyboard and screen-reader path to the same seat assignment as the canvas */}
                <NativeSelect
                  value=""
                  onChange={(e) => e.target.value && assignSeat(e.target.value)}
                  aria-label={`Choose a seat for ${selectedGuest.name}`}
                  className="bg-card"
                >
                  <option value="">Choose a seat…</option>
                  {layout.elements
                    .filter((el) => [...seats.values()].some((s) => s.elementId === el.id))
                    .map((el) => (
                      <optgroup key={el.id} label={el.label}>
                        {[...seats.values()]
                          .filter((s) => s.elementId === el.id)
                          .map((s) => {
                            const occupant = bySeat.get(s.id);
                            return (
                              <option key={s.id} value={s.id} disabled={occupant?.id === selectedGuest.id}>
                                {el.label} seat {s.index + 1}{" "}
                                {occupant ? (occupant.id === selectedGuest.id ? "(current)" : `(swap with ${occupant.name})`) : "(free)"}
                              </option>
                            );
                          })}
                      </optgroup>
                    ))}
                </NativeSelect>
              </div>
            )}
          </div>
          <ul className="max-h-[50vh] min-h-0 flex-1 scrollbar-thin divide-y overflow-y-auto lg:max-h-none" aria-label="Guest list">
            {list.map((g) => {
              const seat = seatOf(g);
              return (
                <li
                  key={g.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 transition hover:bg-muted/60",
                    selected === g.id && "bg-primary/10",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-pressed={selected === g.id}
                    onClick={() => setSelected(selected === g.id ? null : g.id)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {g.name}{" "}
                      {g.vip && (
                        <span title="VIP">
                          ⭐<span className="sr-only">VIP</span>
                        </span>
                      )}{" "}
                      {g.accessible && (
                        <span title="Wheelchair user">
                          ♿<span className="sr-only">wheelchair user</span>
                        </span>
                      )}{" "}
                      {g.child && (
                        <span title="Child">
                          🧒<span className="sr-only">child</span>
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {g.group || "No group"} · {DIET_LABELS[g.dietary]}
                    </span>
                  </button>
                  <NativeSelect
                    value={g.rsvp}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update((d) => void (d.guests.find((x) => x.id === g.id)!.rsvp = e.target.value as Rsvp))}
                    className={cn("w-24 rounded-lg text-xs [&_select]:h-7 [&_select]:border-0", RSVP_STYLE[g.rsvp])}
                    aria-label={`RSVP for ${g.name}`}
                  >
                    <option value="yes">Yes</option>
                    <option value="pending">Pending</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </NativeSelect>
                  <Badge variant={seat ? "secondary" : "outline"} className="w-14 justify-center text-[10px]">
                    {seat ? `${seat.tableLabel}·${seat.index + 1}` : g.rsvp === "no" ? "–" : "No seat"}
                  </Badge>
                  <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => (e.stopPropagation(), shareLink(g))}
                      aria-label={`Copy seat link for ${g.name}`}
                      title="Copy 'find my seat' link"
                    >
                      <Link2 />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => (e.stopPropagation(), setEditing({ ...g }))}
                      aria-label={`Edit ${g.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        update((d) => void (d.guests = d.guests.filter((x) => x.id !== g.id)));
                      }}
                      aria-label={`Remove ${g.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {ev.guests.length
                  ? "No guests match this filter."
                  : "No guests yet. Add them one by one or import a CSV (download the template with the ⬇ button)."}
              </li>
            )}
          </ul>
        </section>

        <section className="relative min-h-[420px] flex-1">
          <BlueprintCanvas
            layout={layout}
            mode="seats"
            showGrid={false}
            seatVisual={(s) => guestSeatVisual(bySeat.get(s.id), s, { highlightGuestId: selected ?? undefined })}
            onSeatClick={(s) => assignSeat(s.id)}
            focusIds={focusIds}
          />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-card/95 px-3 py-2 text-[11px] shadow-sm">
            {SEAT_LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="size-3 rounded-full border" style={{ background: l.color, borderColor: l.border ?? l.color }} /> {l.label}
              </span>
            ))}
          </div>
          {seatedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="absolute top-3 right-3 gap-1.5 bg-card"
              onClick={() => {
                if (confirm("Clear all seat assignments?")) update((d) => d.guests.forEach((g) => (g.seatId = undefined)));
              }}
            >
              <Eraser className="size-3.5" /> Clear seating
            </Button>
          )}
        </section>
      </div>

      <SmartSeatingDialog
        open={seatOpen}
        onOpenChange={setSeatOpen}
        rules={rules}
        onRulesChange={setRules}
        notes={notes}
        busy={seating}
        disabled={ev.guests.length === 0}
        onRun={runAutoSeat}
      />

      <GuestEditorDialog
        guest={editing}
        isNew={!ev.guests.some((g) => g.id === editing?.id)}
        groups={groups}
        onChange={setEditing}
        onClose={() => setEditing(null)}
        onSave={saveGuest}
      />
    </div>
  );
}
