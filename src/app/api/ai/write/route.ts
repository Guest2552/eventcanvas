import { createTextStreamResponse, streamText, toTextStream } from "ai";
import { guard } from "@/lib/ai/guard";
import { PLANNER_PERSONA, resilientModel } from "@/lib/ai/provider";
import { writeRequest } from "@/lib/ai/requests";

export const maxDuration = 60;

const KINDS: Record<string, string> = {
  invitation: "a heartfelt invitation message (suitable for a printed card or WhatsApp)",
  "welcome-speech": "a 60–90 second welcome speech for the host to read on stage",
  toast: "a short, warm toast to raise a glass to",
  "thank-you": "a thank-you note to send guests after the event",
  "whatsapp-reminder": "a friendly WhatsApp RSVP reminder with a couple of emojis",
  "vendor-enquiry": "a clear vendor enquiry asking for availability, packages and a quote",
};

export async function POST(req: Request) {
  const g = await guard(req, writeRequest, { route: "write", limit: 20 });
  if ("response" in g) return g.response;
  const body = g.data;
  const model = resilientModel();
  if (!model) return new Response("AI unavailable", { status: 503, headers: { "x-ai-source": "offline" } });

  const result = streamText({
    model: model.model,
    providerOptions: model.providerOptions,
    maxRetries: model.maxRetries,
    instructions: `${PLANNER_PERSONA}\nWrite only the requested text, ready to copy. No preamble, no markdown headings.`,
    prompt: [
      `Write ${KINDS[body.kind] ?? "a short message"}.`,
      `Event: ${JSON.stringify(body.event)}`,
      `Tone: ${body.tone || "warm"}. Language: ${body.language || "English"} (if Tamil or Hindi, write in that script).`,
      body.details ? `Extra details from the host: """${String(body.details).slice(0, 1500)}"""` : "",
    ].join("\n"),
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
    headers: { "x-ai-source": "ai", "x-ai-model": model.label },
  });
}
