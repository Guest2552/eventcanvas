/**
 * Client-side execution of the AI co-planner's tools against the local plan,
 * plus the compact plan snapshot the model sees on every turn.
 */
import { nanoid } from "nanoid";
import { addElement, moveElement, removeElements, resolveElements, resolveKind, swapElements } from "@/lib/actions";
import { getDef } from "@/lib/catalog/elements";
import { activeLayout, budgetSummary, daysUntil } from "@/lib/engine/costs";
import { totalSeats } from "@/lib/engine/geometry";
import { autoLayout, defaultIntent, type LayoutIntent, sanitizeIntent } from "@/lib/engine/layout";
import { vendorChecklist } from "@/lib/engine/planning";
import { autoSeat } from "@/lib/engine/seating";
import { validateLayout } from "@/lib/engine/validation";
import { inr } from "@/lib/format";
import { draftLayout, updateEvent, useStore } from "@/lib/store";
import type { BudgetCategory, EventPlan, VendorCategory, VendorStatus } from "@/lib/types";

export function buildPlanContext(ev: EventPlan) {
  const layout = activeLayout(ev);
  const v = validateLayout(ev, layout);
  const b = budgetSummary(ev);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");
  const groups = new Map<string, number>();
  for (const g of attending) groups.set(g.group || "Ungrouped", (groups.get(g.group || "Ungrouped") ?? 0) + 1);
  return {
    event: { name: ev.name, type: ev.type, date: ev.date, daysToGo: daysUntil(ev.date), startTime: ev.startTime, city: ev.city, theme: ev.theme, notes: ev.notes.slice(0, 300) },
    guests: {
      invited: ev.guests.length || ev.guestCount,
      attending: attending.length,
      pendingRsvp: ev.guests.filter((g) => g.rsvp === "pending" || g.rsvp === "maybe").length,
      unseated: attending.filter((g) => !g.seatId).length,
      vip: attending.filter((g) => g.vip).length,
      wheelchair: attending.filter((g) => g.accessible).length,
      kids: attending.filter((g) => g.child).length,
      veg: attending.filter((g) => g.dietary !== "non-veg").length,
      groups: [...groups.entries()].slice(0, 20).map(([g, n]) => `${g} (${n})`),
    },
    budget: {
      total: b.total,
      committed: b.committed,
      paid: b.paid,
      overBy: b.overBy,
      perGuest: b.perHead,
      perPlate: ev.budget.perPlate,
      categories: b.categories.filter((c) => c.allocated || c.committed).map((c) => `${c.category}: planned ${c.allocated}, committed ${c.committed}`),
    },
    layout: {
      version: layout.name,
      otherVersions: ev.layouts.filter((l) => l.id !== layout.id).map((l) => l.name),
      venue: `${layout.venue.name} ${layout.venue.widthFt}x${layout.venue.lengthFt} ft ${layout.venue.indoor ? "indoor" : "outdoor"}`,
      seats: totalSeats(layout),
      safetyScore: v.score,
      issues: v.issues.map((i) => `${i.severity}: ${i.title}`),
      zones: layout.zones.map((z) => `${z.name} (${z.kind})`),
      // Compact "label=kind@x,y" keeps each request well under Groq's free-tier token budget
      items: layout.elements.map((e) => (e.label.toLowerCase().replace(/\s+/g, "-").startsWith(e.kind) ? `${e.label}@${Math.round(e.x)},${Math.round(e.y)}` : `${e.label}=${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`)).join("; "),
    },
    vendors: ev.vendors.map((x) => `${x.name} | ${x.category} | ${x.status} | quote ${x.quote}`),
    missingVendors: vendorChecklist(ev, layout)
      .filter((c) => c.status === "missing")
      .map((c) => c.label),
    nextTasks: ev.tasks
      .filter((t) => !t.done)
      .sort((a, c) => a.dueDate.localeCompare(c.dueDate))
      .slice(0, 8)
      .map((t) => `${t.dueDate} ${t.title}`),
    runOfShow: ev.schedule.map((s) => `${s.time} ${s.title}`).join("; "),
  };
}

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function afterLayout(eventId: string) {
  const ev = useStore.getState().events[eventId];
  if (!ev) return "";
  const v = validateLayout(ev, activeLayout(ev));
  return ` Safety score is now ${v.score}/100${v.issues.length ? ` (${v.issues.length} notes)` : ""}.`;
}

