"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Check, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ASSISTANT_EVENT } from "@/lib/assistant-bus";
import { buildPlanContext, runAssistantTool, toolLabel } from "@/lib/assistant-tools";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Move the DJ booth away from the VIP tables",
  "Add a photo booth near the entry",
  "We're over budget by 1 lakh. Suggest cuts and apply the safe ones",
  "Seat all guests, then tell me who still needs a seat",
  "Plan a 15-minute cake cutting at 8:30 PM",
  "Write a Tamil + English invitation message",
];

export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { id } = useParams<{ id: string }>();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: () => {
          const ev = useStore.getState().events[currentEventId()];
          return { context: ev ? buildPlanContext(ev) : null };
        },
      }),
    [],
  );

  const { messages, sendMessage, addToolOutput, status, error, setMessages, stop } = useChat({
    id: `assistant-${id}`,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      let output: string;
      try {
        output = runAssistantTool(currentEventId(), toolCall.toolName, (toolCall.input ?? {}) as Record<string, unknown>);
      } catch (err) {
        // Report the failure to the model instead of leaving the chat stuck
        output = `That action failed: ${err instanceof Error ? err.message : "unknown error"}. Nothing was changed.`;
      }
      void addToolOutput({ tool: toolCall.toolName as never, toolCallId: toolCall.toolCallId, output: output as never });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const hasVisible = (m: (typeof messages)[number]) => m.parts.some((p) => (p.type === "text" && p.text.trim().length > 0) || p.type.startsWith("tool-"));
  const last = messages[messages.length - 1];
  // gpt-oss reasons silently before answering, so keep showing progress until something visible arrives
  const thinking = status === "submitted" || (status === "streaming" && !(last?.role === "assistant" && hasVisible(last)));

  useEffect(() => {
    const onOpen = (e: Event) => {
      onOpenChange(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) void sendMessage({ text: prompt });
    };
    window.addEventListener(ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_EVENT, onOpen);
  }, [onOpenChange, sendMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
    setInput("");
  };

  const errorText = error ? (error.message.includes("No AI key") ? "The AI co-planner needs an API key. Add GROQ_API_KEY to .env.local (see README), then restart the dev server." : "The AI service didn't respond. Try again in a moment.") : null;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => onOpenChange(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-card shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        aria-label="AI co-planner"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">AI co-planner</p>
            <p className="text-[11px] text-muted-foreground">Edits your blueprint, budget, vendors and timeline directly</p>
          </div>
          {messages.length > 0 && (
            <Button size="icon-sm" variant="ghost" onClick={() => setMessages([])} aria-label="New conversation" title="New conversation">
              <RotateCcw />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close assistant">
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin" role="log" aria-live="polite" aria-label="Conversation with the AI co-planner">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ask me to change the plan in plain words. I can see your whole event: layout, guests, budget, vendors and schedule.</p>
              <div className="grid gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border bg-background px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) =>
            m.role === "assistant" && !hasVisible(m) ? (
              busy && idx === messages.length - 1 ? null : (
                <p key={m.id} className="text-xs text-muted-foreground italic">
                  No reply that time. Try asking again, or split the request into smaller steps.
                </p>
              )
            ) : (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] space-y-1.5 rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.parts.map((part, i) => {
                  if (part.type === "text") return <RichText key={i} text={part.text} />;
                  if (part.type.startsWith("tool-")) {
                    const p = part as { type: string; state: string; output?: unknown; errorText?: string };
                    const name = p.type.slice(5);
                    const done = p.state === "output-available";
                    return (
                      <div key={i} className={cn("flex items-start gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-xs", done ? "border-emerald-200 text-foreground" : "text-muted-foreground")}>
                        {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> : p.state === "output-error" ? <X className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />}
                        <span>{done ? String(p.output) : p.state === "output-error" ? p.errorText : `${toolLabel(name)}…`}</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Thinking…
            </div>
          )}
          {errorText && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{errorText}</div>}
          <div ref={endRef} />
        </div>

        <form
          className="border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="e.g. Add 2 round tables near the dance floor"
              className="max-h-32 min-h-10 resize-none"
              aria-label="Message the AI co-planner"
            />
            {busy ? (
              <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Stop">
                <X />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                <Send />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Powered by Groq (Gemini fallback). Every change can be undone with Ctrl+Z.</p>
        </form>
      </aside>
    </>
  );
}

/** The event the user is looking at, read at call time so tools always act on the open plan. */
function currentEventId() {
  return window.location.pathname.match(/^\/e\/([^/]+)/)?.[1] ?? "";
}

/** Minimal formatting for model replies: paragraphs, bullets and **bold**. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 whitespace-pre-wrap">
      {lines.map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const content = line.replace(/^\s*[-*•]\s+/, "");
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => (seg.startsWith("**") && seg.endsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>));
        if (!line.trim()) return <div key={i} className="h-1" />;
        return bullet ? (
          <div key={i} className="flex gap-1.5">
            <span>•</span>
            <span>{parts}</span>
          </div>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
    </div>
  );
}
