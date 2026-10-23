"use client";

import { ArrowRight, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES, KNOWN_CITIES } from "@/lib/catalog/planning";
import { suggestTemplate, VENUE_TEMPLATES } from "@/lib/catalog/templates";
import { shiftDate, toIsoDate } from "@/lib/engine/costs";
import { createEventPlan, type NewEventInput } from "@/lib/engine/factory";
import { parsePrompt } from "@/lib/engine/offline";
import { inrShort } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

type PlanResponse = { plan: NewEventInput & { highlights?: string[] }; source: "ai" | "offline"; model?: string };

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEvent />
    </Suspense>
  );
}

function NewEvent() {
  const router = useRouter();
  const params = useSearchParams();
  const addEvent = useStore((s) => s.addEvent);
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "");
  const [loading, setLoading] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [form, setForm] = useState<NewEventInput>({
    name: "",
    type: "wedding",
    date: shiftDate(toIsoDate(new Date()), 60),
    startTime: "18:00",
    city: "Chennai",
    guestCount: 150,
    budgetTotal: 800000,
    theme: "",
  });
  const autoRan = useRef(false);
  const suggested = suggestTemplate(form.guestCount, form.type);
  const templateId = form.templateId ?? suggested.id;
  const set = <K extends keyof NewEventInput>(k: K, v: NewEventInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const generate = async (text = prompt) => {
    if (!text.trim()) return toast.error("Describe your event first");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: text, today: toIsoDate(new Date()) }) });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PlanResponse;
      setForm({ ...data.plan, notes: text });
      setHighlights(data.plan.highlights ?? []);
      setSource(data.source === "ai" ? `Planned by AI (${data.model})` : "Planned offline (no AI key configured)");
    } catch {
      const plan = parsePrompt(text);
      setForm(plan);
      setHighlights([]);
      setSource("Planned offline: the AI service was unreachable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRan.current && params.get("prompt")) {
      autoRan.current = true;
      void generate(params.get("prompt")!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () => {
    if (!form.name.trim()) return toast.error("Give your event a name");
    const ev = createEventPlan({ ...form, templateId });
    addEvent(ev);
    toast.success("Your plan is ready: blueprint, budget, timeline and checklist");
    router.push(`/e/${ev.id}/blueprint`);
  };

  return (
    <div className="bg-festive min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Brand />
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 sm:px-6">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Start a new celebration</h1>
          <p className="mt-1 text-muted-foreground">Describe it in one line and let AI draft the plan, or fill the details yourself.</p>
        </div>

        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <Label htmlFor="prompt" className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> One-prompt plan
          </Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Tamil wedding reception for 250 guests in Coimbatore on 12 Dec, budget 12 lakh, marigold theme, outdoor lawn"
            className="min-h-20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Mention guests, city, date, budget, theme, indoor/outdoor: anything you know.</p>
            <Button onClick={() => generate()} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} {loading ? "Planning…" : "Draft my plan"}
            </Button>
          </div>
          {source && (
            <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">{source}. Review the details below, then create.</p>
              {highlights.length > 0 && (
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {highlights.map((h) => (
                    <li key={h} className="flex gap-1.5">
                      <span className="text-marigold">✦</span> {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">What are we celebrating?</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => set("type", t)}
                  className={cn("rounded-xl border p-3 text-left transition hover:border-primary/50", form.type === t && "border-primary bg-primary/5 ring-2 ring-primary/20")}
                  aria-pressed={form.type === t}
                >
                  <div className="text-2xl">{EVENT_TYPES[t].emoji}</div>
                  <div className="mt-1 text-sm font-semibold">{EVENT_TYPES[t].label}</div>
                  <div className="text-xs text-muted-foreground">{EVENT_TYPES[t].blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Event name" className="sm:col-span-2 lg:col-span-1">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Priya & Arjun's Reception" />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Start time">
              <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </Field>
            <Field label="City">
              <Input list="cities" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <datalist id="cities">
                {KNOWN_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Guests">
              <Input type="number" min={1} value={form.guestCount} onChange={(e) => set("guestCount", Number(e.target.value))} />
            </Field>
            <Field label={`Total budget (₹) · ${inrShort(form.budgetTotal || 0)}`}>
              <Input type="number" min={0} step={10000} value={form.budgetTotal} onChange={(e) => set("budgetTotal", Number(e.target.value))} />
            </Field>
            <Field label="Theme / vibe" className="sm:col-span-2">
              <Input value={form.theme} onChange={(e) => set("theme", e.target.value)} placeholder="Marigold & ivory, temple gold, pastel garden…" />
            </Field>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">Pick a venue to start the blueprint</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {VENUE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set("templateId", t.id)}
                  className={cn("relative rounded-xl border p-3 text-left transition hover:border-primary/50", templateId === t.id && "border-primary bg-primary/5 ring-2 ring-primary/20")}
                  aria-pressed={templateId === t.id}
                >
                  {t.id === suggested.id && <Badge className="absolute -top-2 right-2 h-4 px-1.5 text-[10px]">Suggested</Badge>}
                  <div className="text-xl">{t.emoji}</div>
                  <div className="mt-1 text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">You can resize the venue and move everything later. The auto-layout places tables, stage and buffet with safe aisles.</p>
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={create} className="gap-1.5">
              Create plan & open blueprint <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
