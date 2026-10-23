/**
 * Built-in generators used when no AI key is configured or the AI call fails,
 * so the demo always works.
 */
import { nanoid } from "nanoid";
import { getDef, seatCount } from "@/lib/catalog/elements";
import { EVENT_TYPES, KNOWN_CITIES } from "@/lib/catalog/planning";
import type { BudgetCategory, EventPlan, EventType, IdeaPack } from "@/lib/types";
import { activeLayout, type BudgetSummary, shiftDate, toIsoDate, unitCost } from "./costs";
import type { NewEventInput } from "./factory";
import { totalSeats } from "./geometry";

// ---------- Prompt parser ----------

const TYPE_WORDS: [EventType, RegExp][] = [
  ["wedding", /wedding|marriage|reception|engagement|sangeet|nikah|shaadi|kalyanam/i],
  ["birthday", /birthday|bday|turning \d+|\d+(st|nd|rd|th) b/i],
  ["corporate", /corporate|office|offsite|conference|launch|annual day|company|team outing|summit/i],
  ["community", /community|festival|diwali|pongal|onam|navratri|fundraiser|meetup|cultural|association|temple|society|club|concert|run/i],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parsePrompt(text: string, today = new Date()): NewEventInput {
  const t = text.trim();
  const type = TYPE_WORDS.find(([, re]) => re.test(t))?.[0] ?? "birthday";

  const guestMatch = t.match(/(\d{1,5})\s*(\+\s*)?(guests|people|pax|members|attendees|persons|families|ppl)/i);
  const guestCount = guestMatch ? Number(guestMatch[1]) : { wedding: 200, birthday: 40, community: 250, corporate: 120 }[type];

  let budgetTotal = 0;
  const budgetMatch = t.match(/(₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|lac|lacs|k|thousand|cr|crore)\b/i);
  if (budgetMatch) {
    const n = Number(budgetMatch[2]);
    const unit = budgetMatch[3].toLowerCase();
    budgetTotal = unit.startsWith("c") ? n * 1e7 : unit === "k" || unit === "thousand" ? n * 1e3 : n * 1e5;
  } else {
    const rupees = t.match(/(₹|rs\.?|inr)\s*([\d,]{4,})/i);
    if (rupees) budgetTotal = Number(rupees[2].replace(/,/g, ""));
  }
  if (!budgetTotal) budgetTotal = guestCount * { wedding: 4500, birthday: 1500, community: 800, corporate: 3000 }[type];

  const city = KNOWN_CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(t)) ?? "Chennai";

  let date = shiftDate(toIsoDate(today), 60);
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  const dayMonth = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  const monthDay = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
  const inN = t.match(/in\s+(\d+)\s*(day|week|month)s?/i);
  if (iso) date = iso[0];
  else if (dayMonth || monthDay) {
    const day = Number(dayMonth ? dayMonth[1] : monthDay![2]);
    const month = MONTHS.indexOf((dayMonth ? dayMonth[2] : monthDay![1]).toLowerCase().slice(0, 3));
    const d = new Date(today.getFullYear(), month, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    date = toIsoDate(d);
  } else if (inN) {
    const n = Number(inN[1]);
    date = shiftDate(toIsoDate(today), inN[2].toLowerCase().startsWith("w") ? n * 7 : inN[2].toLowerCase().startsWith("m") ? n * 30 : n);
  }

  const themeMatch = t.match(/([\w&' -]{3,30}?)\s+theme/i) ?? t.match(/theme[d]?\s*(?:of|:|is)?\s*([\w&' -]{3,30})/i);
  const theme = themeMatch ? titleCase(themeMatch[1].trim()) : { wedding: "Marigold & Ivory", birthday: "Confetti Pop", community: "Festival of Lights", corporate: "Modern Minimal" }[type];

  const who = t.match(/\b([A-Z][a-z]+(?:\s*(?:&|and)\s*[A-Z][a-z]+)?)'s\b/);
  const age = t.match(/(\d{1,3})(?:st|nd|rd|th)\s*(?:birthday|bday)/i) ?? t.match(/turning\s+(\d{1,3})/i);
  const label = EVENT_TYPES[type].label;
  const name = who ? `${who[1]}'s ${age ? `${age[1]}${ordinal(Number(age[1]))} ` : ""}${label}` : `${age ? `${age[1]}${ordinal(Number(age[1]))} ` : ""}${label} in ${city}`;

  const outdoor = /outdoor|lawn|garden|beach|terrace|open.?air|farm/i.test(t);
  const startTime = /morning|muhurtham|breakfast/i.test(t) ? "09:00" : /lunch|afternoon/i.test(t) ? "12:30" : "18:00";

  return {
    name,
    type,
    date,
    startTime,
    city,
    guestCount,
    budgetTotal,
    theme,
    notes: t,
    templateId: outdoor ? (guestCount > 70 ? "lawn" : "terrace") : undefined,
  };
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ---------- Idea packs ----------

const IDEAS: Record<EventType, Omit<IdeaPack, "source" | "menu">> = {
  wedding: {
    themes: [
      { name: "Marigold & Ivory", description: "Classic South Indian warmth with jasmine strings, brass urli and marigold drapes.", palette: ["#f59e0b", "#fff7ed", "#b45309", "#166534", "#fde68a"], decor: ["Marigold torans at entry", "Brass urli with floating flowers", "Banana-leaf place mats", "Jasmine curtains behind the stage"] },
      { name: "Royal Temple", description: "Kanjeevaram-inspired maroon and gold with temple bells and kolam art.", palette: ["#7f1d1d", "#ca8a04", "#fef3c7", "#1c1917", "#b91c1c"], decor: ["Kolam rangoli at entry", "Temple bell hangings", "Silk drapes in maroon and gold", "Diya-lit aisle"] },
      { name: "Pastel Garden", description: "Soft blush and sage with fairy lights, perfect for an evening reception.", palette: ["#fbcfe8", "#d9f99d", "#fef9c3", "#a7f3d0", "#f5f5f4"], decor: ["Floral arch photo spot", "Fairy-light canopy", "Pastel table runners", "Hanging terrariums"] },
    ],
    activities: [
      { title: "Couple trivia on screen", description: "Guests answer fun questions about the couple via QR code; winners get a sweet box.", audience: "Everyone" },
      { title: "Family dance-off", description: "Bride side vs groom side sangeet-style dance battle.", audience: "Families" },
      { title: "Blessing jar", description: "Guests drop handwritten wishes into a brass jar for the couple to read later.", audience: "Elders" },
      { title: "Kids craft corner", description: "Mehendi-cone painting and paper garland making.", audience: "Kids" },
    ],
    favors: ["Mini brass diya", "Silk pouch with dry fruits", "Seed paper thank-you card", "Jasmine gajra for women guests", "Personalised sweet box"],
    hashtags: ["#ForeverStartsHere", "#TwoHeartsOneSoul", "#KalyanamDiaries", "#BigFatTamilWedding"],
  },
  birthday: {
    themes: [
      { name: "Confetti Pop", description: "Bright, playful colours with balloon garlands and a confetti cannon moment.", palette: ["#f43f5e", "#facc15", "#22d3ee", "#a855f7", "#ffffff"], decor: ["Balloon arch at stage", "Confetti table toppers", "Neon name sign", "Polaroid wall"] },
      { name: "Retro Bollywood", description: "Old-school film posters, disco ball and filmy dialogues.", palette: ["#dc2626", "#fbbf24", "#111827", "#f5f5f4", "#9333ea"], decor: ["Movie-poster backdrop", "Filmy dialogue placards", "Disco ball over dance floor", "Popcorn cart"] },
      { name: "Under the Stars", description: "Navy and gold night-sky theme with fairy lights.", palette: ["#1e3a8a", "#facc15", "#f8fafc", "#312e81", "#94a3b8"], decor: ["Star-light ceiling", "Moon backdrop", "Gold cutlery", "Lantern centrepieces"] },
    ],
    activities: [
      { title: "Treasure hunt", description: "Clues hidden around the venue blueprint zones; winners get the first slice of cake.", audience: "Kids" },
      { title: "Memory lane slideshow", description: "Photos from every year of the birthday person's life on the LED screen.", audience: "Everyone" },
      { title: "Musical chairs", description: "The classic, with a filmy-songs playlist.", audience: "Kids & adults" },
      { title: "Wish wall", description: "Sticky-note wishes on a big board, turned into a keepsake album.", audience: "Everyone" },
    ],
    favors: ["Mini plant in a printed pot", "Custom cookie with name", "Activity kit for kids", "Personalised keychain", "Chocolate box"],
    hashtags: ["#PartyLikeItsTheBigDay", "#CakeAndConfetti", "#BirthdayVibesOnly", "#AnotherTripAroundTheSun"],
  },
  community: {
    themes: [
      { name: "Festival of Lights", description: "Diyas, lanterns and rangoli for a warm festive evening.", palette: ["#f97316", "#facc15", "#7c2d12", "#fef3c7", "#be123c"], decor: ["Diya pathways", "Paper lantern ceiling", "Community rangoli contest area", "Marigold stage backdrop"] },
      { name: "Harvest Mela", description: "Pongal / Onam style earthy decor with sugarcane, banana leaves and clay pots.", palette: ["#65a30d", "#ca8a04", "#fef9c3", "#78350f", "#ea580c"], decor: ["Sugarcane arch", "Clay pot installations", "Banana-leaf canopy", "Folk-art banners"] },
      { name: "Unity in Colours", description: "Bold multicolour bunting celebrating every culture in the neighbourhood.", palette: ["#e11d48", "#2563eb", "#16a34a", "#facc15", "#9333ea"], decor: ["Flag bunting", "Culture booths", "Hand-print mural wall", "Colourful umbrellas"] },
    ],
    activities: [
      { title: "Talent showcase", description: "Open stage for residents: singing, dance, stand-up.", audience: "All ages" },
      { title: "Rangoli competition", description: "Teams decorate tiles near the entry; judged by elders.", audience: "Families" },
      { title: "Kids drawing contest", description: "Theme: 'My neighbourhood'. Prizes on stage.", audience: "Kids" },
      { title: "Food stalls by residents", description: "Each block runs a stall; proceeds go to the welfare fund.", audience: "Everyone" },
    ],
    favors: ["Event T-shirt for volunteers", "Sapling for each family", "Sweet packet", "Participation certificates"],
    hashtags: ["#OneCommunity", "#CelebrateTogether", "#NeighbourhoodNights", "#FestiveVibes"],
  },
  corporate: {
    themes: [
      { name: "Modern Minimal", description: "Clean whites, brand colour accents and smart lighting.", palette: ["#0f172a", "#f8fafc", "#2563eb", "#94a3b8", "#22c55e"], decor: ["Branded backdrop", "LED name wall", "Minimal floral centrepieces", "Lounge pods"] },
      { name: "Future Forward", description: "Neon gradients and tech-inspired installations.", palette: ["#7c3aed", "#06b6d4", "#0f172a", "#f472b6", "#e2e8f0"], decor: ["Neon tunnel entry", "Interactive screens", "Holographic badges", "AR photo booth"] },
      { name: "Green Summit", description: "Sustainable decor with plants, jute and reusable materials.", palette: ["#166534", "#a3e635", "#fefce8", "#78716c", "#14b8a6"], decor: ["Living plant walls", "Jute table runners", "Upcycled signage", "Seed-paper badges"] },
    ],
    activities: [
      { title: "Live polling", description: "Audience votes on questions from their phones; results on the LED.", audience: "Attendees" },
      { title: "Speed networking", description: "5-minute rotations at round tables.", audience: "Attendees" },
      { title: "Awards night", description: "Peer-nominated awards with fun categories.", audience: "Teams" },
      { title: "CSR corner", description: "Pack donation kits for a local NGO.", audience: "Everyone" },
    ],
    favors: ["Branded bottle", "Plantable pen set", "Desk planter", "Power bank", "Notebook kit"],
    hashtags: ["#TeamSummit", "#BuildTogether", "#WorkHardCelebrateHarder", "#OneTeam"],
  },
};

export function offlineIdeas(ev: EventPlan): IdeaPack {
  const veg = ev.guests.length ? ev.guests.filter((g) => g.dietary !== "non-veg").length / ev.guests.length : 0.7;
  const jain = ev.guests.some((g) => g.dietary === "jain");
  const southIndian = /chennai|coimbatore|madurai|trichy|salem|bengaluru|hyderabad|kochi|vellore|erode|puducherry|mysuru/i.test(ev.city);
  const menu = [
    { course: "Welcome", items: southIndian ? ["Rose milk", "Panakam", "Mini masala vada"] : ["Aam panna", "Masala chaas", "Dhokla bites"] },
    { course: "Starters", items: ["Paneer tikka", "Corn cheese balls", veg < 0.8 ? "Chicken 65" : "Gobi 65", "Hara bhara kebab"] },
    { course: "Mains", items: southIndian ? ["Veg biryani with raita", "Sambar, rasam & curd rice", "Poriyal and kootu", veg < 0.8 ? "Chettinad chicken" : "Paneer butter masala", "Parotta with salna"] : ["Dal makhani", "Paneer lababdar", "Jeera rice", veg < 0.8 ? "Butter chicken" : "Veg kofta", "Assorted breads"] },
    { course: "Desserts", items: southIndian ? ["Elaneer payasam", "Gulab jamun", "Ice cream counter"] : ["Rasmalai", "Gajar halwa", "Kulfi counter"] },
  ];
  if (jain) menu.push({ course: "Jain counter", items: ["No onion-garlic dal", "Raw banana sabzi", "Plain rice and phulka"] });
  return { ...IDEAS[ev.type], menu, source: "offline" };
}

// ---------- Budget optimizer ----------

export interface BudgetSuggestion {
  id: string;
  title: string;
  detail: string;
  category: BudgetCategory;
  saving: number;
  action?: { type: "perPlate"; value: number } | { type: "removeTables"; kind: string; count: number };
}

export function offlineOptimize(ev: EventPlan, summary: BudgetSummary): BudgetSuggestion[] {
  const out: BudgetSuggestion[] = [];
  const layout = activeLayout(ev);
  const guests = summary.catering.guests;
  const cat = (c: BudgetCategory) => summary.categories.find((x) => x.category === c)!;

  if (summary.cateringFromEstimate && ev.budget.perPlate > 300) {
    const value = Math.round((ev.budget.perPlate * 0.88) / 10) * 10;
    out.push({ id: nanoid(6), title: `Trim per-plate cost to ₹${value}`, detail: "Swap one live counter for a dessert station and serve welcome drinks instead of mocktails.", category: "catering", saving: (ev.budget.perPlate - value) * guests, action: { type: "perPlate", value } });
  }
  const seats = totalSeats(layout);
  const tables = layout.elements.filter((e) => getDef(e.kind).category === "seating");
  if (tables.length && seats - guests >= 10) {
    const counts = new Map<string, number>();
    for (const t of tables) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
    const kind = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const per = seatCount(kind, getDef(kind).w);
    const count = Math.min(counts.get(kind)!, Math.floor((seats - guests) / per));
    if (count > 0)
      out.push({ id: nanoid(6), title: `Remove ${count} empty ${getDef(kind).label.toLowerCase()}${count > 1 ? "s" : ""}`, detail: `You have ${seats - guests} more seats than guests. Fewer tables also frees up floor space.`, category: "rentals", saving: count * unitCost(kind, ev.city), action: { type: "removeTables", kind, count } });
  }
  const decor = cat("decor");
  if (decor.committed > 0) out.push({ id: nanoid(6), title: "Reuse ceremony decor for the reception", detail: "Move florals and backdrops between functions and pick seasonal flowers. Most decorators agree to this if asked early.", category: "decor", saving: Math.round(decor.committed * 0.15) });
  const venue = cat("venue");
  if (venue.committed > 0 || venue.allocated > 0) out.push({ id: nanoid(6), title: "Ask for an off-peak or weekday rate", detail: "Venues often discount 20–30% outside peak muhurtham and weekend dates.", category: "venue", saving: Math.round(Math.max(venue.committed, venue.allocated) * 0.2) });
  if (layout.elements.some((e) => e.kind === "led-screen")) out.push({ id: nanoid(6), title: "Replace the LED wall with a projector", detail: "A 4K projector and screen covers most halls under 300 guests.", category: "entertainment", saving: Math.round(unitCost("led-screen", ev.city) * 0.6) });
  const photo = cat("photography");
  if (photo.committed > 150000) out.push({ id: nanoid(6), title: "Choose a highlights film instead of full coverage", detail: "Candid photos plus a 5-minute highlights film usually costs about 25% less.", category: "photography", saving: Math.round(photo.committed * 0.25) });
  const inv = cat("invitations");
  if (inv.allocated > 0) out.push({ id: nanoid(6), title: "Go digital with invitations", detail: "Send video e-invites on WhatsApp and print only for elders.", category: "invitations", saving: Math.round(inv.allocated * 0.6) });

  return out.filter((s) => s.saving > 0).sort((a, b) => b.saving - a.saving).slice(0, 6);
}

// ---------- Writer ----------

export type WriteKind = "invitation" | "welcome-speech" | "thank-you" | "whatsapp-reminder" | "vendor-enquiry";

export function offlineWrite(kind: WriteKind, ev: EventPlan, details: string): string {
  const date = new Date(`${ev.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const venue = activeLayout(ev).venue.name;
  switch (kind) {
    case "invitation":
      return `With joy in our hearts, we invite you to\n\n✨ ${ev.name} ✨\n\n📅 ${date}\n🕕 ${ev.startTime} onwards\n📍 ${venue}, ${ev.city}\n\nTheme: ${ev.theme}. Your presence will make the day complete.\n${details ? `\n${details}\n` : ""}\nKindly RSVP at the earliest.`;
    case "welcome-speech":
      return `Good evening everyone!\n\nOn behalf of the family, a very warm welcome to ${ev.name}. Many of you have travelled far, rearranged plans and brought so much love with you tonight, and that means the world to us.\n\n${details || "Tonight is about celebrating together, sharing a meal and making memories."}\n\nPlease enjoy the food, hit the dance floor, and don't forget to stop by the photo booth. Thank you for being here!`;
    case "thank-you":
      return `Dear friend,\n\nThank you for celebrating ${ev.name} with us on ${date}. Your blessings, laughter and presence made the day unforgettable.\n\n${details || "We're so grateful to have you in our lives."}\n\nWith love and gratitude.`;
    case "whatsapp-reminder":
      return `Hi! 👋 Gentle reminder for *${ev.name}* on *${date}* at *${ev.startTime}*.\n📍 ${venue}, ${ev.city}\n${details ? `\n${details}\n` : ""}\nPlease reply with your RSVP so we can plan seating and food. See you there! 🎉`;
    case "vendor-enquiry":
      return `Hello,\n\nWe are planning ${ev.name} (${ev.type}) on ${date} at ${venue}, ${ev.city}, for about ${ev.guestCount} guests.\n\n${details || "Could you please share your packages, availability and a detailed quote?"}\n\nPlease also mention advance terms and setup time needed. Looking forward to hearing from you.\n\nThanks!`;
  }
}
