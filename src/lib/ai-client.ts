/**
 * Typed browser client for the AI routes. Request shapes come from the same zod schemas the
 * server validates against; every call resolves to `null` when the AI is unavailable so
 * callers can fall back to the built-in generators.
 */
import type { z } from "zod";
import type { ideasRequest, layoutRequest, optimizeRequest, planRequest, seatingRequest, writeRequest } from "@/lib/ai/requests";
import type { NewEventInput } from "@/lib/engine/factory";
import type { LayoutIntent } from "@/lib/engine/layout";
import type { BudgetSuggestion } from "@/lib/engine/offline";
import type { EventPlan, IdeaPack } from "@/lib/types";

export type AiSource = "ai" | "offline";

export interface PlanResponse {
  plan: NewEventInput & { highlights?: string[] };
  source: AiSource;
  model?: string;
}
export interface LayoutResponse {
  intent: LayoutIntent;
  reasoning: string;
  source: AiSource;
}
export interface SeatingResponse {
  rules: { keepTogether: string[][]; keepApart: string[][]; nearStage: string[]; nearExit: string[] };
  source: AiSource;
}
export interface IdeasResponse {
  ideas: IdeaPack;
}
export interface OptimizeResponse {
  suggestions: BudgetSuggestion[];
  source: AiSource;
}

async function postJson<Res>(path: string, body: unknown): Promise<Res | null> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as Res) : null;
  } catch {
    return null;
  }
}

/** Free text is trimmed to the server's limits here, so long notes never turn into a 400. */
const clip = (s: string | undefined, max: number) => s?.slice(0, max);

export const aiApi = {
  plan: (body: z.input<typeof planRequest>) => postJson<PlanResponse>("/api/ai/plan", { ...body, prompt: body.prompt.slice(0, 2000) }),
  layout: (body: z.input<typeof layoutRequest>) =>
    postJson<LayoutResponse>("/api/ai/layout", {
      ...body,
      prompt: clip(body.prompt, 1000),
      event: { ...body.event, theme: clip(body.event.theme, 120), city: clip(body.event.city, 80), notes: clip(body.event.notes, 600) },
    }),
  seating: (body: z.input<typeof seatingRequest>) =>
    postJson<SeatingResponse>("/api/ai/seating", { ...body, rules: body.rules.slice(0, 2000) }),
  ideas: (body: z.input<typeof ideasRequest>) => postJson<IdeasResponse>("/api/ai/ideas", { ...body, wish: clip(body.wish, 800) }),
  optimize: (body: z.input<typeof optimizeRequest>) => postJson<OptimizeResponse>("/api/ai/optimize", body),
  /** Streams text, calling `onText` with everything received so far. Resolves to the full text, or "" if unavailable. */
  write: (body: z.input<typeof writeRequest>, onText: (text: string) => void) =>
    streamText("/api/ai/write", { ...body, details: clip(body.details, 1500) }, onText),
};

async function streamText(path: string, body: unknown, onText: (text: string) => void): Promise<string> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok || !res.body) return "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onText(text);
    }
    return text;
  } catch {
    return "";
  }
}

/** The event facts the AI needs for writing and ideas, without any guest names. */
export function eventSummary(ev: EventPlan) {
  return {
    name: ev.name,
    type: ev.type,
    date: ev.date,
    startTime: ev.startTime,
    city: ev.city,
    guests: ev.guests.filter((g) => g.rsvp !== "no").length || ev.guestCount,
    theme: ev.theme,
    venue: ev.layouts.find((l) => l.id === ev.activeLayoutId)?.venue.name,
    notes: ev.notes,
  };
}
