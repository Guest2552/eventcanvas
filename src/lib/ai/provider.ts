import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModelV4, LanguageModelV4Middleware } from "@ai-sdk/provider";
import { type LanguageModel, wrapLanguageModel } from "ai";

export interface ModelChoice {
  provider: "groq" | "google";
  id: string;
  label: string;
  model: LanguageModel;
}

/** Groq first (fast, free tier), Gemini as the automatic backup. Only providers with a key are used. */
export function availableModels(): ModelChoice[] {
  const out: ModelChoice[] = [];
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    const id = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    out.push({ provider: "groq", id, label: `Groq ${id}`, model: groq(id) });
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogle({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const id = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    out.push({ provider: "google", id, label: `Gemini ${id}`, model: google(id) });
  }
  return out;
}

/**
 * One model that fails over instantly: if Groq rejects a call (e.g. the free tier's
 * 8k tokens/minute limit), the same request goes to Gemini instead of waiting out a retry.
 */
export function resilientModel(): { model: LanguageModel; label: string; maxRetries: number; providerOptions: ReturnType<typeof providerOptions> } | null {
  const [primary, ...backups] = availableModels();
  if (!primary) return null;
  if (!backups.length) return { model: primary.model, label: primary.label, maxRetries: 2, providerOptions: providerOptions(primary) };
  const asV4 = (m: ModelChoice) => m.model as LanguageModelV4;
  const failover = async <T>(first: () => PromiseLike<T>, next: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> => {
    try {
      return await first();
    } catch (err) {
      console.warn(`[ai] ${primary.label} failed, switching to backup:`, err instanceof Error ? err.message.slice(0, 160) : err);
      let last = err;
      for (const b of backups) {
        try {
          return await next(asV4(b));
        } catch (e) {
          last = e;
        }
      }
      throw last;
    }
  };
  const middleware: LanguageModelV4Middleware = {
    specificationVersion: "v4",
    wrapGenerate: ({ doGenerate, params }) => failover(doGenerate, (m) => m.doGenerate(params)),
    wrapStream: ({ doStream, params }) => failover(doStream, (m) => m.doStream(params)),
  };
  return {
    model: wrapLanguageModel({ model: asV4(primary), middleware }),
    label: `${primary.label} (${backups.map((b) => b.label).join(", ")} backup)`,
    maxRetries: 0,
    providerOptions: providerOptions(primary),
  };
}

/** Skip slow automatic retries when a backup provider can take over. */
export function retriesFor() {
  return availableModels().length > 1 ? 0 : 2;
}

/** Keeps reasoning models quick for interactive use. */
export function providerOptions(m: ModelChoice) {
  return m.provider === "groq" && m.id.includes("gpt-oss") ? { groq: { reasoningEffort: "low" as const } } : undefined;
}

/** Tries each configured model in order; returns null when none is configured or all fail. */
export async function withFallback<T>(fn: (m: ModelChoice) => Promise<T>): Promise<{ result: T; model: ModelChoice } | null> {
  for (const m of availableModels()) {
    try {
      return { result: await fn(m), model: m };
    } catch (err) {
      console.error(`[ai] ${m.label} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function readJson<T>(req: Request, maxBytes = 200_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Request too large");
  return JSON.parse(text) as T;
}

export const PLANNER_PERSONA =
  "You are EventCanvas, a warm, practical event planner who knows Indian weddings, birthdays and community events (and global ones too). Budgets are in Indian rupees (₹). Be specific and realistic for the city and guest count.";
