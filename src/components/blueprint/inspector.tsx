"use client";

import { AlertTriangle, CircleAlert, Copy, Info, Link2, RotateCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ScoreRing, StatTile } from "@/components/event/score-ring";
import { getDef, seatCount } from "@/lib/catalog/elements";
import { VENDOR_CATEGORIES, VENDOR_STATUSES, ZONE_KINDS } from "@/lib/catalog/planning";
import { blueprintCosts, unitCost } from "@/lib/engine/costs";
import { aabb, center, inBox } from "@/lib/engine/geometry";
import type { ChecklistItem } from "@/lib/engine/planning";
import type { Issue, ValidationResult } from "@/lib/engine/validation";
import { inr, inrShort } from "@/lib/format";
import type { EventPlan, Layout, PlacedElement, Venue, Zone, ZoneKind } from "@/lib/types";
import { cn } from "@/lib/utils";

function NumField({
  label,
  value,
  onChange,
  step = 0.5,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-2 text-sm text-[11px] leading-none font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 text-sm"
      />
    </label>
  );
}

export function ElementInspector({
  ev,
  layout,
  el,
  onChange,
  onDuplicate,
  onDelete,
}: {
  ev: EventPlan;
  layout: Layout;
  el: PlacedElement;
  onChange: (patch: Partial<PlacedElement>, field: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const def = getDef(el.kind);
  const seats = seatCount(el.kind, el.w);
  const seated = ev.guests.filter((g) => g.seatId?.startsWith(`${el.id}:`));
  const vendors = def.vendor ? ev.vendors.filter((v) => v.category === def.vendor) : [];
  const c = center(aabb(el));
  const zones = layout.zones.filter((z) => inBox(c, z));
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-lg">{def.emoji || "▪"}</span>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{def.label}</p>
          <Input
            value={el.label}
            onChange={(e) => onChange({ label: e.target.value }, "label")}
            className="h-7 text-sm font-semibold"
            aria-label="Label"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumField label="Width (ft)" value={el.w} min={1} onChange={(w) => onChange(def.keepRatio ? { w, h: w } : { w }, "w")} />
        <NumField label="Depth (ft)" value={el.h} min={1} onChange={(h) => onChange(def.keepRatio ? { w: h, h } : { h }, "h")} />
        <NumField label="X (ft)" value={el.x} onChange={(x) => onChange({ x }, "x")} />
        <NumField label="Y (ft)" value={el.y} onChange={(y) => onChange({ y }, "y")} />
        <NumField
          label="Rotation (°)"
          value={el.rotation}
          step={15}
          onChange={(rotation) => onChange({ rotation: ((rotation % 360) + 360) % 360 }, "rotation")}
        />
        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={() => onChange({ rotation: (el.rotation + 90) % 360 }, "rotate90")}
          >
            <RotateCw className="size-3.5" /> Rotate 90°
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="flex items-center gap-1 font-semibold">
          <Link2 className="size-3.5 text-primary" /> Linked to your plan
        </p>
        <p className="text-muted-foreground">
          Rental: <span className="font-medium text-foreground">{inr(unitCost(el.kind, ev.city))}</span> added to the budget
        </p>
        {seats > 0 && (
          <p className="text-muted-foreground">
            Seats:{" "}
            <span className="font-medium text-foreground">
              {seated.length}/{seats} filled
            </span>
            {seated.length > 0 && <span className="block truncate">{seated.map((g) => g.name).join(", ")}</span>}
          </p>
        )}
        {def.vendor && (
          <p className="text-muted-foreground">
            Needs: <span className="font-medium text-foreground">{VENDOR_CATEGORIES[def.vendor].label}</span>{" "}
            {vendors.length ? (
              vendors.map((v) => (
                <Badge key={v.id} variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                  {v.name} · {VENDOR_STATUSES.find((s) => s.id === v.status)?.label}
                </Badge>
              ))
            ) : (
              <Link href={`/e/${ev.id}/vendors`} className="text-primary underline-offset-2 hover:underline">
                none yet, add one
              </Link>
            )}
          </p>
        )}
        {zones.length > 0 && <p className="text-muted-foreground">Zone: {zones.map((z) => z.name).join(", ")}</p>}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onDuplicate}>
          <Copy className="size-3.5" /> Duplicate
        </Button>
        <Button variant="destructive" size="sm" className="flex-1 gap-1" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Shortcuts: Del · Ctrl+D duplicate · R rotate · arrows nudge (Shift = 2 ft)</p>
    </div>
  );
}

