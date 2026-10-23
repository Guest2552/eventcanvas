import { z } from "zod";
import { FIXTURE_KINDS, TABLE_KINDS } from "@/lib/catalog/elements";

export const EVENT_TYPE_IDS = ["wedding", "birthday", "community", "corporate"] as const;
export const TEMPLATE_IDS = ["banquet", "lawn", "community-hall", "auditorium", "terrace", "home"] as const;
export const OPTIONAL_KINDS = [
  "stage",
  "mandap",
  "dance-floor",
  "dj-booth",
  "led-screen",
  "speaker",
  "buffet",
  "bar",
  "cake-table",
  "photo-booth",
  "kids-zone",
  "gift-table",
  "registration",
  "ramp",
  "generator",
  "plant",
  "sofa",
] as const;
export const ALL_KINDS = [...OPTIONAL_KINDS, ...TABLE_KINDS, ...FIXTURE_KINDS] as const;
export const BUDGET_IDS = [
  "venue",
  "catering",
  "decor",
  "rentals",
  "photography",
  "entertainment",
  "attire",
  "invitations",
  "gifts",
  "logistics",
  "misc",
] as const;
export const VENDOR_IDS = [
  "venue",
  "catering",
  "decor",
  "photography",
  "dj",
  "av",
  "bakery",
  "florist",
  "mehendi",
  "makeup",
  "priest",
  "invitations",
  "transport",
  "rentals",
  "entertainment",
  "power",
  "security",
  "attire",
  "emcee",
] as const;

const split = z.object(
  Object.fromEntries(BUDGET_IDS.map((k) => [k, z.number().describe(`Percent of total budget for ${k}`)])) as Record<
    (typeof BUDGET_IDS)[number],
    z.ZodNumber
  >,
);

export const planSchema = z.object({
  name: z
    .string()
    .describe(
      "Short event name. Use people's names ONLY if the brief contains them (e.g. \"Kabir's 5th Birthday\"); " +
        'otherwise a descriptive name like "Wedding Reception in Coimbatore". Never invent names.',
    ),
  type: z.enum(EVENT_TYPE_IDS),
  date: z.string().describe("YYYY-MM-DD. If no date is given, pick a sensible date 8 weeks from today"),
  startTime: z.string().describe("HH:mm, 24-hour"),
  city: z.string(),
  guestCount: z.number().describe("Expected number of guests"),
  budgetTotal: z.number().describe("Total budget in INR. Estimate realistically if not given"),
  theme: z.string().describe("A short evocative theme name, e.g. 'Marigold & Ivory'"),
  templateId: z
    .enum(TEMPLATE_IDS)
    .describe(
      "home ≤30 guests, terrace ≤70, community-hall ≤160, banquet ≤260 indoor, lawn for outdoor or large, auditorium for shows/talks",
    ),
  tableKind: z.enum(TABLE_KINDS).describe("Seating style. chair-row for audience-style shows"),
  include: z.array(z.enum(OPTIONAL_KINDS)).describe("Blueprint items that suit this event"),
  split: split.describe("Budget split in percent; values sum to 100"),
  perPlate: z
    .number()
    .describe(
      "Realistic catering cost per plate in INR for the city, consistent with the catering share of the budget (roughly ₹400–1500; metros cost more)",
    ),
  highlights: z.array(z.string()).describe("Exactly 4 short, personalised planning ideas or tips for this event"),
});

export const layoutIntentSchema = z.object({
  tableKind: z.enum(TABLE_KINDS),
  include: z.array(z.enum(OPTIONAL_KINDS)),
  vipRows: z.number().describe("0 to 2 rows of VIP tables nearest the stage"),
  reasoning: z.string().describe("One or two sentences explaining the choices to the host"),
});

export const seatingRulesSchema = z.object({
  keepTogether: z.array(z.array(z.string())).describe("Groups of guest names or group names that must share a table"),
  keepApart: z.array(z.array(z.string())).describe("Sets of guest names who must NOT share a table"),
  nearStage: z.array(z.string()).describe("Guest names or group names to seat closest to the stage"),
  nearExit: z.array(z.string()).describe("Guest names or group names to seat near doors (elderly, mobility needs, early leavers)"),
});

export const ideasSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        palette: z.array(z.string()).describe("Exactly 5 hex colours like #f59e0b"),
        decor: z.array(z.string()).describe("4 concrete decor ideas"),
      }),
    )
    .describe("3 theme options"),
  activities: z
    .array(z.object({ title: z.string(), description: z.string(), audience: z.string() }))
    .describe("5 activities or games suited to the guests"),
  menu: z
    .array(z.object({ course: z.string(), items: z.array(z.string()) }))
    .describe("4 to 5 courses respecting the dietary mix and regional cuisine"),
  favors: z.array(z.string()).describe("5 return-gift or favour ideas within budget"),
  hashtags: z.array(z.string()).describe("4 fun event hashtags"),
});

export const optimizeSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string().describe("Why and how, in one or two sentences, specific to this event"),
        category: z.enum(BUDGET_IDS),
        saving: z.number().describe("Estimated saving in INR"),
        baselineId: z.string().describe("If this refines one of the provided baseline suggestions, its id; otherwise empty string"),
      }),
    )
    .describe("4 to 6 suggestions ordered by saving"),
});
