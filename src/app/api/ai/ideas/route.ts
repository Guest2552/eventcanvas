import { generateText, Output } from "ai";
import { guard } from "@/lib/ai/guard";
import { plannerInstructions, providerOptions, cacheKey, retriesFor, withCachedFallback } from "@/lib/ai/provider";
import { ideasRequest } from "@/lib/ai/requests";
import { ideasSchema } from "@/lib/ai/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guard(req, ideasRequest, { route: "ideas", limit: 10 });
  if ("response" in g) return g.response;
  const body = g.data;

  const ai = await withCachedFallback(cacheKey("ideas", g.data), async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions: plannerInstructions(
        "Generate fresh, personalised ideas.",
        "Match regional cuisine to the city, respect the dietary mix, and keep favours within the per-guest budget.",
      ),
      prompt: [
        `Event: ${JSON.stringify(body.event)}`,
        `Dietary mix of attending guests: ${JSON.stringify(body.diet)}. Kids attending: ${body.kids}. Budget per guest: ₹${body.budgetPerHead}.`,
        body.wish ? `Host wishes: """${String(body.wish).slice(0, 800)}"""` : "",
      ].join("\n"),
      output: Output.object({ schema: ideasSchema }),
    });
    return output;
  });

  if (!ai) return Response.json({ error: "AI unavailable" }, { status: 503 });
  return Response.json({ ideas: { ...ai.result, source: "ai" }, model: ai.model.label });
}
