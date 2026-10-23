import { nanoid } from "nanoid";
import type { Dietary, Guest, Rsvp } from "@/lib/types";

export const DIET_LABELS: Record<Dietary, string> = { veg: "🟢 Veg", "non-veg": "🔴 Non-veg", vegan: "🌱 Vegan", jain: "🟡 Jain" };

export const GUEST_CSV_TEMPLATE = [
  "name,group,side,phone,dietary,rsvp,vip,accessible,child",
  "Lakshmi Iyer,Iyer family,Bride,9840011111,veg,yes,yes,no,no",
  "Karthik Menon,Menon family,Groom,9840022222,non-veg,pending,no,no,no",
  "",
].join("\n");

export function blankGuest(): Guest {
  return {
    id: nanoid(8),
    name: "",
    group: "",
    side: "",
    dietary: "veg",
    rsvp: "pending",
    vip: false,
    accessible: false,
    child: false,
    checkedIn: false,
  };
}

const isYes = (v: string) => /^(y|yes|true|1)$/i.test(v);

function toDietary(v: string): Dietary {
  const s = v.toLowerCase();
  if (s.includes("non")) return "non-veg";
  if (s.includes("vegan")) return "vegan";
  if (s.includes("jain")) return "jain";
  return "veg";
}

function toRsvp(v: string): Rsvp {
  const s = v.toLowerCase();
  return s === "yes" || s === "no" || s === "maybe" ? s : "pending";
}

/**
 * Turns spreadsheet rows into guests. Column names are matched loosely
 * ("Full name", "Family", "WhatsApp", "Wheelchair"…) and rows without a name are skipped.
 */
export function parseGuestRows(rows: Record<string, string>[]): Guest[] {
  return rows
    .map((row) => {
      const pick = (...keys: string[]) => {
        const k = Object.keys(row).find((x) => keys.includes(x.trim().toLowerCase()));
        return k ? (row[k]?.trim() ?? "") : "";
      };
      return {
        ...blankGuest(),
        name: pick("name", "guest", "full name"),
        group: pick("group", "family", "household"),
        side: pick("side"),
        phone: pick("phone", "mobile", "whatsapp"),
        dietary: toDietary(pick("dietary", "diet", "food")),
        rsvp: toRsvp(pick("rsvp", "status")),
        vip: isYes(pick("vip")),
        accessible: isYes(pick("accessible", "wheelchair")),
        child: isYes(pick("child", "kid")),
      };
    })
    .filter((g) => g.name);
}
