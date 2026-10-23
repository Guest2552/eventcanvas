"use client";

import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface SmartSeatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: string;
  onRulesChange: (rules: string) => void;
  /** Summary lines from the last run; empty before the first run */
  notes: string[];
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
}

/** Plain-language seating rules plus a one-tap "seat everyone". */
export function SmartSeatingDialog({ open, onOpenChange, rules, onRulesChange, notes, busy, disabled, onRun }: SmartSeatingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" /> Smart seating
          </DialogTitle>
          <DialogDescription>
            Families stay together, VIPs sit nearest the stage, wheelchair users near doors and kids near the kids zone. Add your own rules
            in plain words.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={rules}
          onChange={(e) => onRulesChange(e.target.value)}
          placeholder="e.g. Keep Ravi Pillai and Suresh Nair apart. Seat the Temple committee near the stage. Put Priya's college friends together."
          className="min-h-24"
          aria-label="Seating rules"
        />
        {notes.length > 0 && (
          <ul className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs" aria-live="polite">
            {notes.map((n) => (
              <li key={n}>✓ {n}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={onRun} disabled={busy || disabled} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}{" "}
            {notes.length ? "Re-run seating" : "Seat everyone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
