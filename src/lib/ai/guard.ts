import "server-only";
import type { z } from "zod";

/**
 * Front door for every AI route:
 * same-origin check → per-IP rate limit → body size cap → JSON parse → schema validation.
 * Keeps strangers from spending the Groq quota and rejects malformed input before it reaches a model.
 */

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Sliding-window limiter. In-memory, so it is per server instance: a best-effort shield, not billing-grade. */
export function rateLimit(key: string, limit: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  hits.clear();
}

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Browsers send Origin / Sec-Fetch-Site on cross-site requests; reject anything not from this site. */
export function isSameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const fail = (status: number, error: string, headers?: Record<string, string>) => Response.json({ error }, { status, headers });

export async function guard<T>(
  req: Request,
  schema: z.ZodType<T>,
  opts: { route: string; limit?: number; maxBytes?: number },
): Promise<{ data: T } | { response: Response }> {
  if (!isSameOrigin(req)) return { response: fail(403, "Cross-site requests are not allowed") };

  const rl = rateLimit(`${opts.route}:${clientIp(req)}`, opts.limit ?? 20);
  if (!rl.ok) return { response: fail(429, "Too many requests. Please wait a moment.", { "retry-after": String(rl.retryAfter) }) };

  const text = await req.text();
  if (text.length > (opts.maxBytes ?? 200_000)) return { response: fail(413, "Request too large") };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { response: fail(400, "Invalid JSON") };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { response: fail(400, `Invalid request: ${first?.path.join(".") || "body"} ${first?.message ?? ""}`.trim()) };
  }
  return { data: parsed.data };
}
