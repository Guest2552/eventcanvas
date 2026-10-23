import { generateText, Output } from "ai";
import { guard } from "@/lib/ai/guard";
import { providerOptions, cacheKey, retriesFor, withCachedFallback } from "@/lib/ai/provider";
import { seatingRequest } from "@/lib/ai/requests";
import { seatingRulesSchema } from "@/lib/ai/schemas";

export const maxDuration = 60;

const EMPTY = { keepTogether: [], keepApart: [], nearStage: [], nearExit: [] };

export async function POST(req: Request) {
  const g = await guard(req, seatingRequest, { route: "seating", limit: 10, maxBytes: 400_000 });
  if ("response" in g) return g.response;
  const { rules, guests } = g.data;
  const roster = guests
    .slice(0, 800)
    .map((g) => `${g.name} | ${g.group}`)
    .join("\n");

  const ai = await withCachedFallback(cacheKey("seating", g.data), async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions:
        "You convert a host's plain-language seating wishes into structured constraints. Only use names that appear in the guest list (exact spelling) or exact group names. If a wish mentions a group, return the group name. Ignore wishes you cannot map.",
      prompt: `Guest list (name | group):\n${roster}\n\nSeating wishes: """${String(rules).slice(0, 2000)}"""`,
      output: Output.object({ schema: seatingRulesSchema }),
    });
    return output;
  });

  if (!ai) return Response.json({ rules: EMPTY, source: "offline" });
  return Response.json({ rules: ai.result, source: "ai", model: ai.model.label });
}
