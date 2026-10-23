import { generateText, Output } from "ai";
import { parsePrompt } from "@/lib/engine/offline";
import { guard } from "@/lib/ai/guard";
import { plannerInstructions, providerOptions, cacheKey, retriesFor, withCachedFallback } from "@/lib/ai/provider";
import { planRequest } from "@/lib/ai/requests";
import { planSchema } from "@/lib/ai/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guard(req, planRequest, { route: "plan", limit: 10 });
  if ("response" in g) return g.response;
  const { prompt, today } = g.data;
  const brief = String(prompt ?? "").slice(0, 2000);
  const todayIso = /^\d{4}-\d{2}-\d{2}$/.test(today ?? "") ? today! : new Date().toISOString().slice(0, 10);
  const fallback = parsePrompt(brief, new Date(`${todayIso}T12:00:00`));

  const ai = await withCachedFallback(cacheKey("plan", g.data), async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions: plannerInstructions(
        `Today is ${todayIso}. Turn the host's one-line brief into a complete starter plan.`,
        "Keep the host's stated facts exactly (guest count, city, budget, date).",
        "Infer sensible defaults for everything else, but never invent people's names.",
      ),
      prompt: `Brief: """${brief}"""`,
      output: Output.object({ schema: planSchema }),
    });
    return output;
  });

  if (!ai) return Response.json({ plan: fallback, source: "offline" });

  const p = ai.result;
  const plan = {
    name: p.name || fallback.name,
    type: p.type,
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : fallback.date,
    startTime: /^\d{2}:\d{2}$/.test(p.startTime) ? p.startTime : fallback.startTime,
    city: p.city || fallback.city,
    guestCount: p.guestCount > 0 ? Math.round(p.guestCount) : fallback.guestCount,
    budgetTotal: p.budgetTotal > 0 ? Math.round(p.budgetTotal) : fallback.budgetTotal,
    theme: p.theme || fallback.theme,
    notes: brief,
    templateId: p.templateId,
    intent: { tableKind: p.tableKind, include: p.include, vipRows: p.type === "birthday" ? 0 : 1 },
    split: p.split,
    perPlate: p.perPlate,
    highlights: p.highlights.slice(0, 4),
  };
  return Response.json({ plan, source: "ai", model: ai.model.label });
}
