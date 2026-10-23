"use client";

import { BellRing, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Due } from "@/lib/engine/costs";
import type { BudgetSuggestion } from "@/lib/engine/offline";
import { formatDate, inrShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-emerald-700",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

interface OptimizerCardProps {
  /** null until the host asks for suggestions */
  suggestions: BudgetSuggestion[] | null;
  sourceLabel: string;
  loading: boolean;
  onFind: () => void;
  onApply: (suggestion: BudgetSuggestion) => void;
}

/** AI-reviewed savings; suggestions with an `action` can be applied to the plan in one click. */
export function OptimizerCard({ suggestions, sourceLabel, loading, onFind, onApply }: OptimizerCardProps) {
  const total = suggestions?.reduce((sum, s) => sum + s.saving, 0) ?? 0;
  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-marigold/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> AI budget optimizer
        </p>
        <Button size="sm" onClick={onFind} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Find savings
        </Button>
      </div>
      {!suggestions && (
        <p className="mt-2 text-xs text-muted-foreground">
          Looks at your blueprint, guest count and vendor quotes to suggest cuts that won&apos;t hurt the experience. Some can be applied
          with one click.
        </p>
      )}
      {suggestions && (
        <div aria-live="polite">
          <p className="mt-1 text-[11px] text-muted-foreground">
            {sourceLabel} · up to {inrShort(total)} in savings
          </p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li key={s.id} className="rounded-lg border bg-card p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{s.title}</p>
                  <Badge className="shrink-0 bg-emerald-600 text-white">−{inrShort(s.saving)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                {s.action && (
                  <Button size="xs" variant="outline" className="mt-2" onClick={() => onApply(s)}>
                    Apply to plan
                  </Button>
                )}
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="text-xs text-muted-foreground">Your plan is already lean. Nothing obvious to cut.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Upcoming balances from expenses and booked vendors, overdue ones flagged. */
export function PaymentReminders({ dues, onMarkPaid }: { dues: Due[]; onMarkPaid: (due: Due) => void }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <BellRing className="size-4 text-primary" /> Payment reminders
      </p>
      <ul className="space-y-1.5">
        {dues.slice(0, 6).map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="font-medium tabular-nums">{inrShort(d.amount)}</span>
            <Badge variant={d.overdue ? "destructive" : "outline"} className="text-[10px]">
              {d.overdue ? "Overdue" : formatDate(d.dueDate, { day: "numeric", month: "short" })}
            </Badge>
            <Button size="xs" variant="ghost" onClick={() => onMarkPaid(d)}>
              Mark paid
            </Button>
          </li>
        ))}
        {dues.length === 0 && <li className="text-xs text-muted-foreground">No pending payments with due dates.</li>}
      </ul>
    </div>
  );
}
