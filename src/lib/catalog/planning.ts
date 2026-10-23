import type { BudgetCategory, EventType, VendorCategory, VendorStatus, ZoneKind } from "@/lib/types";

export const EVENT_TYPES: Record<EventType, { label: string; emoji: string; blurb: string }> = {
  wedding: { label: "Wedding", emoji: "💍", blurb: "Ceremony, reception and every ritual in between" },
  birthday: { label: "Birthday", emoji: "🎂", blurb: "From first birthdays to milestone parties" },
  community: { label: "Community", emoji: "🪔", blurb: "Festivals, fundraisers, cultural nights" },
  corporate: { label: "Corporate", emoji: "🏢", blurb: "Offsites, launches, award nights" },
};

export const BUDGET_CATEGORIES: Record<BudgetCategory, { label: string; color: string }> = {
  venue: { label: "Venue", color: "#e11d48" },
  catering: { label: "Catering", color: "#f59e0b" },
  decor: { label: "Decor & florals", color: "#db2777" },
  rentals: { label: "Rentals (from blueprint)", color: "#ea580c" },
  photography: { label: "Photo & video", color: "#7c3aed" },
  entertainment: { label: "Music & entertainment", color: "#0891b2" },
  attire: { label: "Attire & makeup", color: "#c026d3" },
  invitations: { label: "Invitations", color: "#4f46e5" },
  gifts: { label: "Gifts & favors", color: "#16a34a" },
  logistics: { label: "Transport & logistics", color: "#0284c7" },
  misc: { label: "Contingency", color: "#78716c" },
};

/** Default budget split (percent) per event type. Each row sums to 100. */
export const DEFAULT_SPLIT: Record<EventType, Partial<Record<BudgetCategory, number>>> = {
  wedding: {
    venue: 18,
    catering: 30,
    decor: 14,
    rentals: 5,
    photography: 10,
    entertainment: 5,
    attire: 8,
    invitations: 2,
    gifts: 3,
    logistics: 2,
    misc: 3,
  },
  birthday: { venue: 20, catering: 35, decor: 15, rentals: 5, photography: 8, entertainment: 10, invitations: 2, gifts: 3, misc: 2 },
  community: {
    venue: 15,
    catering: 30,
    decor: 8,
    rentals: 15,
    photography: 5,
    entertainment: 12,
    invitations: 3,
    gifts: 2,
    logistics: 5,
    misc: 5,
  },
  corporate: {
    venue: 25,
    catering: 30,
    decor: 8,
    rentals: 10,
    photography: 6,
    entertainment: 8,
    invitations: 3,
    gifts: 5,
    logistics: 3,
    misc: 2,
  },
};

export const VENDOR_CATEGORIES: Record<VendorCategory, { label: string; emoji: string; budget: BudgetCategory }> = {
  venue: { label: "Venue", emoji: "🏛️", budget: "venue" },
  catering: { label: "Caterer", emoji: "🍛", budget: "catering" },
  decor: { label: "Decorator", emoji: "🎀", budget: "decor" },
  photography: { label: "Photo & video", emoji: "📸", budget: "photography" },
  dj: { label: "DJ & music", emoji: "🎧", budget: "entertainment" },
  av: { label: "Sound & lighting", emoji: "🔊", budget: "entertainment" },
  bakery: { label: "Cake & bakery", emoji: "🎂", budget: "catering" },
  florist: { label: "Florist", emoji: "💐", budget: "decor" },
  mehendi: { label: "Mehendi artist", emoji: "🌿", budget: "attire" },
  makeup: { label: "Makeup artist", emoji: "💄", budget: "attire" },
  priest: { label: "Priest / officiant", emoji: "🪔", budget: "misc" },
  invitations: { label: "Invitations & print", emoji: "💌", budget: "invitations" },
  transport: { label: "Transport", emoji: "🚐", budget: "logistics" },
  rentals: { label: "Tent & furniture", emoji: "⛺", budget: "rentals" },
  entertainment: { label: "Entertainers", emoji: "🎭", budget: "entertainment" },
  power: { label: "Power backup", emoji: "⚡", budget: "logistics" },
  security: { label: "Security & valet", emoji: "🛡️", budget: "logistics" },
  attire: { label: "Attire & tailoring", emoji: "👗", budget: "attire" },
  emcee: { label: "Anchor / emcee", emoji: "🎙️", budget: "entertainment" },
};

