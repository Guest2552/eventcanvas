import type { EventPlan } from "@/lib/types";

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

/** Streams plain text from one of our AI routes, calling onText with the full text so far. */
export async function streamFromRoute(url: string, body: unknown, onText: (text: string) => void): Promise<{ ok: boolean; source: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const source = res.headers.get("x-ai-source") ?? "ai";
  if (!res.ok || !res.body) return { ok: false, source };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return { ok: true, source };
}