export function ZoneInspector({
  zone,
  onChange,
  onDelete,
}: {
  zone: Zone;
  onChange: (patch: Partial<Zone>, field: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Zone</p>
      <label className="block space-y-1">
        <span className="flex items-center gap-2 text-sm text-[11px] leading-none font-medium text-muted-foreground">Name</span>
        <Input value={zone.name} onChange={(e) => onChange({ name: e.target.value }, "name")} className="h-8" />
      </label>
      <label className="block space-y-1">
        <span className="flex items-center gap-2 text-sm text-[11px] leading-none font-medium text-muted-foreground">Type</span>
        <NativeSelect
          value={zone.kind}
          onChange={(e) => onChange({ kind: e.target.value as ZoneKind, color: ZONE_KINDS[e.target.value as ZoneKind].color }, "kind")}
        >
          {(Object.keys(ZONE_KINDS) as ZoneKind[]).map((k) => (
            <option key={k} value={k}>
              {ZONE_KINDS[k].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground">VIP zones get priority in auto-seating and VIP pricing in seat booking.</p>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Width (ft)" value={zone.w} min={2} onChange={(w) => onChange({ w }, "w")} />
        <NumField label="Depth (ft)" value={zone.h} min={2} onChange={(h) => onChange({ h }, "h")} />
      </div>
      <Button variant="destructive" size="sm" className="w-full gap-1" onClick={onDelete}>
        <Trash2 className="size-3.5" /> Delete zone
      </Button>
    </div>
  );
}

const SEVERITY = {
  error: { icon: CircleAlert, cls: "text-destructive" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  info: { icon: Info, cls: "text-sky-600" },
};

export function LayoutOverview({
  ev,
  layout,
  validation,
  checklist,
  onIssueClick,
  onSelectItem,
  onRename,
  onVenueChange,
}: {
  ev: EventPlan;
  layout: Layout;
  validation: ValidationResult;
  checklist: ChecklistItem[];
  onIssueClick: (issue: Issue) => void;
  onSelectItem: (id: string) => void;
  onRename: (name: string) => void;
  onVenueChange: (patch: Partial<Venue>, field: string) => void;
}) {
  const costs = blueprintCosts(layout, ev.city);
  const { stats } = validation;
  const fromLayout = checklist.filter((c) => c.status === "missing" && c.reasons.some((r) => r.startsWith("You placed")));
  return (
    <div className="space-y-4 p-4">
      <label className="block space-y-1">
        <span className="flex items-center gap-2 text-sm text-[11px] leading-none font-medium text-muted-foreground">Version name</span>
        <Input value={layout.name} onChange={(e) => onRename(e.target.value)} className="h-8 font-medium" />
      </label>

      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <ScoreRing value={validation.score} size={60} label="safety" />
        <div className="text-xs">
          <p className="font-semibold">Layout safety check</p>
          <p className="text-muted-foreground">Aisles, exits, capacity, overlaps and accessibility, checked live as you edit.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Seats / guests"
          value={`${stats.seats} / ${stats.guests}`}
          sub={stats.seats >= stats.guests ? "Everyone fits" : `${stats.guests - stats.seats} short`}
        />
        <StatTile
          label="Space per guest"
          value={Number.isFinite(stats.sqftPerGuest) ? `${stats.sqftPerGuest.toFixed(0)} ft²` : "–"}
          sub="12+ recommended"
        />
        <StatTile label="Rentals from layout" value={inrShort(costs.total)} sub="Flows into Budget" />
        <StatTile label="Items placed" value={layout.elements.length} sub={`${layout.zones.length} zones`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold">Issues ({validation.issues.length})</p>
        {validation.issues.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">All clear. This layout passes every check. 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {validation.issues.map((issue) => {
              const S = SEVERITY[issue.severity];
              return (
                <li key={issue.id}>
                  <button
                    onClick={() => onIssueClick(issue)}
                    className="flex w-full gap-2 rounded-lg border bg-card p-2 text-left transition hover:border-primary/40"
                  >
                    <S.icon className={cn("mt-0.5 size-4 shrink-0", S.cls)} />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{issue.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{issue.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {fromLayout.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <p className="font-semibold text-primary">Vendors your layout needs</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {fromLayout.map((c) => (
              <li key={c.category}>
                {c.emoji} {c.label}: {c.reasons.find((r) => r.startsWith("You placed"))?.replace(/^You placed an? /, "for the ")}
              </li>
            ))}
          </ul>
          <Link href={`/e/${ev.id}/vendors`} className="mt-1 inline-block font-medium text-primary hover:underline">
            Open vendor checklist →
          </Link>
        </div>
      )}

      {/* Keyboard path into the canvas: pick an item here, then edit it in the inspector or nudge it with arrow keys */}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-xs font-semibold">Items on the blueprint ({layout.elements.length})</summary>
        <ul className="mt-2 grid max-h-56 scrollbar-thin grid-cols-2 gap-1 overflow-y-auto" aria-label="Blueprint items">
          {layout.elements.map((el) => (
            <li key={el.id}>
              <button
                type="button"
                onClick={() => onSelectItem(el.id)}
                className="w-full truncate rounded-md border px-2 py-1 text-left text-xs transition hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {getDef(el.kind).emoji} {el.label}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-semibold">Venue</p>
        <Input
          value={layout.venue.name}
          onChange={(e) => onVenueChange({ name: e.target.value }, "name")}
          className="h-7 text-sm"
          aria-label="Venue name"
        />
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="Width (ft)"
            value={layout.venue.widthFt}
            step={5}
            min={20}
            onChange={(widthFt) => onVenueChange({ widthFt: Math.max(20, widthFt) }, "w")}
          />
          <NumField
            label="Length (ft)"
            value={layout.venue.lengthFt}
            step={5}
            min={20}
            onChange={(lengthFt) => onVenueChange({ lengthFt: Math.max(20, lengthFt) }, "h")}
          />
        </div>
        <label className="flex items-center justify-between text-xs">
          Indoor venue
          <Switch checked={layout.venue.indoor} onCheckedChange={(indoor) => onVenueChange({ indoor }, "indoor")} />
        </label>
      </div>
    </div>
  );
}
