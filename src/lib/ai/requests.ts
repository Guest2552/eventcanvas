import { z } from "zod";
import { EVENT_TYPE_IDS } from "./schemas";

/** Request-body schemas for every AI route. Anything outside these shapes is rejected with 400. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shortText = (max: number) => z.string().trim().max(max);
const looseRecord = z.record(z.string(), z.unknown());

export const planRequest = z.object({
  prompt: shortText(2000).min(3, "Describe the event in a few words"),
  today: isoDate.optional(),
});

export const layoutRequest = z.object({
  prompt: shortText(1000).optional(),
  event: z.object({
    type: z.enum(EVENT_TYPE_IDS),
    guestCount: z.number().int().min(1).max(5000),
    theme: shortText(120).optional(),
    city: shortText(80).optional(),
    notes: shortText(600).optional(),
  }),
  venue: z.object({
    name: shortText(80),
    widthFt: z.number().min(10).max(1000),
    lengthFt: z.number().min(10).max(1000),
    indoor: z.boolean(),
  }),
});

export const seatingRequest = z.object({
  rules: shortText(2000),
  guests: z.array(z.object({ name: shortText(120), group: shortText(120) })).max(2000),
});

export const ideasRequest = z.object({
  event: looseRecord,
  diet: z.record(z.string(), z.number().min(0)),
  kids: z.number().min(0).max(5000),
  budgetPerHead: z.number().min(0).max(1_000_000),
  wish: shortText(800).optional(),
});

const suggestion = z.object({
  id: shortText(40),
  title: shortText(200),
  detail: shortText(600),
  category: shortText(40),
  saving: z.number().min(0),
  action: z
    .union([
      z.object({ type: z.literal("perPlate"), value: z.number().min(0) }),
      z.object({ type: z.literal("removeTables"), kind: shortText(40), count: z.number().int().min(1).max(200) }),
    ])
    .optional(),
});

export const optimizeRequest = z.object({
  event: looseRecord,
  budget: looseRecord,
  baseline: z.array(suggestion).max(20),
});

export const WRITE_KINDS = ["invitation", "welcome-speech", "toast", "thank-you", "whatsapp-reminder", "vendor-enquiry"] as const;

export const writeRequest = z.object({
  kind: z.enum(WRITE_KINDS),
  details: shortText(1500).optional(),
  tone: shortText(40).optional(),
  language: shortText(40).optional(),
  event: looseRecord,
});

export const chatRequest = z.object({
  messages: z
    .array(
      z.looseObject({
        id: shortText(200),
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.looseObject({ type: z.string() })).max(60),
      }),
    )
    .min(1)
    .max(60),
  context: z.unknown(),
});