export const ESSENTIAL_VENDORS: Record<EventType, VendorCategory[]> = {
  wedding: ["venue", "catering", "decor", "photography", "makeup", "priest", "florist", "invitations", "attire", "dj", "transport"],
  birthday: ["venue", "catering", "bakery", "decor", "photography", "entertainment"],
  community: ["venue", "catering", "av", "rentals", "security", "decor", "emcee"],
  corporate: ["venue", "catering", "av", "photography", "decor", "emcee"],
};

export const VENDOR_STATUSES: { id: VendorStatus; label: string; color: string }[] = [
  { id: "todo", label: "To contact", color: "#a8a29e" },
  { id: "contacted", label: "Contacted", color: "#0ea5e9" },
  { id: "quoted", label: "Quoted", color: "#f59e0b" },
  { id: "booked", label: "Booked", color: "#8b5cf6" },
  { id: "paid", label: "Paid", color: "#16a34a" },
  { id: "delivered", label: "Delivered", color: "#15803d" },
];

/** Statuses at which a vendor's quote counts as committed spend */
export const COMMITTED_STATUSES: VendorStatus[] = ["quoted", "booked", "paid", "delivered"];
export const BOOKED_STATUSES: VendorStatus[] = ["booked", "paid", "delivered"];

export const ZONE_KINDS: Record<ZoneKind, { label: string; color: string }> = {
  ceremony: { label: "Ceremony / stage", color: "#ec4899" },
  dining: { label: "Dining", color: "#f97316" },
  dance: { label: "Dance", color: "#8b5cf6" },
  vip: { label: "VIP", color: "#eab308" },
  kids: { label: "Kids", color: "#22c55e" },
  service: { label: "Service", color: "#0ea5e9" },
  lounge: { label: "Lounge", color: "#14b8a6" },
  custom: { label: "Custom", color: "#64748b" },
};

const TIER1 = [
  "mumbai",
  "delhi",
  "new delhi",
  "bengaluru",
  "bangalore",
  "chennai",
  "hyderabad",
  "kolkata",
  "pune",
  "gurgaon",
  "gurugram",
  "noida",
];
const TIER2 = [
  "coimbatore",
  "madurai",
  "jaipur",
  "kochi",
  "cochin",
  "lucknow",
  "ahmedabad",
  "chandigarh",
  "indore",
  "nagpur",
  "surat",
  "visakhapatnam",
  "vizag",
  "trichy",
  "tiruchirappalli",
  "mysuru",
  "mysore",
  "bhopal",
  "vadodara",
  "thiruvananthapuram",
  "trivandrum",
  "salem",
  "goa",
  "mangaluru",
  "mangalore",
  "tirunelveli",
  "vellore",
  "erode",
  "pondicherry",
  "puducherry",
];

export function cityTier(city: string): 1 | 2 | 3 {
  const c = city.trim().toLowerCase();
  if (TIER1.some((t) => c.includes(t))) return 1;
  if (TIER2.some((t) => c.includes(t))) return 2;
  return 3;
}

export function tierMultiplier(city: string) {
  return { 1: 1, 2: 0.8, 3: 0.65 }[cityTier(city)];
}

/** Tier-1 per-plate catering baseline in INR */
const PER_PLATE_BASE: Record<EventType, number> = { wedding: 900, birthday: 600, community: 350, corporate: 800 };

export function defaultPerPlate(type: EventType, city: string) {
  return Math.round((PER_PLATE_BASE[type] * tierMultiplier(city)) / 10) * 10;
}

export const KNOWN_CITIES = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Bengaluru",
  "Hyderabad",
  "Mumbai",
  "Delhi",
  "Kolkata",
  "Pune",
  "Kochi",
  "Trichy",
  "Salem",
  "Jaipur",
  "Ahmedabad",
  "Lucknow",
  "Mysuru",
  "Goa",
  "Vellore",
  "Erode",
  "Puducherry",
];
