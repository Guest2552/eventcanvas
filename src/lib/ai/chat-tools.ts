import { type InferUITools, type Tool, tool, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import { TABLE_KINDS } from "@/lib/catalog/elements";
import { BUDGET_IDS, VENDOR_IDS } from "./schemas";

/**
 * The AI co-planner's tools, defined once and shared by both sides:
 * the chat route sends them to the model, and the browser validates the model's
 * arguments with the same schemas before running them against the local plan.
 * Item types are plain strings (resolved in the browser) to keep requests small.
 */

const item = z.string().describe("Item label (e.g. 'T4', 'Stage'), type (e.g. 'dj-booth') or zone name");
const isoDate = z.string().describe("YYYY-MM-DD");

export const toolInputSchemas = {
  add_items: z.object({
    kind: z.string().describe("Item type, e.g. photo-booth, round-10, buffet, kids-zone"),
    count: z.number(),
    near: item.optional(),
  }),
  move_item: z.object({ target: item, near: item.optional(), awayFrom: item.optional() }),
  swap_items: z.object({ first: item, second: item }),
  remove_items: z.object({ target: item, count: z.number().optional() }),
  auto_layout: z.object({
    tableKind: z.enum(TABLE_KINDS).optional(),
    include: z.array(z.string()).optional().describe("Item types; omit to keep the current mix"),
    asNewVersion: z.boolean(),
  }),
  auto_seat: z.object({}),
  update_event: z.object({
    name: z.string().optional(),
    date: isoDate.optional(),
    startTime: z.string().optional().describe("HH:mm"),
    city: z.string().optional(),
    guestCount: z.number().optional(),
    theme: z.string().optional(),
    budgetTotal: z.number().optional(),
    perPlate: z.number().optional(),
  }),
  set_allocation: z.object({ category: z.enum(BUDGET_IDS), amount: z.number() }),
  add_expense: z.object({ category: z.enum(BUDGET_IDS), label: z.string(), amount: z.number(), dueDate: isoDate.optional() }),
  add_vendor: z.object({
    category: z.enum(VENDOR_IDS),
    name: z.string(),
    quote: z.number().optional(),
    status: z.enum(["todo", "contacted", "quoted", "booked", "paid", "delivered"]).optional(),
  }),
  add_task: z.object({ title: z.string(), dueDate: isoDate }),
  add_schedule_item: z.object({
    time: z.string().describe("HH:mm"),
    title: z.string(),
    durationMin: z.number(),
    location: z.string().optional().describe("Item type where it happens"),
  }),
};

export type ChatToolName = keyof typeof toolInputSchemas;
export type ChatToolInput<N extends ChatToolName> = z.infer<(typeof toolInputSchemas)[N]>;

const descriptions: Record<ChatToolName, string> = {
  add_items: "Add items to the blueprint; placed automatically with safe aisles.",
  move_item: "Move one item next to another item/zone, or far away from one.",
  swap_items: "Swap the positions of two items ('interchange X and Y').",
  remove_items: "Remove items by label or type.",
  auto_layout: "Regenerate the floor plan for the current venue.",
  auto_seat: "Seat all attending guests automatically.",
  update_event: "Update event details.",
  set_allocation: "Set the planned budget (INR) for a category.",
  add_expense: "Add a budget expense line.",
  add_vendor: "Add a vendor.",
  add_task: "Add a countdown task.",
  add_schedule_item: "Add a moment to the day-of run of show.",
};

/** Progress labels shown in the chat while a tool runs. */
export const toolLabels: Record<ChatToolName, string> = {
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
};

const summary = z.string();
const s = toolInputSchemas;
const d = descriptions;

/** Every tool returns a one-line summary that the model turns into its reply. No `execute`: the browser runs them. */
export const chatTools = {
  add_items: tool({ description: d.add_items, inputSchema: s.add_items, outputSchema: summary }),
  move_item: tool({ description: d.move_item, inputSchema: s.move_item, outputSchema: summary }),
  swap_items: tool({ description: d.swap_items, inputSchema: s.swap_items, outputSchema: summary }),
  remove_items: tool({ description: d.remove_items, inputSchema: s.remove_items, outputSchema: summary }),
  auto_layout: tool({ description: d.auto_layout, inputSchema: s.auto_layout, outputSchema: summary }),
  auto_seat: tool({ description: d.auto_seat, inputSchema: s.auto_seat, outputSchema: summary }),
  update_event: tool({ description: d.update_event, inputSchema: s.update_event, outputSchema: summary }),
  set_allocation: tool({ description: d.set_allocation, inputSchema: s.set_allocation, outputSchema: summary }),
  add_expense: tool({ description: d.add_expense, inputSchema: s.add_expense, outputSchema: summary }),
  add_vendor: tool({ description: d.add_vendor, inputSchema: s.add_vendor, outputSchema: summary }),
  add_task: tool({ description: d.add_task, inputSchema: s.add_task, outputSchema: summary }),
  add_schedule_item: tool({ description: d.add_schedule_item, inputSchema: s.add_schedule_item, outputSchema: summary }),
} satisfies Record<ChatToolName, Tool>;

export type ChatUIMessage = UIMessage<unknown, UIDataTypes, InferUITools<typeof chatTools>>;

export function isChatToolName(name: string): name is ChatToolName {
  return name in toolInputSchemas;
}
