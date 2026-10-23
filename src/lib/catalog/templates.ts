import type { Venue } from "@/lib/types";

export interface Fixture {
  kind: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
}

export interface VenueTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  venue: Venue;
  fixtures: Fixture[];
}

/** Fixed parts of each venue (walls, doors, restrooms). Furniture is added by the auto-layout engine. */
export const VENUE_TEMPLATES: VenueTemplate[] = [
  {
    id: "banquet",
    name: "Banquet hall",
    emoji: "🏛️",
    description: "100 × 80 ft air-conditioned hall with pillars",
    venue: { name: "Banquet hall", widthFt: 100, lengthFt: 80, indoor: true, templateId: "banquet" },
    fixtures: [
      { kind: "entry", x: 44, y: 77, label: "Main entry" },
      { kind: "exit", x: 0, y: 52, w: 2, h: 6, label: "Exit A" },
      { kind: "exit", x: 98, y: 52, w: 2, h: 6, label: "Exit B" },
      { kind: "kitchen", x: 0, y: 0, label: "Kitchen" },
      { kind: "restroom", x: 90, y: 0, label: "Restrooms" },
      { kind: "pillar", x: 25, y: 30 },
      { kind: "pillar", x: 73, y: 30 },
    ],
  },
  {
    id: "lawn",
    name: "Garden lawn",
    emoji: "🌳",
    description: "130 × 100 ft open-air lawn",
    venue: { name: "Garden lawn", widthFt: 130, lengthFt: 100, indoor: false, templateId: "lawn" },
    fixtures: [
      { kind: "entry", x: 59, y: 97, label: "Main gate" },
      { kind: "exit", x: 0, y: 60, w: 2, h: 6, label: "Side gate A" },
      { kind: "exit", x: 128, y: 60, w: 2, h: 6, label: "Side gate B" },
      { kind: "kitchen", x: 0, y: 0, label: "Catering tent" },
      { kind: "restroom", x: 120, y: 0, label: "Restrooms" },
    ],
  },
  {
    id: "community-hall",
    name: "Community hall",
    emoji: "🏘️",
    description: "80 × 55 ft multipurpose hall",
    venue: { name: "Community hall", widthFt: 80, lengthFt: 55, indoor: true, templateId: "community-hall" },
    fixtures: [
      { kind: "entry", x: 34, y: 52, label: "Main door" },
      { kind: "exit", x: 0, y: 34, w: 2, h: 6, label: "Exit A" },
      { kind: "exit", x: 78, y: 34, w: 2, h: 6, label: "Exit B" },
      { kind: "kitchen", x: 0, y: 0, label: "Pantry" },
      { kind: "restroom", x: 70, y: 0, label: "Restrooms" },
    ],
  },
  {
    id: "auditorium",
    name: "Auditorium",
    emoji: "🎭",
    description: "90 × 80 ft hall for shows and talks",
    venue: { name: "Auditorium", widthFt: 90, lengthFt: 80, indoor: true, templateId: "auditorium" },
    fixtures: [
      { kind: "entry", x: 39, y: 77, label: "Main entry" },
      { kind: "exit", x: 0, y: 20, w: 2, h: 6, label: "Exit A" },
      { kind: "exit", x: 88, y: 20, w: 2, h: 6, label: "Exit B" },
      { kind: "exit", x: 0, y: 60, w: 2, h: 6, label: "Exit C" },
      { kind: "exit", x: 88, y: 60, w: 2, h: 6, label: "Exit D" },
      { kind: "restroom", x: 80, y: 70, label: "Restrooms" },
    ],
  },
  {
    id: "terrace",
    name: "Rooftop terrace",
    emoji: "🌇",
    description: "60 × 45 ft open terrace",
    venue: { name: "Rooftop terrace", widthFt: 60, lengthFt: 45, indoor: false, templateId: "terrace" },
    fixtures: [
      { kind: "entry", x: 4, y: 42, label: "Stairs / lift" },
      { kind: "exit", x: 58, y: 20, w: 2, h: 6, label: "Fire exit" },
    ],
  },
  {
    id: "home",
    name: "Home / villa",
    emoji: "🏡",
    description: "40 × 30 ft living space",
    venue: { name: "Home", widthFt: 40, lengthFt: 30, indoor: true, templateId: "home" },
    fixtures: [
      { kind: "entry", x: 2, y: 27, label: "Front door" },
      { kind: "exit", x: 38, y: 12, w: 2, h: 6, label: "Back door" },
    ],
  },
];

export function getTemplate(id: string | undefined) {
  return VENUE_TEMPLATES.find((t) => t.id === id) ?? VENUE_TEMPLATES[0];
}

/** Picks a sensible default venue for an event size and type. */
export function suggestTemplate(guestCount: number, type: string): VenueTemplate {
  if (type === "community" && guestCount > 150) return getTemplate("auditorium");
  if (guestCount <= 30) return getTemplate("home");
  if (guestCount <= 70) return getTemplate("terrace");
  if (guestCount <= 160) return getTemplate(type === "community" ? "community-hall" : "banquet");
  if (guestCount <= 260) return getTemplate("banquet");
  return getTemplate("lawn");
}
