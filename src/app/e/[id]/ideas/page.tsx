"use client";

import { Check, Copy, Gift, Hash, Loader2, PartyPopper, PenLine, Sparkles, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentEvent } from "@/components/event/use-current-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { eventSummary, streamFromRoute } from "@/lib/ai-client";
import { budgetSummary } from "@/lib/engine/costs";
import { offlineIdeas, offlineWrite, type WriteKind } from "@/lib/engine/offline";
import type { IdeaPack } from "@/lib/types";

const WRITE_KINDS: { id: WriteKind | "toast"; label: string }[] = [
  { id: "invitation", label: "Invitation message" },
  { id: "welcome-speech", label: "Welcome speech" },
  { id: "toast", label: "Toast" },
  { id: "whatsapp-reminder", label: "WhatsApp RSVP reminder" },
  { id: "thank-you", label: "Thank-you note" },
];

export default function IdeasPage() {
  const { ev, update } = useCurrentEvent();
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<string>("invitation");
  const [tone, setTone] = useState("warm");
  const [language, setLanguage] = useState("English");
  const [details, setDetails] = useState("");
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!ev) return null;

  const ideas: IdeaPack = ev.ideas ?? offlineIdeas(ev);
  const attending = ev.guests.filter((g) => g.rsvp !== "no");

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: eventSummary(ev),
          diet: {
            veg: attending.filter((g) => g.dietary === "veg").length,
            nonVeg: attending.filter((g) => g.dietary === "non-veg").length,
            jain: attending.filter((g) => g.dietary === "jain").length,
            vegan: attending.filter((g) => g.dietary === "vegan").length,
          },
          kids: attending.filter((g) => g.child).length,
          budgetPerHead: budgetSummary(ev).perHead,
          wish,
        }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { ideas: IdeaPack };
      update((d) => void (d.ideas = data.ideas));
      toast.success("Fresh ideas, personalised for your event");
    } catch {
      update((d) => void (d.ideas = offlineIdeas(ev)));
      toast.info("AI is offline, so here's our curated idea pack");
    } finally {
      setLoading(false);
    }
  };

  const write = async () => {
    setWriting(true);
    setText("");
    let out = "";
    try {
      const r = await streamFromRoute("/api/ai/write", { kind, details, tone, language, event: eventSummary(ev) }, (t) => {
        out = t;
        setText(t);
      });
      if (!r.ok || !out.trim()) setText(offlineWrite((kind === "toast" ? "welcome-speech" : kind) as WriteKind, ev, details));
    } catch {
      setText(offlineWrite((kind === "toast" ? "welcome-speech" : kind) as WriteKind, ev, details));
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-primary/5 to-marigold/10 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Personalised ideas
          </Label>
          <p className="text-xs text-muted-foreground">
            Uses your city, guest mix ({attending.filter((g) => g.dietary !== "non-veg").length} veg · {attending.filter((g) => g.child).length} kids) and budget.{" "}
            {ideas.source === "ai" ? <Badge className="ml-1 h-4 px-1.5 text-[10px]">AI generated</Badge> : <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">Starter pack</Badge>}
          </p>
          <Input value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Anything specific? e.g. eco-friendly, Chettinad food, games for teenagers" className="bg-card" />
        </div>
        <Button onClick={generate} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate fresh ideas
        </Button>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Themes & palettes</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {ideas.themes.map((t) => (
            <div key={t.name} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="flex h-14">
                {t.palette.slice(0, 5).map((c) => (
                  <div key={c} className="flex-1" style={{ background: c }} title={c} />
                ))}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold">{t.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                <ul className="mt-2 flex-1 space-y-0.5 text-xs">
                  {t.decor.map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                </ul>
                <Button size="sm" variant={ev.theme === t.name ? "secondary" : "outline"} className="mt-3 gap-1" disabled={ev.theme === t.name} onClick={() => update((d) => void (d.theme = t.name))}>
                  {ev.theme === t.name ? (
                    <>
                      <Check className="size-3.5" /> Your theme
                    </>
                  ) : (
                    "Use this theme"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 font-semibold">
            <PartyPopper className="size-4 text-primary" /> Activities & games
          </p>
          <ul className="space-y-2">
            {ideas.activities.map((a) => (
              <li key={a.title} className="rounded-lg bg-muted/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {a.audience}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 font-semibold">
            <UtensilsCrossed className="size-4 text-primary" /> Menu suggestions
          </p>
          <div className="space-y-2.5">
            {ideas.menu.map((c) => (
              <div key={c.course}>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.course}</p>
                <p className="text-sm">{c.items.join(" · ")}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold">
                <Gift className="size-3.5 text-primary" /> Return gifts
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {ideas.favors.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold">
                <Hash className="size-3.5 text-primary" /> Hashtags
              </p>
              <div className="flex flex-wrap gap-1">
                {ideas.hashtags.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      void navigator.clipboard.writeText(h).catch(() => {});
                      toast.success(`Copied ${h}`);
                    }}
                    className="rounded-full border px-2 py-0.5 text-xs hover:border-primary/40"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xl font-semibold">
          <PenLine className="size-5 text-primary" /> Writer
        </p>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">What do you need?</Label>
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}>
                {WRITE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tone</Label>
                <NativeSelect value={tone} onChange={(e) => setTone(e.target.value)}>
                  {["warm", "formal", "fun", "emotional", "short & sweet"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <NativeSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {["English", "Tamil", "Hindi", "Tamil + English", "Hindi + English"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Details to include</Label>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Names, dress code, parking info, a story about the couple…" className="min-h-24" />
            </div>
            <Button onClick={write} disabled={writing} className="w-full gap-1.5">
              {writing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Write it
            </Button>
          </div>
          <div className="relative">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Your text appears here. Edit freely before copying." className="h-full min-h-64 bg-muted/30 text-sm leading-relaxed" />
            {text && (
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 gap-1 bg-card"
                onClick={async () => {
                  await navigator.clipboard.writeText(text).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
