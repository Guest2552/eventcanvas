import { convertToModelMessages, createUIMessageStreamResponse, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import { guard } from "@/lib/ai/guard";
import { PLANNER_PERSONA, resilientModel } from "@/lib/ai/provider";
import { chatRequest } from "@/lib/ai/requests";
import { BUDGET_IDS, VENDOR_IDS } from "@/lib/ai/schemas";
import { TABLE_KINDS } from "@/lib/catalog/elements";

export const maxDuration = 60;

// Item types are plain strings (resolved in the browser) to keep each request small:
// Groq's free tier allows 8k tokens per minute.
const item = z.string().describe("Item label (e.g. 'T4', 'Stage'), type (e.g. 'dj-booth', 'photo-booth') or zone name");

/** Tools have no `execute`: the browser runs them against the local plan and returns the result. */
const tools = {
  add_items: tool({
    description: "Add items to the blueprint; placed automatically with safe aisles.",
    inputSchema: z.object({ kind: z.string().describe("Item type, e.g. photo-booth, round-10, buffet, kids-zone"), count: z.number(), near: item.optional() }),
  }),
  move_item: tool({
    description: "Move one item next to another item/zone, or far away from one.",
    inputSchema: z.object({ target: item, near: item.optional(), awayFrom: item.optional() }),
  }),
  swap_items: tool({ description: "Swap the positions of two items ('interchange X and Y').", inputSchema: z.object({ first: item, second: item }) }),
  remove_items: tool({ description: "Remove items by label or type.", inputSchema: z.object({ target: item, count: z.number().optional() }) }),
  auto_layout: tool({
    description: "Regenerate the floor plan for the current venue.",
    inputSchema: z.object({ tableKind: z.enum(TABLE_KINDS).optional(), include: z.array(z.string()).optional().describe("Item types; omit to keep the current mix"), asNewVersion: z.boolean() }),
  }),
  auto_seat: tool({ description: "Seat all attending guests automatically.", inputSchema: z.object({}) }),
  update_event: tool({
    description: "Update event details.",
    inputSchema: z.object({
      name: z.string().optional(),
      date: z.string().optional().describe("YYYY-MM-DD"),
      startTime: z.string().optional().describe("HH:mm"),
      city: z.string().optional(),
      guestCount: z.number().optional(),
      theme: z.string().optional(),
      budgetTotal: z.number().optional(),
      perPlate: z.number().optional(),
    }),
  }),
  set_allocation: tool({ description: "Set the planned budget (INR) for a category.", inputSchema: z.object({ category: z.enum(BUDGET_IDS), amount: z.number() }) }),
  add_expense: tool({ description: "Add a budget expense line.", inputSchema: z.object({ category: z.enum(BUDGET_IDS), label: z.string(), amount: z.number(), dueDate: z.string().optional() }) }),
  add_vendor: tool({ description: "Add a vendor.", inputSchema: z.object({ category: z.enum(VENDOR_IDS), name: z.string(), quote: z.number().optional() }) }),
  add_task: tool({ description: "Add a countdown task.", inputSchema: z.object({ title: z.string(), dueDate: z.string().describe("YYYY-MM-DD") }) }),
  add_schedule_item: tool({
    description: "Add a moment to the day-of run of show.",
    inputSchema: z.object({ time: z.string().describe("HH:mm"), title: z.string(), durationMin: z.number(), location: z.string().optional().describe("Item type where it happens") }),
  }),
};

export async function POST(req: Request) {
  const g = await guard(req, chatRequest, { route: "chat", limit: 30, maxBytes: 600_000 });
  if ("response" in g) return g.response;
  const { messages, context } = g.data as { messages: UIMessage[]; context: unknown };
  const model = resilientModel();
  if (!model) {
    return Response.json({ error: "No AI key configured. Add GROQ_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) to .env.local." }, { status: 503 });
  }

  const result = streamText({
    model: model.model,
    providerOptions: model.providerOptions,
    maxRetries: model.maxRetries,
    instructions: [
      PLANNER_PERSONA,
      "You are the AI co-planner inside EventCanvas. The host's live plan is below as JSON; it is refreshed after every tool call.",
      "Rules:",
      "- To change the plan, call tools. Never say something was changed unless a tool result confirms it.",
      "- When the host asks for several changes, call ALL the needed tools together in the same step, then reply.",
      "- After tool results arrive, always finish with a short confirmation for the host, mentioning anything that failed.",
      "- Elders and VIPs usually sit in the VIP zone. For writing requests (invites, speeches, messages), write the text directly.",
      "- Keep replies short: 1 to 4 sentences or a tight bullet list. Use ₹ with Indian number formatting.",
      `- Today is ${new Date().toISOString().slice(0, 10)}.`,
      `PLAN: ${JSON.stringify(context).slice(0, 12000)}`,
    ].join("\n"),
    messages: await convertToModelMessages(messages.slice(-12)),
    tools,
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
