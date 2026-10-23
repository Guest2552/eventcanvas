"use client";

import {
  CalendarClock,
  FileDown,
  LayoutDashboard,
  Loader2,
  Map as MapIcon,
  Radio,
  Redo2,
  Sparkles,
  Store,
  Ticket,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EVENT_TYPES } from "@/lib/catalog/planning";
import { daysUntil } from "@/lib/engine/costs";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/blueprint", label: "Blueprint", icon: MapIcon },
  { href: "/guests", label: "Guests & seating", icon: Users },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/ideas", label: "Ideas & writer", icon: Sparkles },
  { href: "/live", label: "Live mode", icon: Radio },
  { href: "/share", label: "Share & booking", icon: Ticket },
  { href: "/print", label: "Export PDF", icon: FileDown },
];

export function EventShell({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const ev = useStore((s) => s.events[id]);
  const canUndo = useStore((s) => (s.history[id]?.past.length ?? 0) > 0);
  const canRedo = useStore((s) => (s.history[id]?.future.length ?? 0) > 0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const base = `/e/${id}`;
  const isPrint = pathname.endsWith("/print");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo(id);
        else useStore.getState().undo(id);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useStore.getState().redo(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading your plan…
      </div>
    );
  }
  if (!ev) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">We couldn&apos;t find this event in this browser.</p>
        <p className="max-w-md text-sm text-muted-foreground">Plans are stored locally on the device that created them. Open it from the same browser, or start a new one.</p>
        <Link href="/" className={buttonVariants()}>
          Go home
        </Link>
      </div>
    );
  }
  if (isPrint) return <>{children}</>;

  const days = daysUntil(ev.date);
  const active = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="px-4 py-4">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 scrollbar-thin" aria-label="Event sections">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={base + n.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active(n.href) && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <n.icon className={cn("size-4", active(n.href) && "text-primary")} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <Button className="w-full gap-2" onClick={() => setAssistantOpen(true)}>
            <Sparkles className="size-4" /> AI co-planner
          </Button>
          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">Saved in this browser · Ctrl+Z to undo</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card/70 px-4 py-2.5 backdrop-blur">
          <span className="text-2xl" aria-hidden>
            {EVENT_TYPES[ev.type].emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-sans text-base font-semibold tracking-normal">{ev.name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(ev.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {ev.city} · {ev.theme || EVENT_TYPES[ev.type].label}
            </p>
          </div>
          <Badge variant={days <= 7 ? "default" : "secondary"} className="hidden sm:inline-flex">
            {days < 0 ? "Event done" : days === 0 ? "It's today! 🎉" : `${days} days to go`}
          </Badge>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={() => useStore.getState().undo(id)} aria-label="Undo" />}>
                <Undo2 />
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={() => useStore.getState().redo(id)} aria-label="Redo" />}>
                <Redo2 />
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
            <Button size="sm" className="ml-1 gap-1.5 md:hidden" onClick={() => setAssistantOpen(true)}>
              <Sparkles className="size-3.5" /> AI
            </Button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden scrollbar-thin" aria-label="Event sections">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={base + n.href}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", active(n.href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}
            >
              <n.icon className="size-3.5" /> {n.label}
            </Link>
          ))}
        </nav>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}
