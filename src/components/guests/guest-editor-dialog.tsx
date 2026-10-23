"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DIET_LABELS } from "@/lib/guests";
import type { Dietary, Guest, Rsvp } from "@/lib/types";

interface GuestEditorDialogProps {
  /** The guest being edited, or null when closed */
  guest: Guest | null;
  isNew: boolean;
  /** Existing group names, offered as suggestions */
  groups: string[];
  onChange: (guest: Guest) => void;
  onClose: () => void;
  onSave: () => void;
}

const FLAGS = [
  { key: "vip", label: "VIP" },
  { key: "accessible", label: "Wheelchair" },
  { key: "child", label: "Child" },
] as const;

const fieldLabel = "flex items-center gap-2 text-xs leading-none font-medium";

export function GuestEditorDialog({ guest, isNew, groups, onChange, onClose, onSave }: GuestEditorDialogProps) {
  return (
    <Dialog open={!!guest} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add guest" : "Edit guest"}</DialogTitle>
        </DialogHeader>
        {guest && (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block space-y-1">
              <span className={fieldLabel}>Name</span>
              <Input value={guest.name} onChange={(e) => onChange({ ...guest, name: e.target.value })} autoFocus />
            </label>
            <label className="block space-y-1">
              <span className={fieldLabel}>Group / family</span>
              <Input list="guest-groups" value={guest.group} onChange={(e) => onChange({ ...guest, group: e.target.value })} />
              <datalist id="guest-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <label className="block space-y-1">
              <span className={fieldLabel}>Phone</span>
              <Input value={guest.phone ?? ""} onChange={(e) => onChange({ ...guest, phone: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className={fieldLabel}>Food</span>
              <NativeSelect value={guest.dietary} onChange={(e) => onChange({ ...guest, dietary: e.target.value as Dietary })}>
                {Object.entries(DIET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="block space-y-1">
              <span className={fieldLabel}>RSVP</span>
              <NativeSelect value={guest.rsvp} onChange={(e) => onChange({ ...guest, rsvp: e.target.value as Rsvp })}>
                <option value="pending">Pending</option>
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </NativeSelect>
            </label>
            <div className="col-span-2 flex flex-wrap gap-4 text-sm">
              {FLAGS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <Checkbox checked={guest[key]} onCheckedChange={(checked) => onChange({ ...guest, [key]: !!checked })} /> {label}
                </label>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onSave}>Save guest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
