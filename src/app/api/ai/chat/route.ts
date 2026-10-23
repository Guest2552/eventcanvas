import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { chatTools, type ChatUIMessage } from "@/lib/ai/chat-tools";
import { guard } from "@/lib/ai/guard";
import { PLANNER_PERSONA, resilientModel } from "@/lib/ai/provider";
import { chatRequest } from "@/lib/ai/requests";

export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guard(req, chatRequest, { route: "chat", limit: 30, maxBytes: 600_000 });
  if ("response" in g) return g.response;
  const { messages, context } = g.data as { messages: ChatUIMessage[]; context: unknown };
  const model = resilientModel();
  if (!model) {
    return Response.json(
      { error: "No AI key configured. Add GROQ_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) to .env.local." },
      { status: 503 },
    );
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
    tools: chatTools,
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
