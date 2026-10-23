"use client";

import { Check, Copy, Loader2, Sparkles, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { aiApi, eventSummary } from "@/lib/ai-client";
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from "@/lib/catalog/planning";
import { offlineWrite } from "@/lib/engine/offline";
import type { EventPlan, Vendor, VendorCategory, VendorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Add/edit a vendor, assign zones, and draft an AI enquiry message. */
export function VendorDialog({
  ev,
  vendor,
  zones,
  onClose,
  onSave,
  onDelete,
}: {
  ev: EventPlan;
  vendor: Vendor | null;
  zones: EventPlan["layouts"][number]["zones"];
  onClose: () => void;
  onSave: (v: Vendor) => void;
  onDelete: (id: string) => void;
}) {
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
    const categoryLabel = VENDOR_CATEGORIES[v.category].label;
    const requirements = v.setupNotes ? `Requirements: ${v.setupNotes}.` : "";
    const areas = zones
      .filter((z) => v.zoneIds.includes(z.id))
      .map((z) => `Area: ${z.name}`)
      .join(", ");
    const details = `Vendor: ${v.name || categoryLabel} (${categoryLabel}). ${requirements} ${areas}`;
    const full = await aiApi.write(
      { kind: "vendor-enquiry", details, tone: "warm and professional", language: "English", event: eventSummary(ev) },
      setDraft,
    );
    if (!full.trim()) setDraft(offlineWrite("vendor-enquiry", ev, details));
    setDrafting(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{exists ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Name</span>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Annapoorna Caterers" autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Category</span>
            <NativeSelect value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as VendorCategory })}>
              {Object.entries(VENDOR_CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Status</span>
            <NativeSelect value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as VendorStatus })}>
              {VENDOR_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Quote (₹)</span>
            <Input type="number" value={v.quote} onChange={(e) => setV({ ...v, quote: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Paid (₹)</span>
            <Input type="number" value={v.paid} onChange={(e) => setV({ ...v, paid: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Contact</span>
            <Input value={v.contact ?? ""} onChange={(e) => setV({ ...v, contact: e.target.value })} placeholder="Phone or email" />
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Arrival time on the day</span>
            <Input type="time" value={v.arrivalTime ?? ""} onChange={(e) => setV({ ...v, arrivalTime: e.target.value || undefined })} />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <p id="vendor-rating-label" className="text-sm text-xs font-medium">
              Rating
            </p>
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
              <p className="text-sm text-xs font-medium">Works in these blueprint zones</p>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => (
                  <label key={z.id} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
                    <Checkbox
                      checked={v.zoneIds.includes(z.id)}
                      onCheckedChange={(c) => setV({ ...v, zoneIds: c ? [...v.zoneIds, z.id] : v.zoneIds.filter((x) => x !== z.id) })}
                    />
                    <span className="size-2 rounded-full" style={{ background: z.color }} /> {z.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="block space-y-1 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm text-xs leading-none font-medium">Setup instructions</span>
            <Textarea
              value={v.setupNotes ?? ""}
              onChange={(e) => setV({ ...v, setupNotes: e.target.value })}
              placeholder="Power points needed, load-in gate, setup deadline…"
              className="min-h-16"
            />
          </label>
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
