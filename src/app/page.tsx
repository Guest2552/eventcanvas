"use client";

import { ArrowRight, CalendarClock, LayoutGrid, MapPin, Sparkles, Store, Trash2, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES } from "@/lib/catalog/planning";
import { daysUntil } from "@/lib/engine/costs";
import { formatDate } from "@/lib/format";
import { createDemoCommunity, createDemoWedding } from "@/lib/seed/demo";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Tamil wedding reception for 250 guests in Coimbatore on 12 Dec, budget 12 lakh, marigold & ivory theme",
  "My daughter's 5th birthday, 40 guests, Chennai, 1.5L budget, unicorn theme",
  "Diwali night for our apartment association, 300 residents, Bengaluru, budget 3L",
  "Company annual day for 150 people in Hyderabad with awards and dinner",
];

const FEATURES = [
  { icon: LayoutGrid, title: "Venue blueprint", text: "Drag stages, tables and buffets onto a real-scale floor plan, like a seat map for your own event." },
  { icon: Users, title: "Smart seating", text: "Families stay together, elders sit near exits, VIPs up front. Click any seat to assign a guest." },
  { icon: Wallet, title: "Linked budget", text: "Every table you place and every guest you add updates the budget instantly." },
  { icon: CalendarClock, title: "Timeline & run-of-show", text: "A countdown of tasks, plus a minute-by-minute schedule tied to blueprint zones." },
  { icon: Store, title: "Vendor checklist", text: "Place a DJ booth and the DJ vendor appears on your checklist. Track quotes to delivery." },
  { icon: Sparkles, title: "AI co-planner", text: "Ask it to move the DJ away from the elders or add a photo booth, and it edits the plan for you." },
];

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const events = useStore((s) => s.events);
  const hydrated = useStore((s) => s.hydrated);
  const addEvent = useStore((s) => s.addEvent);
  const removeEvent = useStore((s) => s.removeEvent);
  const list = Object.values(events).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const openDemo = (kind: "wedding" | "community") => {
    const existing = list.find((e) => e.name === (kind === "wedding" ? "Priya & Arjun's Wedding Reception" : "Coimbatore Diwali Cultural Night"));
    if (existing) return router.push(`/e/${existing.id}`);
    const ev = kind === "wedding" ? createDemoWedding() : createDemoCommunity();
    addEvent(ev);
    router.push(`/e/${ev.id}`);
  };

  const submit = () => {
    const p = prompt.trim();
    router.push(p ? `/new?prompt=${encodeURIComponent(p)}` : "/new");
  };

  return (
    <div className="bg-festive min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Brand />
        <nav className="flex items-center gap-2">
          {list.length > 0 && (
            <a href="#events" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              My events
            </a>
          )}
          <Link href="/new" className={buttonVariants()}>
            New event
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> AI planner for weddings, birthdays & community events
            </Badge>
            <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              Plan the celebration on a <span className="text-primary italic">living blueprint.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Lay out your venue like a theatre seat map. Budget, timeline, vendors and seating all update as you plan, and an AI co-planner can make changes for you.
            </p>

            <div className="mt-7 rounded-2xl border bg-card p-3 shadow-sm">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Describe your event in one line: type, guests, city, date, budget, vibe…"
                className="min-h-20 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                aria-label="Describe your event"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.slice(0, 2).map((ex) => (
                    <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
                      {ex.length > 46 ? `${ex.slice(0, 46)}…` : ex}
                    </button>
                  ))}
                </div>
                <Button onClick={submit} size="lg" className="gap-1.5">
                  Plan it <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Or open a demo:</span>
              <Button variant="outline" size="sm" onClick={() => openDemo("wedding")}>
                💍 Wedding reception · 165 guests
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDemo("community")}>
                🪔 Diwali community night · seat booking
              </Button>
            </div>
          </div>
          <HeroBlueprint />
        </section>

        {hydrated && list.length > 0 && (
          <section id="events" className="py-6">
            <h2 className="mb-4 text-2xl font-semibold">Your events</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((ev) => {
                const d = daysUntil(ev.date);
                return (
                  <div key={ev.id} className="group relative rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                    <Link href={`/e/${ev.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${ev.name}`} />
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl">{EVENT_TYPES[ev.type].emoji}</span>
                      <Badge variant={d < 0 ? "secondary" : "outline"}>{d < 0 ? "Done" : d === 0 ? "Today!" : `${d} days to go`}</Badge>
                    </div>
                    <h3 className="mt-3 line-clamp-1 text-lg font-semibold">{ev.name}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" /> {ev.city} · {formatDate(ev.date)} · {ev.guests.length || ev.guestCount} guests
                    </p>
                    <button
                      className="relative z-10 mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus:opacity-100"
                      onClick={() => {
                        if (confirm(`Delete "${ev.name}"? This removes it from this browser.`)) {
                          removeEvent(ev.id);
                          toast.success("Event deleted");
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="py-10">
          <h2 className="mb-6 text-2xl font-semibold">Everything is connected to the blueprint</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card/80 p-5">
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-sans font-semibold tracking-normal">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        EventCanvas · Built for Hack2Skill PromptWar Challenge 5 · Your plans are saved in this browser only.
      </footer>
    </div>
  );
}

/** Decorative seat-map illustration for the hero. */
function HeroBlueprint() {
  const tables = [
    [70, 150], [150, 150], [290, 150], [370, 150],
    [70, 235], [150, 235], [290, 235], [370, 235],
    [110, 320], [220, 320], [330, 320],
  ];
  const colors = ["#e11d48", "#fb7185", "#f59e0b", "#ffffff", "#38bdf8"];
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-4 rotate-2 rounded-[2rem] bg-marigold/25" />
      <svg viewBox="0 0 440 400" className="relative w-full rounded-[1.5rem] border bg-card shadow-xl" role="img" aria-label="Example venue blueprint with stage, dance floor and round tables">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#f1ebe4" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="10" y="10" width="420" height="380" rx="16" fill="url(#grid)" stroke="#e7ddd2" />
        <rect x="140" y="28" width="160" height="56" rx="8" fill="#fdf2f8" stroke="#db2777" strokeWidth="2" />
        <text x="220" y="62" textAnchor="middle" fontSize="15" fontWeight="600" fill="#9d174d">🎤 Stage</text>
        <rect x="190" y="185" width="60" height="60" rx="6" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" />
        <text x="220" y="220" textAnchor="middle" fontSize="18">💃</text>
        <rect x="22" y="110" width="20" height="120" rx="4" fill="#f7fee7" stroke="#65a30d" strokeWidth="2" />
        <rect x="190" y="372" width="60" height="12" rx="3" fill="#f0f9ff" stroke="#0284c7" strokeWidth="2" />
        <rect x="40" y="128" width="140" height="44" rx="10" fill="#eab308" opacity="0.12" stroke="#eab308" strokeDasharray="5 4" />
        {tables.map(([cx, cy], t) => (
          <g key={t}>
            <circle cx={cx} cy={cy} r="20" fill="#fff7ed" stroke="#ea580c" strokeWidth="2" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#9a3412">T{t + 1}</text>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <circle key={i} cx={cx + Math.cos(a) * 30} cy={cy + Math.sin(a) * 30} r="5.5" fill={colors[(t * 3 + i) % colors.length]} stroke="#a8a29e" strokeWidth="1" />;
            })}
          </g>
        ))}
      </svg>
      <div className="absolute -bottom-5 left-4 rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
        <span className="font-semibold text-primary">AI:</span> Moved the DJ 18 ft away from the elders&apos; tables ✓
      </div>
    </div>
  );
}
