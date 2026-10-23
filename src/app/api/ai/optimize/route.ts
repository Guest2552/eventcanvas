import { generateText, Output } from "ai";
import { nanoid } from "nanoid";
import { guard } from "@/lib/ai/guard";
import { plannerInstructions, providerOptions, cacheKey, retriesFor, withCachedFallback } from "@/lib/ai/provider";
import { optimizeRequest } from "@/lib/ai/requests";
import { optimizeSchema } from "@/lib/ai/schemas";
import type { BudgetSuggestion } from "@/lib/engine/offline";

export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guard(req, optimizeRequest, { route: "optimize", limit: 10 });
  if ("response" in g) return g.response;
  const { event, budget } = g.data;
  const baseline = g.data.baseline as BudgetSuggestion[];

  const ai = await withCachedFallback(cacheKey("optimize", g.data), async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions: plannerInstructions(
        "You are reviewing a budget to find savings that keep the celebration special.",
        "Keep baseline suggestions that make sense (reference their id so one-click actions keep working).",
        "Improve their wording for this event, and add new culturally aware ideas. Savings must be realistic.",
      ),
      prompt: [
        `Event: ${JSON.stringify(event)}`,
        `Budget: ${JSON.stringify(budget)}`,
        `Baseline suggestions: ${JSON.stringify(baseline.map(({ action, ...s }) => ({ ...s, actionable: !!action })))}`,
      ].join("\n"),
      output: Output.object({ schema: optimizeSchema }),
    });
    return output;
  });

  if (!ai) return Response.json({ suggestions: baseline, source: "offline" });

  const byId = new Map(baseline.map((b) => [b.id, b]));
  const suggestions: BudgetSuggestion[] = ai.result.suggestions
    .filter((s) => s.saving > 0)
    .map((s) => {
      const base = byId.get(s.baselineId);
      // An actionable suggestion keeps its own title and saving so "Apply" does exactly what it says
      if (base?.action) return { ...base, detail: s.detail || base.detail };
      return { id: base?.id ?? nanoid(6), title: s.title, detail: s.detail, category: s.category, saving: Math.round(s.saving) };
    });
  // Never lose an actionable baseline suggestion
  for (const b of baseline) if (b.action && !suggestions.some((s) => s.id === b.id)) suggestions.push(b);
  suggestions.sort((a, b) => b.saving - a.saving);
  return Response.json({ suggestions: suggestions.slice(0, 7), source: "ai", model: ai.model.label });
}
