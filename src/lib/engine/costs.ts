import { ELEMENTS, getDef } from "@/lib/catalog/elements";
import { BOOKED_STATUSES, BUDGET_CATEGORIES, COMMITTED_STATUSES, tierMultiplier, VENDOR_CATEGORIES } from "@/lib/catalog/planning";
import type { BudgetCategory, EventPlan, Layout } from "@/lib/types";

export function activeLayout(ev: EventPlan): Layout {
  return ev.layouts.find((l) => l.id === ev.activeLayoutId) ?? ev.layouts[0];
}

export function unitCost(kind: string, city: string) {
  return Math.round(getDef(kind).cost * tierMultiplier(city));
}

export interface CostLine {
  kind: string;
  label: string;
  emoji: string;
  count: number;
  unit: number;
  total: number;
}

export function blueprintCosts(layout: Layout, city: string): { total: number; lines: CostLine[] } {
  const counts = new Map<string, number>();
  for (const el of layout.elements) counts.set(el.kind, (counts.get(el.kind) ?? 0) + 1);
  const lines: CostLine[] = [];
  for (const def of ELEMENTS) {
    const count = counts.get(def.kind);
    if (!count || def.cost === 0) continue;
    const unit = unitCost(def.kind, city);
    lines.push({ kind: def.kind, label: def.label, emoji: def.emoji, count, unit, total: unit * count });
  }
  lines.sort((a, b) => b.total - a.total);
  return { total: lines.reduce((s, l) => s + l.total, 0), lines };
}

/** Guests we expect to feed: everyone who hasn't declined, or the planned head-count if no list yet. */
export function expectedGuests(ev: EventPlan) {
  if (ev.guests.length === 0) return ev.guestCount;
  return ev.guests.filter((g) => g.rsvp !== "no").length;
}

export function cateringEstimate(ev: EventPlan) {
  const guests = expectedGuests(ev);
  return { guests, perPlate: ev.budget.perPlate, total: guests * ev.budget.perPlate };
}

export interface CategorySummary {
  category: BudgetCategory;
  label: string;
  color: string;
  allocated: number;
  committed: number;
  actual: number;
  paid: number;
}

export interface Due {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  overdue: boolean;
  source: "line" | "vendor";
}

export function budgetSummary(ev: EventPlan, today = new Date()) {
  const cats = Object.keys(BUDGET_CATEGORIES) as BudgetCategory[];
  const map = new Map<BudgetCategory, CategorySummary>(
    cats.map((c) => [
      c,
      {
        category: c,
        label: BUDGET_CATEGORIES[c].label,
        color: BUDGET_CATEGORIES[c].color,
        allocated: ev.budget.allocations[c] ?? 0,
        committed: 0,
        actual: 0,
        paid: 0,
      },
    ]),
  );

  for (const line of ev.budget.lines) {
    const s = map.get(line.category)!;
    s.committed += Math.max(line.estimated, line.actual);
    s.actual += line.actual;
    s.paid += line.paid;
  }

  let cateringVendorQuote = 0;
  for (const v of ev.vendors) {
    const cat = VENDOR_CATEGORIES[v.category].budget;
    const s = map.get(cat)!;
    if (COMMITTED_STATUSES.includes(v.status)) s.committed += v.quote;
    if (BOOKED_STATUSES.includes(v.status)) s.actual += v.quote;
    s.paid += v.paid;
    if (v.category === "catering" && COMMITTED_STATUSES.includes(v.status)) cateringVendorQuote += v.quote;
  }

  const rentals = blueprintCosts(activeLayout(ev), ev.city);
  map.get("rentals")!.committed += rentals.total;

  const catering = cateringEstimate(ev);
  const cateringFromEstimate = cateringVendorQuote === 0;
  if (cateringFromEstimate) map.get("catering")!.committed += catering.total;

  const categories = [...map.values()];
  const committed = categories.reduce((s, c) => s + c.committed, 0);
  const actual = categories.reduce((s, c) => s + c.actual, 0);
  const paid = categories.reduce((s, c) => s + c.paid, 0);
  const guests = Math.max(1, expectedGuests(ev));

  const dues: Due[] = [];
  const todayIso = today.toISOString().slice(0, 10);
  for (const line of ev.budget.lines) {
    const owed = Math.max(line.estimated, line.actual) - line.paid;
    if (line.dueDate && owed > 0)
      dues.push({ id: line.id, label: line.label, amount: owed, dueDate: line.dueDate, overdue: line.dueDate < todayIso, source: "line" });
  }
  const vendorDue = shiftDate(ev.date, -7);
  for (const v of ev.vendors) {
    const owed = v.quote - v.paid;
    if (BOOKED_STATUSES.includes(v.status) && owed > 0)
      dues.push({
        id: v.id,
        label: `${v.name} (balance)`,
        amount: owed,
        dueDate: vendorDue,
        overdue: vendorDue < todayIso,
        source: "vendor",
      });
  }
  dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    categories,
    total: ev.budget.total,
    committed,
    actual,
    paid,
    remaining: ev.budget.total - committed,
    overBy: Math.max(0, committed - ev.budget.total),
    perHead: Math.round(committed / guests),
    rentals,
    catering,
    cateringFromEstimate,
    dues,
  };
}

export type BudgetSummary = ReturnType<typeof budgetSummary>;

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysUntil(iso: string, today = new Date()) {
  const a = new Date(`${iso}T00:00:00`).getTime();
  const b = new Date(`${toIsoDate(today)}T00:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Converts percentage split into rupee allocations. */
export function allocationsFromSplit(total: number, split: Partial<Record<BudgetCategory, number>>) {
  const out: Partial<Record<BudgetCategory, number>> = {};
  for (const [k, pct] of Object.entries(split)) out[k as BudgetCategory] = Math.round((total * (pct ?? 0)) / 100 / 1000) * 1000;
  return out;
}
