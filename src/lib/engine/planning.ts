import { nanoid } from "nanoid";
import { getDef } from "@/lib/catalog/elements";
import { BOOKED_STATUSES, ESSENTIAL_VENDORS, VENDOR_CATEGORIES } from "@/lib/catalog/planning";
import type { EventPlan, EventType, Layout, ScheduleItem, Task, Vendor, VendorCategory } from "@/lib/types";
import { daysUntil, shiftDate, toIsoDate } from "./costs";

// ---------- Vendor checklist ----------

export interface ChecklistItem {
  category: VendorCategory;
  label: string;
  emoji: string;
  reasons: string[];
  essential: boolean;
  vendors: Vendor[];
  status: "missing" | "in-progress" | "booked";
}

export function vendorChecklist(ev: EventPlan, layout: Layout): ChecklistItem[] {
  const reasons = new Map<VendorCategory, { essential: boolean; reasons: string[] }>();
  const add = (cat: VendorCategory, reason: string, essential: boolean) => {
    const r = reasons.get(cat) ?? { essential: false, reasons: [] };
    r.essential ||= essential;
    if (!r.reasons.includes(reason)) r.reasons.push(reason);
    reasons.set(cat, r);
  };
  for (const cat of ESSENTIAL_VENDORS[ev.type]) add(cat, `${cap(ev.type)} essential`, true);
  for (const el of layout.elements) {
    const def = getDef(el.kind);
    if (def.vendor) add(def.vendor, `You placed a ${def.label.toLowerCase()}`, false);
    if (el.kind === "mandap") add("priest", "Mandap needs an officiant", false);
  }
  if (ev.type === "wedding" && /tamil|south|hindu|indian/i.test(`${ev.theme} ${ev.notes}`)) add("mehendi", "Traditional ceremony", false);
  if (!layout.venue.indoor && !layout.elements.some((e) => e.kind === "generator")) add("power", "Outdoor venue backup", false);
  for (const v of ev.vendors) if (!reasons.has(v.category)) add(v.category, "Added by you", false);

  return [...reasons.entries()]
    .map(([category, r]) => {
      const vendors = ev.vendors.filter((v) => v.category === category);
      const status: ChecklistItem["status"] = vendors.some((v) => BOOKED_STATUSES.includes(v.status))
        ? "booked"
        : vendors.length
          ? "in-progress"
          : "missing";
      return {
        category,
        label: VENDOR_CATEGORIES[category].label,
        emoji: VENDOR_CATEGORIES[category].emoji,
        reasons: r.reasons,
        essential: r.essential,
        vendors,
        status,
      };
    })
    .sort((a, b) => Number(b.essential) - Number(a.essential) || order(a.status) - order(b.status));
}

const order = (s: ChecklistItem["status"]) => ({ missing: 0, "in-progress": 1, booked: 2 })[s];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Planning countdown ----------

