import { generateText, Output } from "ai";
import { nanoid } from "nanoid";
import { PLANNER_PERSONA, providerOptions, readJson, retriesFor, withFallback } from "@/lib/ai/provider";
import { optimizeSchema } from "@/lib/ai/schemas";
import type { BudgetSuggestion } from "@/lib/engine/offline";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { event, budget, baseline } = await readJson<{ event: Record<string, unknown>; budget: Record<string, unknown>; baseline: BudgetSuggestion[] }>(req);

  const ai = await withFallback(async (m) => {
    const { output } = await generateText({
      model: m.model,
      providerOptions: providerOptions(m),
      maxRetries: retriesFor(),
      instructions: `${PLANNER_PERSONA}\nYou are reviewing a budget to find savings that keep the celebration special. Keep baseline suggestions that make sense (reference their id so one-click actions keep working), improve their wording for this event, and add new culturally aware ideas. Savings must be realistic.`,
      prompt: `Event: ${JSON.stringify(event)}\nBudget: ${JSON.stringify(budget)}\nBaseline suggestions: ${JSON.stringify(baseline.map(({ action, ...s }) => ({ ...s, actionable: !!action })))}`,
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
