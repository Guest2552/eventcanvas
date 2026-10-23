/**
 * Browser side of the AI co-planner: the compact plan snapshot the model sees each turn,
 * and one small handler per tool that applies the model's request to the local plan.
 */
import { nanoid } from "nanoid";
import { addElement, moveElement, removeElements, resolveElements, resolveKind, swapElements } from "@/lib/actions";
import { type ChatToolInput, type ChatToolName, isChatToolName, toolInputSchemas, toolLabels } from "@/lib/ai/chat-tools";
import { getDef, isFixture } from "@/lib/catalog/elements";
import { activeLayout, budgetSummary, daysUntil } from "@/lib/engine/costs";
import { totalSeats } from "@/lib/engine/geometry";
import { autoLayout, defaultIntent, type LayoutIntent, sanitizeIntent } from "@/lib/engine/layout";
import { vendorChecklist } from "@/lib/engine/planning";
import { autoSeat } from "@/lib/engine/seating";
import { validateLayout } from "@/lib/engine/validation";
import { inr } from "@/lib/format";
import { updateEvent, updateEventAndReturn, useStore } from "@/lib/store";
import type { EventPlan, Layout } from "@/lib/types";

const MAX_ITEMS_PER_CALL = 30;

/** "label=kind@x,y" per item (kind omitted when the label already says it) keeps requests under Groq's token budget. */
function compactItems(layout: Layout) {
  return layout.elements
    .map((e) => {
      const at = `@${Math.round(e.x)},${Math.round(e.y)}`;
      const labelSaysKind = e.label.toLowerCase().replace(/\s+/g, "-").startsWith(e.kind);
      return labelSaysKind ? `${e.label}${at}` : `${e.label}=${e.kind}${at}`;
    })
    .join("; ");
}