export function runAssistantTool(eventId: string, name: string, input: Input): string {
  const ev = useStore.getState().events[eventId];
  if (!ev) return "Event not found.";
  const layout = activeLayout(ev);

  switch (name) {
    case "add_items": {
      const kind = resolveKind(str(input.kind) ?? "") ?? str(input.kind) ?? "";
      const count = Math.max(1, Math.min(30, Math.round(num(input.count) ?? 1)));
      const added: string[] = [];
      updateEvent(eventId, (d) => {
        for (let i = 0; i < count; i++) {
          const el = addElement(d, kind, { near: str(input.near) });
          if (el) added.push(el.label);
        }
      });
      if (!added.length) return `Could not find free space for a ${getDef(kind).label}.`;
      return `Added ${added.length} × ${getDef(kind).label} (${added.join(", ")})${input.near ? ` near ${input.near}` : ""}.${afterLayout(eventId)}`;
    }
    case "move_item": {
      let res: ReturnType<typeof moveElement> = null;
      updateEvent(eventId, (d) => {
        res = moveElement(d, str(input.target) ?? "", { near: str(input.near), awayFrom: str(input.awayFrom) });
      });
      const r = res as ReturnType<typeof moveElement>;
      if (!r) {
        const target = resolveElements(layout, str(input.target) ?? "")[0];
        return target
          ? `There's no free space big enough for ${target.label} (${target.w}×${target.h} ft) there. Try swap_items to trade places with another item, or remove something first.`
          : `No item matching "${input.target}" on the blueprint.`;
      }
      return `Moved ${r.moved.label} ${r.distance} ft ${input.awayFrom ? `away from ${input.awayFrom}` : `next to ${input.near}`}.${afterLayout(eventId)}`;
    }
    case "swap_items": {
      let res: ReturnType<typeof swapElements> = null;
      updateEvent(eventId, (d) => {
        res = swapElements(d, str(input.first) ?? "", str(input.second) ?? "");
      });
      const r = res as ReturnType<typeof swapElements>;
      if (!r) return `Couldn't find both "${input.first}" and "${input.second}" on the blueprint.`;
      return `Swapped ${r.a.label} and ${r.b.label}.${afterLayout(eventId)}`;
    }
    case "remove_items": {
      const matches = resolveElements(layout, str(input.target) ?? "");
      const n = num(input.count);
      const ids = (n ? matches.slice(0, n) : matches).map((e) => e.id);
      if (!ids.length) return `Nothing matching "${input.target}" on the blueprint.`;
      updateEvent(eventId, (d) => removeElements(d, ids));
      return `Removed ${ids.length} item(s): ${matches.slice(0, ids.length).map((e) => e.label).join(", ")}.${afterLayout(eventId)}`;
    }
    case "auto_layout": {
      const fixtures = layout.elements.filter((e) => ["entry", "exit", "restroom", "kitchen", "pillar", "wall"].includes(e.kind));
      const current = [...new Set(layout.elements.map((e) => e.kind))];
      const base = defaultIntent(ev.type, ev.guests.filter((g) => g.rsvp !== "no").length || ev.guestCount, layout.venue.indoor);
      const requested = Array.isArray(input.include) ? (input.include as string[]).map((k) => resolveKind(k) ?? k) : current;
      const intent: LayoutIntent = sanitizeIntent({ tableKind: (str(input.tableKind) as LayoutIntent["tableKind"]) ?? base.tableKind, include: requested, vipRows: base.vipRows }, base);
      const result = autoLayout({ venue: layout.venue, fixtures, guestCount: ev.guests.filter((g) => g.rsvp !== "no").length || ev.guestCount, intent });
      const asNew = input.asNewVersion !== false;
      const id = asNew ? nanoid(8) : layout.id;
      updateEvent(eventId, (d) => {
        const l = { id, name: asNew ? `Plan ${String.fromCharCode(65 + d.layouts.length)} · AI layout` : layout.name, venue: { ...layout.venue }, elements: result.elements, zones: result.zones };
        if (asNew) {
          d.layouts.push(l);
          d.activeLayoutId = id;
        } else d.layouts[d.layouts.findIndex((x) => x.id === id)] = l;
      });
      return `Generated a layout with ${result.seats} seats${asNew ? " as a new version" : ""}${result.dropped.length ? `; skipped ${result.dropped.join(", ")} to fit everyone` : ""}.${afterLayout(eventId)}`;
    }
    case "auto_seat": {
      const r = autoSeat(ev, layout);
      updateEvent(eventId, (d) => {
        for (const g of d.guests) g.seatId = r.assignments[g.id];
      });
      return r.notes.join(" ");
    }
    case "update_event": {
      const changed: string[] = [];
      updateEvent(eventId, (d) => {
        for (const k of ["name", "date", "startTime", "city", "theme"] as const) {
          const v = str(input[k]);
          if (v) (d[k] = v), changed.push(k);
        }
        const gc = num(input.guestCount);
        if (gc) (d.guestCount = Math.round(gc)), changed.push("guest count");
        const bt = num(input.budgetTotal);
        if (bt) (d.budget.total = Math.round(bt)), changed.push("budget");
        const pp = num(input.perPlate);
        if (pp) (d.budget.perPlate = Math.round(pp)), changed.push("per-plate cost");
      });
      return changed.length ? `Updated ${changed.join(", ")}.` : "Nothing to update.";
    }
    case "set_allocation": {
      const c = str(input.category) as BudgetCategory;
      const amt = Math.max(0, Math.round(num(input.amount) ?? 0));
      updateEvent(eventId, (d) => void (d.budget.allocations[c] = amt));
      return `Set ${c} budget to ${inr(amt)}.`;
    }
    case "add_expense": {
      const amt = Math.max(0, Math.round(num(input.amount) ?? 0));
      updateEvent(eventId, (d) => void d.budget.lines.push({ id: nanoid(8), category: (str(input.category) as BudgetCategory) ?? "misc", label: str(input.label) ?? "Expense", estimated: amt, actual: 0, paid: 0, dueDate: str(input.dueDate) }));
      return `Added expense "${input.label}" for ${inr(amt)}.`;
    }
    case "add_vendor": {
      updateEvent(eventId, (d) =>
        void d.vendors.push({ id: nanoid(8), category: (str(input.category) as VendorCategory) ?? "decor", name: str(input.name) ?? "New vendor", status: (str(input.status) as VendorStatus) ?? "todo", quote: Math.round(num(input.quote) ?? 0), paid: 0, zoneIds: [] }),
      );
      return `Added vendor ${input.name}.`;
    }
    case "add_task": {
      updateEvent(eventId, (d) => void d.tasks.push({ id: nanoid(8), title: str(input.title) ?? "Task", dueDate: str(input.dueDate) ?? d.date, phase: "Details & invites", done: false }));
      return `Added task "${input.title}" due ${input.dueDate}.`;
    }
    case "add_schedule_item": {
      const location = str(input.location);
      const elementKind = location ? (resolveKind(location) ?? resolveElements(layout, location)[0]?.kind) : undefined;
      updateEvent(eventId, (d) => void d.schedule.push({ id: nanoid(8), time: str(input.time) ?? d.startTime, title: str(input.title) ?? "Moment", durationMin: Math.round(num(input.durationMin) ?? 30), elementKind, vendorIds: [] }));
      return `Added "${input.title}" at ${input.time} to the run of show.`;
    }
    default:
      return `Unknown tool ${name}.`;
  }
}

export function toolLabel(name: string) {
  return (
    {
      add_items: "Adding to blueprint",
      move_item: "Moving item",
      swap_items: "Swapping items",
      remove_items: "Removing items",
      auto_layout: "Generating layout",
      auto_seat: "Seating guests",
      update_event: "Updating event",
      set_allocation: "Updating budget",
      add_expense: "Adding expense",
      add_vendor: "Adding vendor",
      add_task: "Adding task",
      add_schedule_item: "Updating run of show",
    }[name] ?? name
  );
}
