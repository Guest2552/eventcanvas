"use client";

import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ScoreRing } from "@/components/event/score-ring";
import { ELEMENTS, getDef, TABLE_KINDS, type TableKind } from "@/lib/catalog/elements";
import { getTemplate, VENUE_TEMPLATES } from "@/lib/catalog/templates";
import { blueprintCosts, expectedGuests } from "@/lib/engine/costs";
import { totalSeats } from "@/lib/engine/geometry";
import { autoLayout, defaultIntent, fixturesToElements, type LayoutIntent, sanitizeIntent } from "@/lib/engine/layout";
import { validateLayout } from "@/lib/engine/validation";
import { inrShort } from "@/lib/format";
import { activeLayoutOf } from "@/lib/store";
import type { EventPlan, Layout } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIXTURE_KINDS = new Set(["entry", "exit", "restroom", "kitchen", "pillar", "wall"]);
const OPTION_KINDS = ELEMENTS.filter((d) => d.category !== "seating" && !FIXTURE_KINDS.has(d.kind)).map((d) => d.kind);

export function GenerateLayoutDialog({ ev, open, onOpenChange, onGenerate }: { ev: EventPlan; open: boolean; onOpenChange: (o: boolean) => void; onGenerate: (layout: Layout, replace: boolean) => void }) {
  const current = activeLayoutOf(ev);
  const [venueChoice, setVenueChoice] = useState<string>("current");
  const [guests, setGuests] = useState(expectedGuests(ev));
  const [intent, setIntent] = useState<LayoutIntent>(() => defaultIntent(ev.type, expectedGuests(ev), current.venue.indoor));
  const [replace, setReplace] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (kind: string) => setIntent((i) => ({ ...i, include: i.include.includes(kind) ? i.include.filter((k) => k !== kind) : [...i.include, kind] }));

  const askAi = async () => {
    setLoading(true);
    try {
      const venue = venueChoice === "current" ? current.venue : getTemplate(venueChoice).venue;
      const res = await fetch("/api/ai/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, event: { type: ev.type, guestCount: guests, theme: ev.theme, city: ev.city, notes: ev.notes }, venue }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { intent: LayoutIntent; reasoning: string; source: string };
      setIntent(sanitizeIntent(data.intent, intent));
      setAiNote(data.source === "ai" ? data.reasoning : "AI is offline, so we used the recommended setup for this event type.");
    } catch {
      setIntent(defaultIntent(ev.type, guests, current.venue.indoor));
      setAiNote("AI is unavailable right now, so we used the recommended setup for this event type.");
    } finally {
      setLoading(false);
    }
  };

  const generate = () => {
    const template = venueChoice === "current" ? null : getTemplate(venueChoice);
    const venue = template ? { ...template.venue } : { ...current.venue };
    const fixtures = template ? fixturesToElements(venue, template.fixtures) : current.elements.filter((e) => FIXTURE_KINDS.has(e.kind));
    const result = autoLayout({ venue, fixtures, guestCount: guests, intent });
    const letter = String.fromCharCode(65 + ev.layouts.length);
    const layout: Layout = {
      id: replace ? current.id : nanoid(8),
      name: replace ? current.name : `Plan ${letter} · ${venue.name}`,
      venue,
      elements: result.elements,
      zones: result.zones,
    };
    onGenerate(layout, replace);
    if (result.dropped.length) toast.info(`To seat everyone we skipped: ${result.dropped.map((k) => getDef(k).label.toLowerCase()).join(", ")}.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" /> Auto-layout
          </DialogTitle>
          <DialogDescription>Choose what goes in the room. The layout engine places everything with safe aisles and exits, seating nearest the stage first.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-primary" /> Tell the AI what you want (optional)
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Big dance floor, mandap for the ceremony, a kids corner and a separate bar…" className="min-h-14 flex-1 bg-card" />
            <Button onClick={askAi} disabled={loading} variant="outline" className="gap-1.5 self-end">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Ask AI
            </Button>
          </div>
          {aiNote && <p className="mt-2 text-xs text-muted-foreground">{aiNote}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Venue</Label>
            <NativeSelect value={venueChoice} onChange={(e) => setVenueChoice(e.target.value)}>
              <option value="current">Keep current ({current.venue.widthFt}×{current.venue.lengthFt} ft)</option>
              {VENUE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.name} ({t.venue.widthFt}×{t.venue.lengthFt})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Guests to seat</Label>
            <Input type="number" min={1} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Seating style</Label>
            <NativeSelect value={intent.tableKind} onChange={(e) => setIntent((i) => ({ ...i, tableKind: e.target.value as TableKind }))}>
              {TABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {getDef(k).label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Include</Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {OPTION_KINDS.map((k) => {
              const d = getDef(k);
              const on = intent.include.includes(k);
              return (
                <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition", on && "border-primary/40 bg-primary/5")}>
                  <Checkbox checked={on} onCheckedChange={() => toggle(k)} />
                  <span>
                    {d.emoji} {d.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => setReplace(false)} className={cn("rounded-lg border px-3 py-1.5", !replace && "border-primary bg-primary/5 font-medium text-primary")}>
            {!replace && <Check className="mr-1 inline size-3" />}Save as a new version (compare later)
          </button>
          <button onClick={() => setReplace(true)} className={cn("rounded-lg border px-3 py-1.5", replace && "border-primary bg-primary/5 font-medium text-primary")}>
            {replace && <Check className="mr-1 inline size-3" />}Replace &ldquo;{current.name}&rdquo;
          </button>
        </div>

        <DialogFooter>
          <Button onClick={generate} className="gap-1.5">
            <Wand2 className="size-4" /> Generate layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompareDialog({ ev, open, onOpenChange, onActivate }: { ev: EventPlan; open: boolean; onOpenChange: (o: boolean) => void; onActivate: (id: string) => void }) {
  const rows = ev.layouts.map((l) => {
    const v = validateLayout(ev, l);
    return { l, v, cost: blueprintCosts(l, ev.city).total, seats: totalSeats(l) };
  });
  const bestScore = Math.max(...rows.map((r) => r.v.score));
  const cheapest = Math.min(...rows.map((r) => r.cost));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare layout versions</DialogTitle>
          <DialogDescription>Side-by-side safety, capacity and rental cost for every version of this venue plan.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ l, v, cost, seats }) => (
            <div key={l.id} className={cn("space-y-2 rounded-xl border p-3", l.id === ev.activeLayoutId && "border-primary ring-2 ring-primary/15")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.venue.widthFt}×{l.venue.lengthFt} ft · {l.venue.indoor ? "Indoor" : "Outdoor"}
                  </p>
                </div>
                <ScoreRing value={v.score} size={44} />
              </div>
              <div className="flex flex-wrap gap-1">
                {v.score === bestScore && rows.length > 1 && <Badge className="h-4 px-1.5 text-[10px]">Safest</Badge>}
                {cost === cheapest && rows.length > 1 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Cheapest</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Seats</dt>
                <dd className={cn("text-right font-medium", seats < v.stats.guests && "text-destructive")}>
                  {seats} / {v.stats.guests}
                </dd>
                <dt className="text-muted-foreground">Rentals</dt>
                <dd className="text-right font-medium">{inrShort(cost)}</dd>
                <dt className="text-muted-foreground">Space / guest</dt>
                <dd className="text-right font-medium">{Number.isFinite(v.stats.sqftPerGuest) ? `${v.stats.sqftPerGuest.toFixed(0)} ft²` : "–"}</dd>
                <dt className="text-muted-foreground">Issues</dt>
                <dd className="text-right font-medium">{v.issues.filter((i) => i.severity !== "info").length}</dd>
              </dl>
              <Button size="sm" variant={l.id === ev.activeLayoutId ? "secondary" : "outline"} className="w-full" disabled={l.id === ev.activeLayoutId} onClick={() => onActivate(l.id)}>
                {l.id === ev.activeLayoutId ? "Active version" : "Use this version"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
