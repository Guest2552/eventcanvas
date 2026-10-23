import { generateText, Output } from "ai";
import { defaultIntent } from "@/lib/engine/layout";
import { PLANNER_PERSONA, providerOptions, readJson, retriesFor, withFallback } from "@/lib/ai/provider";
import { layoutIntentSchema } from "@/lib/ai/schemas";
import type { EventType, Venue } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readJson<{ prompt?: string; event: { type: EventType; guestCount: number; theme?: string; city?: string; notes?: string }; venue: Venue }>(req);
  const { event, venue } = body;
  const fallback = defaultIntent(event.type, event.guestCount, venue.indoor);

  const ai = await withFallback(async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions: `${PLANNER_PERSONA}\nYou choose WHAT goes into a venue floor plan. A layout engine will place items with safe aisles, so do not give coordinates. Prefer fewer, meaningful items over clutter; small venues cannot fit everything.`,
      prompt: [
        `Event: ${event.type}, ${event.guestCount} guests, theme "${event.theme ?? ""}", city ${event.city ?? ""}. ${event.notes ?? ""}`,
        `Venue: ${venue.name}, ${venue.widthFt} x ${venue.lengthFt} ft (${venue.widthFt * venue.lengthFt} sq ft), ${venue.indoor ? "indoor" : "outdoor"}.`,
        `Host request: """${String(body.prompt ?? "").slice(0, 1000) || "Recommend a good setup."}"""`,
        `A sensible default would be: ${JSON.stringify(fallback)}.`,
      ].join("\n"),
      output: Output.object({ schema: layoutIntentSchema }),
    });
    return output;
  });

  if (!ai) return Response.json({ intent: fallback, reasoning: "", source: "offline" });
  const { reasoning, ...intent } = ai.result;
  return Response.json({ intent, reasoning, source: "ai", model: ai.model.label });
}
