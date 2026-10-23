import { generateText, Output } from "ai";
import { providerOptions, readJson, retriesFor, withFallback } from "@/lib/ai/provider";
import { seatingRulesSchema } from "@/lib/ai/schemas";

export const maxDuration = 60;

const EMPTY = { keepTogether: [], keepApart: [], nearStage: [], nearExit: [] };

export async function POST(req: Request) {
  const { rules, guests } = await readJson<{ rules: string; guests: { name: string; group: string }[] }>(req, 400_000);
  const roster = guests
    .slice(0, 800)
    .map((g) => `${g.name} | ${g.group}`)
    .join("\n");

  const ai = await withFallback(async (m) => {
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
