import type { VendorCategory } from "@/lib/types";

export type ElementCategory = "seating" | "stage" | "food" | "fun" | "facility" | "structure";
/** round = chairs around a circle, rect = chairs on both long sides, rows = seats inside the shape */
export type ElementShape = "round" | "rect" | "rows" | "block";

export interface ElementDef {
  kind: string;
  label: string;
  emoji: string;
  category: ElementCategory;
  shape: ElementShape;
  w: number;
  h: number;
  /** fixed seat count for round tables; rect/rows derive seats from width */
  seats?: number;
  /** rental/setup cost per unit in INR for tier-1 cities */
  cost: number;
  vendor?: VendorCategory;
  isEntry?: boolean;
  isExit?: boolean;
  /** can sit on top of / against other items (speakers on a stage, plants by a wall) */
  overlay?: boolean;
  keepRatio?: boolean;
}

export const CATEGORY_STYLE: Record<ElementCategory, { label: string; fill: string; stroke: string }> = {
  seating: { label: "Seating", fill: "#fff7ed", stroke: "#ea580c" },
  stage: { label: "Stage & music", fill: "#fdf2f8", stroke: "#db2777" },
  food: { label: "Food & drinks", fill: "#f7fee7", stroke: "#65a30d" },
  fun: { label: "Experiences", fill: "#f5f3ff", stroke: "#7c3aed" },
  facility: { label: "Facilities", fill: "#f0f9ff", stroke: "#0284c7" },
  structure: { label: "Structure & decor", fill: "#f5f5f4", stroke: "#78716c" },
};

export const ELEMENTS: ElementDef[] = [
  { kind: "round-6", label: "Round table · 6", emoji: "🍽️", category: "seating", shape: "round", w: 5, h: 5, seats: 6, cost: 900, keepRatio: true },
  { kind: "round-8", label: "Round table · 8", emoji: "🍽️", category: "seating", shape: "round", w: 6, h: 6, seats: 8, cost: 1200, keepRatio: true },
  { kind: "round-10", label: "Round table · 10", emoji: "🍽️", category: "seating", shape: "round", w: 7, h: 7, seats: 10, cost: 1500, keepRatio: true },
  { kind: "rect-6", label: "Rect table · 6", emoji: "🪑", category: "seating", shape: "rect", w: 6, h: 3, cost: 800 },
  { kind: "banquet-12", label: "Banquet table · 12", emoji: "🪑", category: "seating", shape: "rect", w: 12, h: 3, cost: 1600 },
  { kind: "chair-row", label: "Chair row · 10", emoji: "💺", category: "seating", shape: "rows", w: 20, h: 2, cost: 500 },
  { kind: "sofa", label: "Lounge sofa", emoji: "🛋️", category: "seating", shape: "rows", w: 7, h: 3, cost: 2500 },

  { kind: "stage", label: "Stage", emoji: "🎤", category: "stage", shape: "block", w: 24, h: 12, cost: 25000, vendor: "decor" },
  { kind: "mandap", label: "Mandap", emoji: "🪔", category: "stage", shape: "block", w: 14, h: 14, cost: 60000, vendor: "decor" },
  { kind: "dance-floor", label: "Dance floor", emoji: "💃", category: "stage", shape: "block", w: 20, h: 20, cost: 15000, vendor: "dj" },
  { kind: "dj-booth", label: "DJ booth", emoji: "🎧", category: "stage", shape: "block", w: 8, h: 4, cost: 3000, vendor: "dj" },
  { kind: "led-screen", label: "LED screen", emoji: "📺", category: "stage", shape: "block", w: 12, h: 2, cost: 18000, vendor: "av", overlay: true },
  { kind: "speaker", label: "Speaker", emoji: "🔊", category: "stage", shape: "block", w: 2, h: 2, cost: 2500, vendor: "av", overlay: true },

  { kind: "buffet", label: "Buffet counter", emoji: "🍛", category: "food", shape: "block", w: 20, h: 4, cost: 6000, vendor: "catering" },
  { kind: "bar", label: "Beverage bar", emoji: "🍹", category: "food", shape: "block", w: 10, h: 4, cost: 8000, vendor: "catering" },
  { kind: "cake-table", label: "Cake table", emoji: "🎂", category: "food", shape: "block", w: 5, h: 3, cost: 1500, vendor: "bakery" },
  { kind: "kitchen", label: "Kitchen / prep", emoji: "🍳", category: "food", shape: "block", w: 16, h: 10, cost: 0 },

  { kind: "photo-booth", label: "Photo booth", emoji: "📸", category: "fun", shape: "block", w: 8, h: 8, cost: 12000, vendor: "photography" },
  { kind: "kids-zone", label: "Kids zone", emoji: "🧸", category: "fun", shape: "block", w: 15, h: 15, cost: 10000, vendor: "entertainment" },
  { kind: "gift-table", label: "Gift table", emoji: "🎁", category: "fun", shape: "block", w: 6, h: 3, cost: 800 },

  { kind: "entry", label: "Entry arch", emoji: "🚪", category: "facility", shape: "block", w: 12, h: 3, cost: 8000, vendor: "decor", isEntry: true },
  { kind: "exit", label: "Emergency exit", emoji: "🟩", category: "facility", shape: "block", w: 6, h: 2, cost: 0, isExit: true },
  { kind: "registration", label: "Registration desk", emoji: "📝", category: "facility", shape: "block", w: 8, h: 3, cost: 1500 },
  { kind: "restroom", label: "Restrooms", emoji: "🚻", category: "facility", shape: "block", w: 10, h: 8, cost: 0 },
  { kind: "ramp", label: "Wheelchair ramp", emoji: "♿", category: "facility", shape: "block", w: 6, h: 4, cost: 1500 },
  { kind: "generator", label: "Generator", emoji: "⚡", category: "facility", shape: "block", w: 6, h: 4, cost: 9000, vendor: "power" },

  { kind: "pillar", label: "Pillar", emoji: "", category: "structure", shape: "block", w: 2, h: 2, cost: 0, keepRatio: true },
  { kind: "wall", label: "Wall", emoji: "", category: "structure", shape: "block", w: 12, h: 1, cost: 0 },
  { kind: "plant", label: "Plants / florals", emoji: "🌿", category: "structure", shape: "block", w: 3, h: 3, cost: 700, vendor: "florist", overlay: true },
];

const BY_KIND = new Map(ELEMENTS.map((d) => [d.kind, d]));

export function getDef(kind: string): ElementDef {
  return BY_KIND.get(kind) ?? { kind, label: kind, emoji: "▫️", category: "structure", shape: "block", w: 4, h: 4, cost: 0 };
}

export function isSeating(kind: string) {
  return getDef(kind).category === "seating";
}

/** Seat count for an element of the given size (rect/rows grow with width; round tables are fixed). */
export function seatCount(kind: string, w: number): number {
  const def = getDef(kind);
  if (def.category !== "seating") return 0;
  if (def.shape === "round") return def.seats ?? 8;
  if (def.shape === "rect") return 2 * Math.max(1, Math.floor(w / 2));
  return Math.max(1, Math.floor(w / 2));
}

/** Extra clearance chairs take around a table, in feet. */
export function chairRing(kind: string): number {
  const shape = getDef(kind).shape;
  return shape === "round" || shape === "rect" ? 2 : 0;
}

export const TABLE_KINDS = ["round-6", "round-8", "round-10", "rect-6", "banquet-12", "chair-row"] as const;
export type TableKind = (typeof TABLE_KINDS)[number];
