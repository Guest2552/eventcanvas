import { afterEach, describe, expect, it, vi } from "vitest";
import { isSameOrigin, rateLimit, resetRateLimits } from "./guard";
import { cacheKey, clearAiCache, resilientModel, retriesFor, withCachedFallback } from "./provider";

const r = (headers: Record<string, string>) => new Request("http://app.test/api/ai/plan", { method: "POST", headers });

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  resetRateLimits();
  clearAiCache();
});

describe("rateLimit", () => {
  it("allows up to the limit per minute, then reports when to retry", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 2, t).ok).toBe(true);
    expect(rateLimit("k", 2, t + 10).ok).toBe(true);
    const blocked = rateLimit("k", 2, t + 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(60);
    expect(rateLimit("k", 2, t + 61_000).ok).toBe(true);
  });
});

describe("isSameOrigin", () => {
  it("accepts same-site and non-browser requests, rejects other sites", () => {
    expect(isSameOrigin(r({}))).toBe(true);
    expect(isSameOrigin(r({ origin: "http://app.test" }))).toBe(true);
    expect(isSameOrigin(r({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(r({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(r({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(r({ origin: "not a url" }))).toBe(false);
  });
});

describe("provider selection", () => {
  it("has no model without keys", () => {
    expect(resilientModel()).toBeNull();
    expect(retriesFor()).toBe(2);
  });

  it("uses Groq first and turns off slow retries when Gemini can take over", () => {
    process.env.GROQ_API_KEY = "test-groq";
    expect(resilientModel()?.maxRetries).toBe(2);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini";
    const m = resilientModel()!;
    expect(m.maxRetries).toBe(0);
    expect(m.label).toMatch(/Groq .*Gemini .*backup/);
    expect(retriesFor()).toBe(0);
  });
});

describe("withCachedFallback", () => {
  it("serves repeated requests from cache until the entry expires", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    const fn = vi.fn(async () => ({ answer: 42 }));
    const key = cacheKey("plan", { prompt: "same" });
    const t = 5_000_000;
    expect((await withCachedFallback(key, fn, t))?.result).toEqual({ answer: 42 });
    const again = await withCachedFallback(key, fn, t + 1000);
    expect(again?.cached).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    await withCachedFallback(key, fn, t + 11 * 60_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    process.env.GROQ_API_KEY = "test-groq";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => {
      throw new Error("rate limited");
    });
    expect(await withCachedFallback("k", failing)).toBeNull();
    expect(await withCachedFallback("k", failing)).toBeNull();
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
