"use client";

import { DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Check, Copy, Loader2, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { eventSummary, streamFromRoute } from "@/lib/ai-client";
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from "@/lib/catalog/planning";
import { vendorChecklist } from "@/lib/engine/planning";
import { offlineWrite } from "@/lib/engine/offline";
import { formatTime, inrShort } from "@/lib/format";
import type { EventPlan, Vendor, VendorCategory, VendorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_BADGE = { missing: "bg-rose-100 text-rose-700", "in-progress": "bg-amber-100 text-amber-800", booked: "bg-emerald-100 text-emerald-800" };

const blankVendor = (category: VendorCategory): Vendor => ({ id: nanoid(8), category, name: "", status: "todo", quote: 0, paid: 0, zoneIds: [] });

export default function VendorsPage() {
  const { ev, layout, update } = useCurrentEvent();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const checklist = useMemo(() => (ev ? vendorChecklist(ev, layout) : []), [ev, layout]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
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
          <p className="mb-3 text-sm text-muted-foreground">Built from your event type and from what&apos;s on your blueprint. Place a DJ booth and the DJ shows up here.</p>
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
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BADGE[c.status])}>{c.status === "in-progress" ? "In progress" : c.status === "booked" ? "Booked" : "Missing"}</span>
                </div>
                <div className="mt-3 flex-1 space-y-1.5">
                  {c.vendors.map((v) => (
                    <button key={v.id} onClick={() => setEditing({ ...v })} className="flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-sm transition hover:border-primary/40">
                      <span className="truncate">{v.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {v.quote > 0 && inrShort(v.quote)}
                        <span className="size-2 rounded-full" style={{ background: VENDOR_STATUSES.find((s) => s.id === v.status)?.color }} />
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
          <p className="mt-2 text-xs text-muted-foreground">Drag cards between columns. Quotes from Quoted onwards count toward your budget.</p>
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

function Column({ id, label, color, count, children }: { id: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("min-h-64 min-w-52 rounded-2xl border bg-muted/40 p-2 transition", isOver && "border-primary/50 bg-primary/5")}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function VendorCard({ v, ev, onOpen }: { v: Vendor; ev: EventPlan; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: v.id });
  const zones = ev.layouts.flatMap((l) => l.zones).filter((z) => v.zoneIds.includes(z.id));
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn("cursor-grab rounded-xl border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      <p className="truncate font-medium">
        {VENDOR_CATEGORIES[v.category].emoji} {v.name}
      </p>
      <p className="text-[11px] text-muted-foreground">{VENDOR_CATEGORIES[v.category].label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {v.quote > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{inrShort(v.quote)}</Badge>}
        {v.arrivalTime && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Arrive {formatTime(v.arrivalTime)}</Badge>}
        {zones.map((z) => (
          <Badge key={z.id} variant="outline" className="h-4 px-1.5 text-[10px]" style={{ borderColor: z.color, color: z.color }}>
            {z.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function VendorDialog({ ev, vendor, zones, onClose, onSave, onDelete }: { ev: EventPlan; vendor: Vendor | null; zones: EventPlan["layouts"][number]["zones"]; onClose: () => void; onSave: (v: Vendor) => void; onDelete: (id: string) => void }) {
  const [v, setV] = useState<Vendor | null>(vendor);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((vendor?.id ?? null) !== lastId) {
    setLastId(vendor?.id ?? null);
    setV(vendor);
    setDraft("");
  }
  if (!v) return <Dialog open={false} />;
  const exists = ev.vendors.some((x) => x.id === v.id);

  const draftMessage = async () => {
    setDrafting(true);
    setDraft("");
    const details = `Vendor: ${v.name || VENDOR_CATEGORIES[v.category].label} (${VENDOR_CATEGORIES[v.category].label}). ${v.setupNotes ? `Requirements: ${v.setupNotes}.` : ""} ${zones.filter((z) => v.zoneIds.includes(z.id)).map((z) => `Area: ${z.name}`).join(", ")}`;
    try {
      const { ok } = await streamFromRoute("/api/ai/write", { kind: "vendor-enquiry", details, tone: "warm and professional", language: "English", event: eventSummary(ev) }, setDraft);
      if (!ok) setDraft(offlineWrite("vendor-enquiry", ev, details));
    } catch {
      setDraft(offlineWrite("vendor-enquiry", ev, details));
    } finally {
      setDrafting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{exists ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Name</Label>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Annapoorna Caterers" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <NativeSelect value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as VendorCategory })}>
              {Object.entries(VENDOR_CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <NativeSelect value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as VendorStatus })}>
              {VENDOR_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quote (₹)</Label>
            <Input type="number" value={v.quote} onChange={(e) => setV({ ...v, quote: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Paid (₹)</Label>
            <Input type="number" value={v.paid} onChange={(e) => setV({ ...v, paid: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact</Label>
            <Input value={v.contact ?? ""} onChange={(e) => setV({ ...v, contact: e.target.value })} placeholder="Phone or email" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Arrival time on the day</Label>
            <Input type="time" value={v.arrivalTime ?? ""} onChange={(e) => setV({ ...v, arrivalTime: e.target.value || undefined })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setV({ ...v, rating: n })} aria-label={`${n} stars`}>
                  <Star className={cn("size-5", (v.rating ?? 0) >= n - 0.5 ? "fill-marigold text-marigold" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
          </div>
          {zones.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Works in these blueprint zones</Label>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => (
                  <label key={z.id} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
                    <Checkbox checked={v.zoneIds.includes(z.id)} onCheckedChange={(c) => setV({ ...v, zoneIds: c ? [...v.zoneIds, z.id] : v.zoneIds.filter((x) => x !== z.id) })} />
                    <span className="size-2 rounded-full" style={{ background: z.color }} /> {z.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Setup instructions</Label>
            <Textarea value={v.setupNotes ?? ""} onChange={(e) => setV({ ...v, setupNotes: e.target.value })} placeholder="Power points needed, load-in gate, setup deadline…" className="min-h-16" />
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5 text-primary" /> Draft an enquiry message
            </p>
            <Button size="xs" variant="outline" onClick={draftMessage} disabled={drafting} className="gap-1">
              {drafting ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} {draft ? "Rewrite" : "Write it"}
            </Button>
          </div>
          {draft && (
            <>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-2 min-h-32 bg-card text-sm" />
              <Button
                size="xs"
                variant="ghost"
                className="mt-1 gap-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy for WhatsApp / email"}
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {exists ? (
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => onDelete(v.id)}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => (v.name.trim() ? onSave(v) : toast.error("Vendor name is required"))}>Save vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
