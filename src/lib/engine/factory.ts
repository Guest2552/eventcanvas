import { nanoid } from "nanoid";
import { defaultPerPlate, DEFAULT_SPLIT } from "@/lib/catalog/planning";
import { getTemplate, suggestTemplate } from "@/lib/catalog/templates";
import type { BudgetCategory, EventPlan, EventType, Layout } from "@/lib/types";
import { allocationsFromSplit, shiftDate, toIsoDate } from "./costs";
import { autoLayout, defaultIntent, fixturesToElements, type LayoutIntent, sanitizeIntent } from "./layout";
import { generateSchedule, generateTasks } from "./planning";

export interface NewEventInput {
  name: string;
  type: EventType;
  date: string;
  startTime: string;
  city: string;
  guestCount: number;
  budgetTotal: number;
  theme: string;
  notes?: string;
  templateId?: string;
  intent?: Partial<LayoutIntent>;
  split?: Partial<Record<BudgetCategory, number>>;
  perPlate?: number;
}

export function buildLayout(opts: { templateId?: string; name?: string; guestCount: number; type: EventType; intent?: Partial<LayoutIntent> }): Layout {
  const template = opts.templateId ? getTemplate(opts.templateId) : suggestTemplate(opts.guestCount, opts.type);
  const venue = { ...template.venue };
  const fixtures = fixturesToElements(venue, template.fixtures);
  const intent = sanitizeIntent(opts.intent, defaultIntent(opts.type, opts.guestCount, venue.indoor));
  const { elements, zones } = autoLayout({ venue, fixtures, guestCount: opts.guestCount, intent });
  return { id: nanoid(8), name: opts.name ?? `Plan A · ${template.name}`, venue, elements, zones };
}

/** Normalises any percentage split so it sums to 100. */
export function normaliseSplit(split: Partial<Record<BudgetCategory, number>>) {
  const total = Object.values(split).reduce((s: number, v) => s + Math.max(0, v ?? 0), 0);
  if (total <= 0) return split;
  const out: Partial<Record<BudgetCategory, number>> = {};
  for (const [k, v] of Object.entries(split)) out[k as BudgetCategory] = (Math.max(0, v ?? 0) * 100) / total;
  return out;
}

export function createEventPlan(input: NewEventInput, today = new Date()): EventPlan {
  const guestCount = Math.max(1, Math.round(input.guestCount || 50));
  const layout = buildLayout({ templateId: input.templateId, guestCount, type: input.type, intent: input.intent });
  const budgetTotal = Math.max(10000, Math.round(input.budgetTotal || 300000));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : shiftDate(toIsoDate(today), 60);
  const now = new Date().toISOString();
  const ev: EventPlan = {
    id: nanoid(10),
    name: input.name.trim() || "My event",
    type: input.type,
    date,
    startTime: /^\d{2}:\d{2}$/.test(input.startTime) ? input.startTime : "18:00",
    city: input.city.trim() || "Chennai",
    guestCount,
    theme: input.theme,
    notes: input.notes ?? "",
    currency: "INR",
    layouts: [layout],
    activeLayoutId: layout.id,
    guests: [],
    vendors: [],
    budget: {
      total: budgetTotal,
      perPlate: input.perPlate && input.perPlate > 0 ? Math.round(input.perPlate) : defaultPerPlate(input.type, input.city),
      allocations: allocationsFromSplit(budgetTotal, normaliseSplit(input.split ?? DEFAULT_SPLIT[input.type])),
      lines: [],
    },
    tasks: generateTasks({ type: input.type, date }, today),
    schedule: [],
    bookings: [],
    booking: {
      enabled: input.type === "community",
      title: input.name,
      priceGeneral: input.type === "community" ? 200 : 0,
      priceVip: input.type === "community" ? 500 : 0,
      maxPerOrder: 6,
    },
    createdAt: now,
    updatedAt: now,
  };
  ev.schedule = generateSchedule(ev, layout);
  return ev;
}
