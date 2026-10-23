"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { VENDOR_CATEGORIES } from "@/lib/catalog/planning";
import { formatTime, inrShort } from "@/lib/format";
import type { EventPlan, Vendor } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Drop column for one vendor status on the board. */
export function Column({
  id,
  label,
  color,
  count,
  children,
}: {
  id: string;
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn("min-h-64 min-w-52 rounded-2xl border bg-muted/40 p-2 transition", isOver && "border-primary/50 bg-primary/5")}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Draggable vendor card: quote, arrival time and the zones the vendor works in. */
export function VendorCard({ v, ev, onOpen }: { v: Vendor; ev: EventPlan; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: v.id });
  const zones = ev.layouts.flatMap((l) => l.zones).filter((z) => v.zoneIds.includes(z.id));
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "cursor-grab rounded-xl border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <p className="truncate font-medium">
        {VENDOR_CATEGORIES[v.category].emoji} {v.name}
      </p>
      <p className="text-[11px] text-muted-foreground">{VENDOR_CATEGORIES[v.category].label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {v.quote > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {inrShort(v.quote)}
          </Badge>
        )}
        {v.arrivalTime && (
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            Arrive {formatTime(v.arrivalTime)}
          </Badge>
        )}
        {zones.map((z) => (
          <Badge key={z.id} variant="outline" className="h-4 px-1.5 text-[10px]" style={{ borderColor: z.color, color: z.color }}>
            {z.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
