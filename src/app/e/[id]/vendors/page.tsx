"use client";

import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VENDOR_STATUSES } from "@/lib/catalog/planning";
import { vendorChecklist } from "@/lib/engine/planning";
import { inrShort } from "@/lib/format";
import type { Vendor, VendorCategory, VendorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Column, VendorCard } from "@/components/vendors/vendor-board";
import { VendorDialog } from "@/components/vendors/vendor-dialog";

const STATUS_BADGE = {
  missing: "bg-rose-100 text-rose-700",
  "in-progress": "bg-amber-100 text-amber-800",
  booked: "bg-emerald-100 text-emerald-800",
};

const blankVendor = (category: VendorCategory): Vendor => ({
  id: nanoid(8),
  category,
  name: "",
  status: "todo",
  quote: 0,
  paid: 0,
  zoneIds: [],
});

export default function VendorsPage() {
  const { ev, layout, update } = useCurrentEvent();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const checklist = useMemo(() => (ev ? vendorChecklist(ev, layout) : []), [ev, layout]);
  // Keyboard sensor: focus a card, press Space to lift, arrow keys to move, Space to drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  if (!ev) return null;

  const onDragEnd = (e: DragEndEvent) => {
    const status = e.over?.id as VendorStatus | undefined;
    if (!status) return;
    update((d) => {
      const v = d.vendors.find((x) => x.id === e.active.id);
      if (v && v.status !== status) v.status = status;
    });
  };
  const booked = checklist.filter((c) => c.status === "booked").length;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Tabs defaultValue="checklist">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="board">Status board</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {booked}/{checklist.length} booked
            </span>
            <Button size="sm" className="gap-1.5" onClick={() => setEditing(blankVendor("catering"))}>
              <Plus className="size-3.5" /> Vendor
            </Button>
          </div>
        </div>

        <TabsContent value="checklist" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Built from your event type and from what&apos;s on your blueprint. Place a DJ booth and the DJ shows up here.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((c) => (
              <div key={c.category} className="flex flex-col rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{c.emoji}</span>
                    <div>
                      <p className="font-semibold">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground">{c.reasons.join(" · ")}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[c.status])}>
                    {c.status === "in-progress" ? "In progress" : c.status === "booked" ? "Booked" : "Missing"}
                  </span>
                </div>
                <div className="mt-3 flex-1 space-y-1.5">
                  {c.vendors.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setEditing({ ...v })}
                      className="flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-sm transition hover:border-primary/40"
                    >
                      <span className="truncate">{v.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {v.quote > 0 && inrShort(v.quote)}
                        <span
                          className="size-2 rounded-full"
                          style={{ background: VENDOR_STATUSES.find((s) => s.id === v.status)?.color }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setEditing(blankVendor(c.category))}>
                  <Plus className="size-3.5" /> Add {c.label.toLowerCase()}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
              {VENDOR_STATUSES.map((s) => (
                <Column key={s.id} id={s.id} label={s.label} color={s.color} count={ev.vendors.filter((v) => v.status === s.id).length}>
                  {ev.vendors
                    .filter((v) => v.status === s.id)
                    .map((v) => (
                      <VendorCard key={v.id} v={v} ev={ev} onOpen={() => setEditing({ ...v })} />
                    ))}
                </Column>
              ))}
            </div>
          </DndContext>
          <p className="mt-2 text-xs text-muted-foreground">
            Drag cards between columns. Quotes from Quoted onwards count toward your budget.
          </p>
        </TabsContent>
      </Tabs>

      <VendorDialog
        ev={ev}
        vendor={editing}
        zones={layout.zones}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          update((d) => {
            const i = d.vendors.findIndex((x) => x.id === v.id);
            if (i >= 0) d.vendors[i] = v;
            else d.vendors.push(v);
          });
          setEditing(null);
          toast.success(`${v.name} saved`);
        }}
        onDelete={(id) => {
          update((d) => {
            d.vendors = d.vendors.filter((x) => x.id !== id);
            for (const s of d.schedule) s.vendorIds = s.vendorIds.filter((x) => x !== id);
          });
          setEditing(null);
        }}
      />
    </div>
  );
}
