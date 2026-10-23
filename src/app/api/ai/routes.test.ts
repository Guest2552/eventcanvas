import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/ai/guard";
import { clearAiCache } from "@/lib/ai/provider";
import { POST as chat } from "./chat/route";
import { POST as ideas } from "./ideas/route";
import { POST as layout } from "./layout/route";
import { POST as optimize } from "./optimize/route";
import { POST as plan } from "./plan/route";
import { POST as seating } from "./seating/route";
import { POST as write } from "./write/route";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/ai/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const venue = { name: "Banquet hall", widthFt: 100, lengthFt: 80, indoor: true };

beforeEach(() => {
  // No keys: every route must fall back to built-in behaviour or a clean 503
  delete process.env.GROQ_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  resetRateLimits();
  clearAiCache();
});

describe("request guard on AI routes", () => {
  it("rejects malformed JSON, schema violations and oversized bodies", async () => {
    expect((await plan(req("{not json"))).status).toBe(400);
    const bad = await plan(req({ prompt: "" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/prompt/);
    expect((await plan(req({ prompt: "x".repeat(250_000) }))).status).toBe(413);
  });

  it("blocks cross-site browser requests", async () => {
    expect((await plan(req({ prompt: "wedding for 100" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await plan(req({ prompt: "wedding for 100" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await plan(req({ prompt: "wedding for 100" }, { "sec-fetch-site": "same-origin" }))).status).toBe(200);
  });

  it("rate-limits each client per route", async () => {
    const headers = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 10; i++) expect((await plan(req({ prompt: "birthday for 20" }, headers))).status).toBe(200);
    const limited = await plan(req({ prompt: "birthday for 20" }, headers));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // A different client is unaffected
    expect((await plan(req({ prompt: "birthday for 20" }, { "x-forwarded-for": "198.51.100.2" }))).status).toBe(200);
  });
});

describe("offline fallbacks without an API key", () => {
  it("plan parses the brief locally", async () => {
    const res = await plan(req({ prompt: "Tamil wedding for 300 guests in Coimbatore, budget 8 lakh", today: "2026-10-23" }));
    const body = await res.json();
    expect(body.source).toBe("offline");
    expect(body.plan).toMatchObject({ type: "wedding", guestCount: 300, city: "Coimbatore", budgetTotal: 800000 });
  });

  it("layout returns the recommended intent and validates the venue", async () => {
    const ok = await (await layout(req({ event: { type: "community", guestCount: 300 }, venue }))).json();
    expect(ok.source).toBe("offline");
    expect(ok.intent.tableKind).toBe("chair-row");
    expect((await layout(req({ event: { type: "community", guestCount: 0 }, venue }))).status).toBe(400);
  });

  it("seating returns empty rules", async () => {
    const body = await (await seating(req({ rules: "keep A and B apart", guests: [{ name: "A", group: "x" }] }))).json();
    expect(body).toEqual({ rules: { keepTogether: [], keepApart: [], nearStage: [], nearExit: [] }, source: "offline" });
  });

  it("optimize hands back the built-in suggestions untouched", async () => {
    const baseline = [
      {
        id: "b1",
        title: "Remove 1 table",
        detail: "x",
        category: "rentals",
        saving: 1200,
        action: { type: "removeTables", kind: "round-10", count: 1 },
      },
    ];
    const body = await (await optimize(req({ event: {}, budget: {}, baseline }))).json();
    expect(body.source).toBe("offline");
    expect(body.suggestions).toEqual(baseline);
  });

  it("ideas, writer and chat answer 503 so the client uses its offline path", async () => {
    expect((await ideas(req({ event: {}, diet: { veg: 3 }, kids: 0, budgetPerHead: 100 }))).status).toBe(503);
    expect((await write(req({ kind: "invitation", event: {} }))).status).toBe(503);
    const res = await chat(req({ messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }], context: {} }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/GROQ_API_KEY/);
  });

  it("writer and chat still validate input first", async () => {
    expect((await write(req({ kind: "ransom-note", event: {} }))).status).toBe(400);
    expect((await chat(req({ messages: [], context: {} }))).status).toBe(400);
  });
});