const TASKS: Record<EventType, [number, string][]> = {
  wedding: [
    [180, "Fix the wedding date with both families"],
    [170, "Set the total budget and who contributes"],
    [160, "Shortlist and book the venue"],
    [150, "Book caterer and schedule a food tasting"],
    [140, "Book photographer and videographer"],
    [120, "Finalise decorator and theme"],
    [110, "Book priest / officiant and confirm muhurtham"],
    [100, "Shop for wedding attire and jewellery"],
    [90, "Draft the guest list with both families"],
    [75, "Design invitations and save-the-dates"],
    [60, "Send invitations and open RSVPs"],
    [50, "Book makeup and mehendi artists"],
    [45, "Book DJ / music and plan the sangeet"],
    [40, "Arrange guest transport and accommodation"],
    [30, "Confirm all vendor contracts and advances"],
    [21, "Finalise the menu and dietary counts"],
    [14, "Lock final head-count and send to caterer"],
    [10, "Finalise seating plan on the blueprint"],
    [7, "Share run-of-show with vendors and family"],
    [5, "Final attire fittings"],
    [3, "Confirm vendor arrival times"],
    [2, "Prepare payment envelopes for vendors"],
    [1, "Venue walkthrough and decor setup"],
    [-3, "Settle balance payments"],
    [-7, "Send thank-you notes"],
  ],
  birthday: [
    [45, "Pick the theme and set a budget"],
    [40, "Book the venue"],
    [35, "Draft the guest list"],
    [30, "Book caterer and order the cake"],
    [28, "Send invitations"],
    [21, "Book entertainer / games host"],
    [18, "Order decor and return gifts"],
    [14, "Book photographer"],
    [10, "Follow up on RSVPs"],
    [7, "Confirm menu and head-count"],
    [5, "Plan games and music playlist"],
    [3, "Confirm vendor timings"],
    [1, "Decorate the venue"],
    [-2, "Share photos and thank guests"],
  ],
  community: [
    [90, "Form the organising committee"],
    [85, "Set budget and sponsorship targets"],
    [80, "Book venue and apply for permissions"],
    [70, "Approach sponsors"],
    [60, "Book sound, lights and stage"],
    [50, "Line up performers and speakers"],
    [45, "Open registrations / seat booking"],
    [40, "Book caterer"],
    [30, "Recruit and brief volunteers"],
    [21, "Promote on WhatsApp groups and social media"],
    [14, "Print banners, passes and signage"],
    [10, "Finalise programme schedule"],
    [7, "Confirm police / fire safety clearances"],
    [3, "Volunteer roles and walkie-talkie plan"],
    [1, "Setup, sound check and rehearsal"],
    [-2, "Thank sponsors and volunteers"],
    [-7, "Publish accounts to the community"],
  ],
  corporate: [
    [75, "Define goals, audience and budget"],
    [70, "Book venue"],
    [60, "Confirm speakers and agenda"],
    [50, "Book AV, stage and LED"],
    [45, "Send invitations and registration link"],
    [40, "Book caterer"],
    [30, "Design branding, badges and backdrop"],
    [21, "Order corporate gifts"],
    [14, "Rehearse with speakers"],
    [7, "Final head-count to venue"],
    [3, "Print badges and signage"],
    [1, "AV check and venue setup"],
    [-2, "Send feedback survey"],
  ],
};

function phaseFor(days: number) {
  if (days < 0) return "Wrap-up";
  if (days <= 6) return "Event week";
  if (days <= 20) return "Final stretch";
  if (days <= 59) return "Details & invites";
  if (days <= 119) return "Book vendors";
  return "Big decisions";
}

export const PHASES = ["Big decisions", "Book vendors", "Details & invites", "Final stretch", "Event week", "Wrap-up"];

export function generateTasks(ev: Pick<EventPlan, "type" | "date">, today = new Date()): Task[] {
  const templates = TASKS[ev.type];
  const daysLeft = Math.max(1, daysUntil(ev.date, today));
  const maxBefore = Math.max(...templates.map(([d]) => d));
  const scale = daysLeft < maxBefore ? daysLeft / maxBefore : 1;
  const todayIso = toIsoDate(today);
  return templates.map(([before, title]) => {
    const scaled = before > 0 ? Math.round(before * scale) : before;
    let due = shiftDate(ev.date, -scaled);
    if (due < todayIso) due = todayIso;
    return { id: nanoid(8), title, dueDate: due, phase: phaseFor(scaled), done: false };
  });
}

// ---------- Run of show ----------

type Slot = [offsetMin: number, durationMin: number, title: string, elementKind?: string, vendors?: VendorCategory[]];

