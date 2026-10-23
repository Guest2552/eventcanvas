"use client";

import { ChevronDown, Link2, Plus, Trash2, Wand2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { applySuggestion, markDuePaid } from "@/lib/actions";
import { Kpi, OptimizerCard, PaymentReminders } from "@/components/budget/budget-cards";
import { BUDGET_CATEGORIES, DEFAULT_SPLIT, VENDOR_CATEGORIES, VENDOR_STATUSES } from "@/lib/catalog/planning";
import { allocationsFromSplit, budgetSummary } from "@/lib/engine/costs";
import { aiApi } from "@/lib/ai-client";
import { type BudgetSuggestion, offlineOptimize } from "@/lib/engine/offline";
import { inr, inrShort } from "@/lib/format";
import type { BudgetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const chartFallback = () => <div className="h-64 animate-pulse rounded-xl bg-muted/50" />;
const PlannedVsCommittedChart = dynamic(() => import("@/components/event/budget-charts").then((m) => m.PlannedVsCommittedChart), {
  ssr: false,
  loading: chartFallback,
});
const SpendDonut = dynamic(() => import("@/components/event/budget-charts").then((m) => m.SpendDonut), {
  ssr: false,
  loading: chartFallback,
});

export default function BudgetPage() {
  const { ev, update } = useCurrentEvent();
  const summary = useMemo(() => (ev ? budgetSummary(ev) : null), [ev]);
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[] | null>(null);
  const [aiSource, setAiSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRentals, setShowRentals] = useState(false);
  if (!ev || !summary) return null;

  const cats = summary.categories.filter((c) => c.allocated > 0 || c.committed > 0);
  const chartData = cats.map((c) => ({
    name: c.label.replace(" (from blueprint)", ""),
    Planned: c.allocated,
    Committed: c.committed,
    color: c.color,
  }));
  const allocatedTotal = summary.categories.reduce((s, c) => s + c.allocated, 0);

  const optimize = async () => {
    setLoading(true);
    const baseline = offlineOptimize(ev, summary);
    const data = await aiApi.optimize({
      event: {
        name: ev.name,
        type: ev.type,
        city: ev.city,
        guests: summary.catering.guests,
        theme: ev.theme,
        perPlate: ev.budget.perPlate,
      },
      budget: {
        total: summary.total,
        committed: summary.committed,
        overBy: summary.overBy,
        categories: summary.categories.map((c) => ({ category: c.category, allocated: c.allocated, committed: c.committed })),
      },
      baseline,
    });
    setSuggestions(data?.suggestions ?? baseline);
    setAiSource(data?.source === "ai" ? "AI-reviewed for your event" : "Built-in optimizer (AI offline)");
    setLoading(false);
  };

  const apply = (s: BudgetSuggestion) => {
    update((d) => void applySuggestion(d, s));
    setSuggestions((list) => list?.filter((x) => x.id !== s.id) ?? null);
    toast.success(`Applied: ${s.title}. Budget updated.`);
  };

  const setLine = (id: string, patch: Record<string, unknown>, field: string) =>
    update(
      (d) =>
        void Object.assign(
          d.budget.lines.find((l) => l.id === id)!,
          patch,
        ),
      { coalesce: `line-${id}-${field}` },
    );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Total budget (₹)</p>
          <Input
            type="number"
            step={10000}
            value={ev.budget.total}
            onChange={(e) => update((d) => void (d.budget.total = Math.max(0, Number(e.target.value))), { coalesce: "budget-total" })}
            className="mt-1 h-8 font-semibold"
          />
        </div>
        <Kpi
          label="Committed"
          value={inrShort(summary.committed)}
          sub={`${Math.round((summary.committed / Math.max(1, summary.total)) * 100)}% of budget`}
        />
        <Kpi
          label="Paid so far"
          value={inrShort(summary.paid)}
          sub={`${inrShort(Math.max(0, summary.committed - summary.paid))} still to pay`}
        />
        <Kpi
          label={summary.overBy ? "Over budget" : "Remaining"}
          value={inrShort(summary.overBy || summary.remaining)}
          tone={summary.overBy ? "bad" : "good"}
          sub={summary.overBy ? "Try the optimizer →" : "Unallocated headroom"}
        />
        <Kpi label="Cost per guest" value={inr(summary.perHead)} sub={`${summary.catering.guests} expected guests`} />
        <div className="rounded-xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">Catering per plate (₹)</p>
          <Input
            type="number"
            step={10}
            value={ev.budget.perPlate}
            onChange={(e) => update((d) => void (d.budget.perPlate = Math.max(0, Number(e.target.value))), { coalesce: "per-plate" })}
            className="mt-1 h-8 font-semibold"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Planned vs committed</p>
              <p className="text-xs text-muted-foreground">
                Allocated {inrShort(allocatedTotal)} of {inrShort(summary.total)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                update((d) => void (d.budget.allocations = allocationsFromSplit(d.budget.total, DEFAULT_SPLIT[d.type])));
                toast.success(`Applied a typical ${ev.type} split for ${ev.city}`);
              }}
            >
              <Wand2 className="size-3.5" /> Smart split
            </Button>
          </div>
          <PlannedVsCommittedChart data={chartData} />
        </div>

        <div className="space-y-4">
          <OptimizerCard suggestions={suggestions} sourceLabel={aiSource} loading={loading} onFind={optimize} onApply={apply} />
          <PaymentReminders dues={summary.dues} onMarkPaid={(due) => update((d) => markDuePaid(d, due))} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Categories</p>
          <p className="text-xs text-muted-foreground">
            Allocations are editable. Committed spend comes from vendors, your expenses and the blueprint.
          </p>
        </div>
        <div className="divide-y">
          {summary.categories.map((c) => {
            const pct = c.allocated ? (c.committed / c.allocated) * 100 : c.committed ? 100 : 0;
            return (
              <div key={c.category} className="grid items-center gap-2 px-4 py-2.5 sm:grid-cols-[1.4fr_120px_1fr_90px_90px]">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm font-medium">{c.label}</span>
                  {c.category === "rentals" && (
                    <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
                      <Link2 className="size-2.5" /> live
                    </Badge>
                  )}
                </div>
                <Input
                  type="number"
                  step={5000}
                  value={c.allocated}
                  onChange={(e) =>
                    update((d) => void (d.budget.allocations[c.category] = Math.max(0, Number(e.target.value))), {
                      coalesce: `alloc-${c.category}`,
                    })
                  }
                  className="h-7 text-sm"
                  aria-label={`${c.label} allocation`}
                />
                <Progress value={Math.min(100, pct)} className={cn(pct > 100 && "[&_[data-slot=progress-indicator]]:bg-destructive")} />
                <span className={cn("text-right text-sm tabular-nums", pct > 100 && "font-semibold text-destructive")}>
                  {inrShort(c.committed)}
                </span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">paid {inrShort(c.paid)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Expenses</p>
            <p className="text-xs text-muted-foreground">Auto lines update when you change the blueprint or guest list.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              update(
                (d) =>
                  void d.budget.lines.push({ id: nanoid(8), category: "misc", label: "New expense", estimated: 0, actual: 0, paid: 0 }),
              )
            }
          >
            <Plus className="size-3.5" /> Expense
          </Button>
        </div>
        <div className="divide-y text-sm">
          <button className="flex w-full items-center gap-2 bg-muted/30 px-4 py-2.5 text-left" onClick={() => setShowRentals((s) => !s)}>
            <ChevronDown className={cn("size-4 transition", !showRentals && "-rotate-90")} />
            <span className="flex-1 font-medium">
              🧩 Rentals from blueprint ({summary.rentals.lines.reduce((n, l) => n + l.count, 0)} items)
            </span>
            <span className="font-semibold tabular-nums">{inr(summary.rentals.total)}</span>
          </button>
          {showRentals &&
            summary.rentals.lines.map((l) => (
              <div key={l.kind} className="flex items-center gap-2 px-10 py-1.5 text-xs text-muted-foreground">
                <span className="flex-1">
                  {l.emoji} {l.label} × {l.count} @ {inr(l.unit)}
                </span>
                <span className="tabular-nums">{inr(l.total)}</span>
              </div>
            ))}
          <div className="flex items-center gap-2 bg-muted/30 px-4 py-2.5">
            <span className="w-4" />
            <span className="flex-1 font-medium">
              🍛 Catering estimate: {summary.catering.guests} guests × {inr(summary.catering.perPlate)}
              {!summary.cateringFromEstimate && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(replaced by your caterer&apos;s quote)</span>
              )}
            </span>
            <span className={cn("font-semibold tabular-nums", !summary.cateringFromEstimate && "text-muted-foreground line-through")}>
              {inr(summary.catering.total)}
            </span>
          </div>
          {ev.vendors
            .filter((v) => v.quote > 0)
            .map((v) => (
              <div key={v.id} className="flex items-center gap-2 px-4 py-2">
                <span className="w-4" />
                <span className="flex-1">
                  {VENDOR_CATEGORIES[v.category].emoji} {v.name}{" "}
                  <span className="text-xs text-muted-foreground">· {VENDOR_STATUSES.find((s) => s.id === v.status)?.label}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">paid {inrShort(v.paid)}</span>
                <span className="w-24 text-right font-medium tabular-nums">{inr(v.quote)}</span>
              </div>
            ))}
          {ev.budget.lines.map((l) => (
            <div key={l.id} className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_150px_100px_100px_100px_130px_32px]">
              <Input
                value={l.label}
                onChange={(e) => setLine(l.id, { label: e.target.value }, "label")}
                className="h-7"
                aria-label="Expense name"
              />
              <NativeSelect
                value={l.category}
                onChange={(e) => setLine(l.id, { category: e.target.value as BudgetCategory }, "cat")}
                aria-label="Category"
              >
                {Object.entries(BUDGET_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="number"
                value={l.estimated}
                onChange={(e) => setLine(l.id, { estimated: Number(e.target.value) }, "est")}
                className="h-7"
                aria-label="Estimated"
                title="Estimated"
              />
              <Input
                type="number"
                value={l.actual}
                onChange={(e) => setLine(l.id, { actual: Number(e.target.value) }, "act")}
                className="h-7"
                aria-label="Actual"
                title="Actual"
              />
              <Input
                type="number"
                value={l.paid}
                onChange={(e) => setLine(l.id, { paid: Number(e.target.value) }, "paid")}
                className="h-7"
                aria-label="Paid"
                title="Paid"
              />
              <Input
                type="date"
                value={l.dueDate ?? ""}
                onChange={(e) => setLine(l.id, { dueDate: e.target.value || undefined }, "due")}
                className="h-7"
                aria-label="Due date"
                title="Due date"
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => update((d) => void (d.budget.lines = d.budget.lines.filter((x) => x.id !== l.id)))}
                aria-label="Delete expense"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {ev.budget.lines.length > 0 && (
            <p className="px-4 py-1.5 text-[11px] text-muted-foreground">Columns: name · category · estimated · actual · paid · due date</p>
          )}
        </div>
      </section>

      {cats.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Where the money goes</p>
          <SpendDonut data={cats} />
        </section>
      )}
    </div>
  );
}
