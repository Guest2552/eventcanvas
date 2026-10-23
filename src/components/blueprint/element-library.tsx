"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CATEGORY_STYLE, type ElementCategory, ELEMENTS, seatCount } from "@/lib/catalog/elements";
import { unitCost } from "@/lib/engine/costs";
import { inrShort } from "@/lib/format";

export function ElementLibrary({ city, onAdd }: { city: string; onAdd: (kind: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = ELEMENTS.filter((e) => e.label.toLowerCase().includes(q.toLowerCase()));
  const groups = (Object.keys(CATEGORY_STYLE) as ElementCategory[]).map((c) => ({ c, items: filtered.filter((e) => e.category === c) })).filter((g) => g.items.length);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add to venue</p>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className="h-8 pl-8 text-sm" aria-label="Search items" />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Drag onto the floor plan, or click to drop it in a free spot.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 scrollbar-thin">
        {groups.map(({ c, items }) => (
          <div key={c}>
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{CATEGORY_STYLE[c].label}</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {items.map((def) => {
                const seats = seatCount(def.kind, def.w);
                const cost = unitCost(def.kind, city);
                return (
                  <button
                    key={def.kind}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-element-kind", def.kind);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(def.kind)}
                    className="group flex cursor-grab items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-left transition hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
                    title={`${def.label} · ${def.w}×${def.h} ft`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm" style={{ background: CATEGORY_STYLE[c].fill, border: `1px solid ${CATEGORY_STYLE[c].stroke}40` }}>
                      {def.emoji || "▪"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{def.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {def.w}×{def.h} ft{seats ? ` · ${seats} seats` : ""}
                        {cost ? ` · ${inrShort(cost)}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