const SCHEDULE: Record<EventType, Slot[]> = {
  wedding: [
    [-240, 120, "Decor, florals and stage setup", "stage", ["decor", "florist"]],
    [-120, 45, "Sound check and lighting test", "dj-booth", ["dj", "av"]],
    [-60, 45, "Catering setup and food check", "buffet", ["catering"]],
    [-30, 30, "Photographer briefing, family portraits", "photo-booth", ["photography"]],
    [0, 45, "Guests arrive, welcome drinks", "entry", []],
    [45, 15, "Couple's grand entry", "stage", ["dj", "photography"]],
    [60, 60, "Ceremony and rituals", "mandap", ["priest"]],
    [120, 90, "Dinner buffet opens", "buffet", ["catering"]],
    [150, 20, "Speeches and toasts", "stage", ["emcee"]],
    [180, 15, "Cake cutting", "cake-table", ["bakery"]],
    [195, 90, "Dance floor opens", "dance-floor", ["dj"]],
    [285, 20, "Send-off and return gifts", "gift-table", []],
    [310, 60, "Teardown and vendor wrap-up", undefined, ["decor", "rentals"]],
  ],
  birthday: [
    [-120, 90, "Decor and balloon setup", "stage", ["decor"]],
    [-45, 30, "Music and sound check", "dj-booth", ["dj"]],
    [0, 30, "Guests arrive", "entry", []],
    [30, 60, "Games and kids activities", "kids-zone", ["entertainment"]],
    [90, 15, "Cake cutting", "cake-table", ["bakery", "photography"]],
    [105, 60, "Dinner", "buffet", ["catering"]],
    [120, 60, "Photo booth and dance", "photo-booth", ["photography", "dj"]],
    [180, 20, "Return gifts and goodbyes", "gift-table", []],
  ],
  community: [
    [-180, 120, "Tents, chairs and stage setup", "stage", ["rentals", "decor"]],
    [-90, 45, "AV and LED check", "led-screen", ["av"]],
    [-30, 30, "Volunteer briefing", "registration", []],
    [0, 30, "Registration opens", "registration", []],
    [30, 20, "Inauguration and welcome address", "stage", ["emcee"]],
    [50, 90, "Cultural programme and performances", "stage", ["av", "emcee"]],
    [140, 60, "Food service", "buffet", ["catering"]],
    [200, 20, "Prize distribution and vote of thanks", "stage", ["emcee"]],
    [220, 60, "Cleanup", undefined, ["rentals"]],
  ],
  corporate: [
    [-120, 90, "Venue, branding and AV setup", "stage", ["av", "decor"]],
    [0, 30, "Registration and networking", "registration", []],
    [30, 45, "Keynote", "stage", ["av"]],
    [75, 45, "Panel discussion", "stage", ["emcee"]],
    [120, 60, "Lunch / dinner", "buffet", ["catering"]],
    [180, 30, "Awards and recognition", "stage", ["photography"]],
    [210, 45, "Networking and close", "bar", ["catering"]],
  ],
};

export function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function generateSchedule(ev: Pick<EventPlan, "type" | "startTime" | "vendors">, layout?: Layout): ScheduleItem[] {
  const kinds = new Set(layout?.elements.map((e) => e.kind) ?? []);
  return SCHEDULE[ev.type]
    .filter(([, , , kind]) => !(kind === "mandap" && layout && !kinds.has("mandap") && !kinds.has("stage")))
    .map(([offset, duration, title, kind, cats]) => ({
      id: nanoid(8),
      time: addMinutes(ev.startTime, offset),
      durationMin: duration,
      title,
      elementKind: kind === "mandap" && layout && !kinds.has("mandap") ? "stage" : kind,
      vendorIds: ev.vendors.filter((v) => cats?.includes(v.category)).map((v) => v.id),
    }));
}

/** Suggested vendor arrival = earliest schedule slot they're part of, minus 30 min. */
export function vendorArrival(ev: EventPlan, vendorId: string): string | undefined {
  const slots = ev.schedule.filter((s) => s.vendorIds.includes(vendorId)).sort((a, b) => sortKey(ev, a.time) - sortKey(ev, b.time));
  return slots[0] ? addMinutes(slots[0].time, -30) : undefined;
}

/** Sort key that keeps pre-start setup slots (e.g. 14:00 for an 18:00 start) before the event, even across midnight. */
export function sortKey(ev: Pick<EventPlan, "startTime">, hhmm: string) {
  const start = minutesOf(ev.startTime);
  let m = minutesOf(hhmm) - start;
  if (m < -600) m += 1440;
  if (m > 840) m -= 1440;
  return m;
}