export function buildPlanContext(ev: EventPlan) {
  const layout = activeLayout(ev);
  const validation = validateLayout(ev, layout);
  const budget = budgetSummary(ev);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");
  const groups = new Map<string, number>();
  for (const g of attending) groups.set(g.group || "Ungrouped", (groups.get(g.group || "Ungrouped") ?? 0) + 1);

  return {
    event: {
      name: ev.name,
      type: ev.type,
      date: ev.date,
      daysToGo: daysUntil(ev.date),
      startTime: ev.startTime,
      city: ev.city,
      theme: ev.theme,
      notes: ev.notes.slice(0, 300),
    },
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
      total: budget.total,
      committed: budget.committed,
      paid: budget.paid,
      overBy: budget.overBy,
      perGuest: budget.perHead,
      perPlate: ev.budget.perPlate,
      categories: budget.categories
        .filter((c) => c.allocated || c.committed)
        .map((c) => `${c.category}: planned ${c.allocated}, committed ${c.committed}`),
    },
    layout: {
      version: layout.name,
      otherVersions: ev.layouts.filter((l) => l.id !== layout.id).map((l) => l.name),
      venue: `${layout.venue.name} ${layout.venue.widthFt}x${layout.venue.lengthFt} ft ${layout.venue.indoor ? "indoor" : "outdoor"}`,
      seats: totalSeats(layout),
      safetyScore: validation.score,
      issues: validation.issues.map((i) => `${i.severity}: ${i.title}`),
      zones: layout.zones.map((z) => `${z.name} (${z.kind})`),
      items: compactItems(layout),
    },
    vendors: ev.vendors.map((v) => `${v.name} | ${v.category} | ${v.status} | quote ${v.quote}`),
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

interface ToolContext {
  eventId: string;
  ev: EventPlan;
  layout: Layout;
}

type Handler<N extends ChatToolName> = (input: ChatToolInput<N>, ctx: ToolContext) => string;

/** Appended to layout changes so the model can tell the host whether the room is still safe. */
function safetyNote(eventId: string) {
  const ev = useStore.getState().events[eventId];
  if (!ev) return "";
  const v = validateLayout(ev, activeLayout(ev));
  return ` Safety score is now ${v.score}/100${v.issues.length ? ` (${v.issues.length} notes)` : ""}.`;
}

const handlers: { [N in ChatToolName]: Handler<N> } = {
  add_items: ({ kind, count, near }, { eventId }) => {
    const resolved = resolveKind(kind) ?? kind;
    const n = Math.max(1, Math.min(MAX_ITEMS_PER_CALL, Math.round(count)));
    const added =
      updateEventAndReturn(eventId, (d) => {
        const labels: string[] = [];
        for (let i = 0; i < n; i++) {
          const el = addElement(d, resolved, { near });
          if (el) labels.push(el.label);
        }
        return labels;
      }) ?? [];
    const label = getDef(resolved).label;
    if (!added.length) return `Could not find free space for a ${label}.`;
    return `Added ${added.length} × ${label} (${added.join(", ")})${near ? ` near ${near}` : ""}.${safetyNote(eventId)}`;
  },

  move_item: ({ target, near, awayFrom }, { eventId, layout }) => {
    const moved = updateEventAndReturn(eventId, (d) => moveElement(d, target, { near, awayFrom }));
    if (!moved) {
      const el = resolveElements(layout, target)[0];
      return el
        ? `There's no free space big enough for ${el.label} (${el.w}×${el.h} ft) there. ` +
            "Try swap_items to trade places with another item, or remove something first."
        : `No item matching "${target}" on the blueprint.`;
    }
    return `Moved ${moved.moved.label} ${moved.distance} ft ${awayFrom ? `away from ${awayFrom}` : `next to ${near}`}.${safetyNote(eventId)}`;
  },

  swap_items: ({ first, second }, { eventId }) => {
    const swapped = updateEventAndReturn(eventId, (d) => swapElements(d, first, second));
    if (!swapped) return `Couldn't find both "${first}" and "${second}" on the blueprint.`;
    return `Swapped ${swapped.a.label} and ${swapped.b.label}.${safetyNote(eventId)}`;
  },

  remove_items: ({ target, count }, { eventId, layout }) => {
    const matches = resolveElements(layout, target);
    const chosen = count ? matches.slice(0, count) : matches;
    if (!chosen.length) return `Nothing matching "${target}" on the blueprint.`;
    updateEvent(eventId, (d) =>
      removeElements(
        d,
        chosen.map((e) => e.id),
      ),
    );
    return `Removed ${chosen.length} item(s): ${chosen.map((e) => e.label).join(", ")}.${safetyNote(eventId)}`;
  },

  auto_layout: ({ tableKind, include, asNewVersion }, { eventId, ev, layout }) => {
    const guests = ev.guests.filter((g) => g.rsvp !== "no").length || ev.guestCount;
    const base = defaultIntent(ev.type, guests, layout.venue.indoor);
    const requested = include ? include.map((k) => resolveKind(k) ?? k) : [...new Set(layout.elements.map((e) => e.kind))];
    const intent: LayoutIntent = sanitizeIntent(
      { tableKind: tableKind ?? base.tableKind, include: requested, vipRows: base.vipRows },
      base,
    );
    const result = autoLayout({
      venue: layout.venue,
      fixtures: layout.elements.filter((e) => isFixture(e.kind)),
      guestCount: guests,
      intent,
    });
    const id = asNewVersion ? nanoid(8) : layout.id;
    updateEvent(eventId, (d) => {
      const next = {
        id,
        name: asNewVersion ? `Plan ${String.fromCharCode(65 + d.layouts.length)} · AI layout` : layout.name,
        venue: { ...layout.venue },
        elements: result.elements,
        zones: result.zones,
      };
      if (asNewVersion) {
        d.layouts.push(next);
        d.activeLayoutId = id;
      } else {
        d.layouts[d.layouts.findIndex((l) => l.id === id)] = next;
      }
    });
    const skipped = result.dropped.length ? `; skipped ${result.dropped.join(", ")} to fit everyone` : "";
    return `Generated a layout with ${result.seats} seats${asNewVersion ? " as a new version" : ""}${skipped}.${safetyNote(eventId)}`;
  },

  auto_seat: (_input, { eventId, ev, layout }) => {
    const result = autoSeat(ev, layout);
    updateEvent(eventId, (d) => {
      for (const g of d.guests) g.seatId = result.assignments[g.id];
    });
    return result.notes.join(" ");
  },

  update_event: (input, { eventId }) => {
    const changed: string[] = [];
    updateEvent(eventId, (d) => {
      for (const key of ["name", "date", "startTime", "city", "theme"] as const) {
        const value = input[key];
        if (!value) continue;
        d[key] = value;
        changed.push(key);
      }
      if (input.guestCount) {
        d.guestCount = Math.round(input.guestCount);
        changed.push("guest count");
      }
      if (input.budgetTotal) {
        d.budget.total = Math.round(input.budgetTotal);
        changed.push("budget");
      }
      if (input.perPlate) {
        d.budget.perPlate = Math.round(input.perPlate);
        changed.push("per-plate cost");
      }
    });
    return changed.length ? `Updated ${changed.join(", ")}.` : "Nothing to update.";
  },

  set_allocation: ({ category, amount }, { eventId }) => {
    const value = Math.max(0, Math.round(amount));
    updateEvent(eventId, (d) => void (d.budget.allocations[category] = value));
    return `Set ${category} budget to ${inr(value)}.`;
  },

  add_expense: ({ category, label, amount, dueDate }, { eventId }) => {
    const value = Math.max(0, Math.round(amount));
    updateEvent(
      eventId,
      (d) => void d.budget.lines.push({ id: nanoid(8), category, label, estimated: value, actual: 0, paid: 0, dueDate }),
    );
    return `Added expense "${label}" for ${inr(value)}.`;
  },

  add_vendor: ({ category, name, quote, status }, { eventId }) => {
    updateEvent(
      eventId,
      (d) =>
        void d.vendors.push({
          id: nanoid(8),
          category,
          name,
          status: status ?? "todo",
          quote: Math.round(quote ?? 0),
          paid: 0,
          zoneIds: [],
        }),
    );
    return `Added vendor ${name}.`;
  },

  add_task: ({ title, dueDate }, { eventId }) => {
    updateEvent(eventId, (d) => void d.tasks.push({ id: nanoid(8), title, dueDate, phase: "Details & invites", done: false }));
    return `Added task "${title}" due ${dueDate}.`;
  },

  add_schedule_item: ({ time, title, durationMin, location }, { eventId, layout }) => {
    const elementKind = location ? (resolveKind(location) ?? resolveElements(layout, location)[0]?.kind) : undefined;
    updateEvent(
      eventId,
      (d) => void d.schedule.push({ id: nanoid(8), time, title, durationMin: Math.round(durationMin), elementKind, vendorIds: [] }),
    );
    return `Added "${title}" at ${time} to the run of show.`;
  },
};

/** Validates the model's arguments with the shared schemas, then applies the change. Always returns a summary, never throws. */
export function runAssistantTool(eventId: string, name: string, rawInput: unknown): string {
  const ev = useStore.getState().events[eventId];
  if (!ev) return "Event not found.";
  if (!isChatToolName(name)) return `Unknown tool ${name}.`;
  const parsed = toolInputSchemas[name].safeParse(rawInput ?? {});
  if (!parsed.success) return `Invalid input for ${name}: ${parsed.error.issues[0]?.message ?? "unknown"}.`;
  // Each handler's input type matches its schema; TypeScript can't correlate the two through `name`.
  const handler = handlers[name] as Handler<ChatToolName>;
  return handler(parsed.data, { eventId, ev, layout: activeLayout(ev) });
}

export function toolLabel(name: string) {
  return isChatToolName(name) ? toolLabels[name] : name;
}
