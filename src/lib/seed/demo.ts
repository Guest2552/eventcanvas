import { nanoid } from "nanoid";
import { vipSeatIds } from "@/lib/booking";
import { activeLayout, shiftDate, toIsoDate } from "@/lib/engine/costs";
import { createEventPlan } from "@/lib/engine/factory";
import { buildLayout } from "@/lib/engine/factory";
import { allSeats } from "@/lib/engine/geometry";
import { generateSchedule, vendorArrival } from "@/lib/engine/planning";
import { autoSeat } from "@/lib/engine/seating";
import type { Dietary, EventPlan, Guest, Rsvp, Vendor } from "@/lib/types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEMALE = [
  "Lakshmi",
  "Meena",
  "Kavya",
  "Divya",
  "Anitha",
  "Revathi",
  "Sowmya",
  "Priyanka",
  "Janani",
  "Deepa",
  "Nithya",
  "Swathi",
  "Harini",
  "Gayathri",
  "Shalini",
  "Aishwarya",
  "Keerthana",
  "Bhavani",
  "Pooja",
  "Sneha",
  "Radha",
  "Uma",
  "Vidya",
  "Ramya",
];
const MALE = [
  "Karthik",
  "Suresh",
  "Ramesh",
  "Vignesh",
  "Arun",
  "Prakash",
  "Senthil",
  "Gopal",
  "Rajesh",
  "Balaji",
  "Hari",
  "Naveen",
  "Ashwin",
  "Dinesh",
  "Mohan",
  "Vivek",
  "Siddharth",
  "Ganesh",
  "Kumar",
  "Ravi",
  "Anand",
  "Murali",
  "Shankar",
  "Varun",
];
const KIDS = ["Aadhya", "Ishaan", "Diya", "Advik", "Tara", "Kabir", "Anika", "Vihaan", "Myra", "Aarav", "Saanvi", "Reyansh"];
const SURNAMES = [
  "Iyer",
  "Subramanian",
  "Krishnan",
  "Venkatesh",
  "Raman",
  "Natarajan",
  "Menon",
  "Pillai",
  "Nair",
  "Reddy",
  "Rao",
  "Chandran",
  "Sharma",
  "Joseph",
  "Rajan",
  "Mani",
];

export function createDemoWedding(today = new Date()): EventPlan {
  const r = rng(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const date = shiftDate(toIsoDate(today), 50);
  const ev = createEventPlan(
    {
      name: "Priya & Arjun's Wedding Reception",
      type: "wedding",
      date,
      startTime: "18:00",
      city: "Coimbatore",
      guestCount: 165,
      budgetTotal: 1200000,
      theme: "Marigold & Ivory",
      notes: "Tamil Hindu wedding reception. Elders from both families travelling from Madurai and Kochi.",
      templateId: "banquet",
    },
    today,
  );

  const groups: [string, string, number, boolean][] = [
    ["Iyer family", "Bride", 8, true],
    ["Subramanian family", "Bride", 7, false],
    ["Krishnan family", "Bride", 6, false],
    ["Venkatesh family", "Bride", 9, false],
    ["Raman family", "Bride", 5, false],
    ["Natarajan family", "Bride", 7, false],
    ["Menon family", "Groom", 8, true],
    ["Pillai family", "Groom", 6, false],
    ["Nair family", "Groom", 7, false],
    ["Reddy family", "Groom", 5, false],
    ["Chandran family", "Groom", 6, false],
    ["Joseph family", "Groom", 7, false],
    ["Priya's college friends", "Bride", 14, false],
    ["Priya's office", "Bride", 12, false],
    ["Arjun's school friends", "Groom", 13, false],
    ["Arjun's office", "Groom", 12, false],
    ["Bride neighbours", "Bride", 10, false],
    ["Groom neighbours", "Groom", 9, false],
    ["Temple committee", "Bride", 6, false],
    ["Family elders", "Both", 8, true],
  ];

  const guests: Guest[] = [];
  const dietary = (): Dietary => {
    const x = r();
    return x < 0.64 ? "veg" : x < 0.94 ? "non-veg" : x < 0.97 ? "jain" : "vegan";
  };
  const rsvp = (): Rsvp => {
    const x = r();
    return x < 0.74 ? "yes" : x < 0.89 ? "pending" : x < 0.96 ? "maybe" : "no";
  };
  for (const [group, side, size, vip] of groups) {
    const family = group.endsWith("family") ? group.replace(" family", "") : null;
    for (let i = 0; i < size; i++) {
      const isKid = !!family && i >= size - 2 && r() < 0.6;
      const isElder = group === "Family elders" || (!!family && i < 2 && r() < 0.35);
      const first = isKid ? pick(KIDS) : i % 2 === 0 ? pick(MALE) : pick(FEMALE);
      const last = family ?? pick(SURNAMES);
      guests.push({
        id: nanoid(8),
        name: `${isElder && !family ? (i % 2 ? "Smt." : "Shri") + " " : ""}${first} ${last}`,
        group,
        side,
        dietary: isElder ? "veg" : dietary(),
        rsvp: vip ? (r() < 0.9 ? "yes" : "pending") : rsvp(),
        vip,
        accessible: isElder && r() < 0.4,
        child: isKid,
        checkedIn: false,
        phone: `98${Math.floor(10000000 + r() * 89999999)}`,
      });
    }
  }
  // A real-world constraint for the demo: two cousins who should not share a table
  const a = guests.find((g) => g.group === "Pillai family" && !g.child);
  const b = guests.find((g) => g.group === "Nair family" && !g.child);
  if (a && b) a.avoid = [b.id];
  ev.guests = guests;

  const vendors: Vendor[] = [
    {
      id: nanoid(8),
      category: "venue",
      name: "Sree Mahal Banquets",
      contact: "+91 98430 11223",
      status: "booked",
      quote: 220000,
      paid: 110000,
      zoneIds: [],
      rating: 4.6,
    },
    {
      id: nanoid(8),
      category: "catering",
      name: "Annapoorna Caterers",
      contact: "+91 98940 55110",
      status: "booked",
      quote: 125000,
      paid: 40000,
      zoneIds: [],
      rating: 4.8,
    },
    {
      id: nanoid(8),
      category: "decor",
      name: "Kalyan Decors",
      contact: "+91 99440 20304",
      status: "booked",
      quote: 180000,
      paid: 60000,
      zoneIds: [],
      rating: 4.5,
      setupNotes: "Marigold drapes on stage, jasmine curtain, brass urli at entry.",
    },
    {
      id: nanoid(8),
      category: "photography",
      name: "Lens & Light Studio",
      contact: "+91 90030 77881",
      status: "booked",
      quote: 95000,
      paid: 30000,
      zoneIds: [],
      rating: 4.7,
    },
    {
      id: nanoid(8),
      category: "dj",
      name: "DJ Vikram Beats",
      contact: "+91 97890 66554",
      status: "quoted",
      quote: 35000,
      paid: 0,
      zoneIds: [],
      rating: 4.3,
    },
    {
      id: nanoid(8),
      category: "makeup",
      name: "Glam by Divya",
      contact: "+91 96000 12345",
      status: "booked",
      quote: 40000,
      paid: 10000,
      zoneIds: [],
      rating: 4.9,
    },
    {
      id: nanoid(8),
      category: "bakery",
      name: "Sweet Truth Bakery",
      contact: "+91 95000 98765",
      status: "quoted",
      quote: 12000,
      paid: 0,
      zoneIds: [],
      rating: 4.4,
    },
    {
      id: nanoid(8),
      category: "florist",
      name: "Sri Murugan Flowers",
      contact: "+91 94430 33221",
      status: "contacted",
      quote: 0,
      paid: 0,
      zoneIds: [],
      rating: 4.2,
    },
  ];
  ev.vendors = vendors;

  const layout = activeLayout(ev);
  const zoneOf = (kind: string) => layout.zones.find((z) => z.kind === kind)?.id;
  const assign: Record<string, string | undefined> = {
    catering: zoneOf("service"),
    decor: zoneOf("ceremony"),
    dj: zoneOf("dance"),
    photography: zoneOf("ceremony"),
  };
  for (const v of vendors) {
    const z = assign[v.category];
    if (z) v.zoneIds = [z];
  }

  ev.budget.lines = [
    { id: nanoid(8), category: "attire", label: "Bridal silk saree & groom's veshti", estimated: 150000, actual: 128000, paid: 128000 },
    { id: nanoid(8), category: "invitations", label: "Printed invitations & e-invite video", estimated: 25000, actual: 18000, paid: 18000 },
    {
      id: nanoid(8),
      category: "gifts",
      label: "Return gifts (brass diyas)",
      estimated: 30000,
      actual: 0,
      paid: 0,
      dueDate: shiftDate(date, -12),
    },
    {
      id: nanoid(8),
      category: "logistics",
      label: "Guest transport from Madurai",
      estimated: 22000,
      actual: 0,
      paid: 0,
      dueDate: shiftDate(date, -5),
    },
    {
      id: nanoid(8),
      category: "misc",
      label: "Priest dakshina & pooja items",
      estimated: 15000,
      actual: 0,
      paid: 0,
      dueDate: shiftDate(date, -2),
    },
  ];

  ev.schedule = generateSchedule(ev, layout);
  for (const v of ev.vendors) v.arrivalTime = vendorArrival(ev, v.id);
  ev.tasks.slice(0, 9).forEach((t) => (t.done = true));

  const { assignments } = autoSeat(ev, layout);
  for (const g of ev.guests) g.seatId = assignments[g.id];

  // Plan B: outdoor lawn backup, for comparing layouts side by side
  const lawn = buildLayout({ templateId: "lawn", name: "Plan B · Garden lawn (rain backup)", guestCount: ev.guestCount, type: "wedding" });
  ev.layouts.push(lawn);
  ev.layouts[0].name = "Plan A · Banquet hall";
  return ev;
}

export function createDemoCommunity(today = new Date()): EventPlan {
  const r = rng(7);
  const date = shiftDate(toIsoDate(today), 16);
  const ev = createEventPlan(
    {
      name: "Coimbatore Diwali Cultural Night",
      type: "community",
      date,
      startTime: "18:30",
      city: "Coimbatore",
      guestCount: 320,
      budgetTotal: 300000,
      theme: "Festival of Lights",
      notes: "Residents' welfare association event with performances, food stalls and prize distribution.",
      templateId: "auditorium",
    },
    today,
  );
  ev.vendors = [
    { id: nanoid(8), category: "av", name: "SoundWave Events", status: "booked", quote: 45000, paid: 20000, zoneIds: [], rating: 4.5 },
    { id: nanoid(8), category: "catering", name: "Kovai Tiffin Co.", status: "quoted", quote: 96000, paid: 0, zoneIds: [], rating: 4.6 },
    {
      id: nanoid(8),
      category: "rentals",
      name: "Shanthi Tent House",
      status: "booked",
      quote: 38000,
      paid: 15000,
      zoneIds: [],
      rating: 4.1,
    },
    { id: nanoid(8), category: "emcee", name: "Anchor Meera", status: "contacted", quote: 0, paid: 0, zoneIds: [], rating: 4.8 },
  ];
  ev.schedule = generateSchedule(ev, activeLayout(ev));
  for (const v of ev.vendors) v.arrivalTime = vendorArrival(ev, v.id);
  ev.tasks.slice(0, 6).forEach((t) => (t.done = true));
  ev.booking = { enabled: true, title: "Diwali Cultural Night: reserve your seat", priceGeneral: 150, priceVip: 400, maxPerOrder: 6 };

  const layout = activeLayout(ev);
  const seats = allSeats(layout);
  const names = ["Ravi", "Kala", "Sundar", "Mala", "Joseph", "Fathima", "Prem", "Asha", "Gopi", "Latha", "Imran", "Rekha"];
  const taken = new Set<string>();
  const vip = vipSeatIds(layout, seats);
  for (let i = 0; i < 46 && seats.length; i++) {
    const s = seats[Math.floor(r() * Math.min(seats.length, 140))];
    if (taken.has(s.id)) continue;
    taken.add(s.id);
    ev.bookings.push({
      id: nanoid(8),
      seatId: s.id,
      layoutId: layout.id,
      name: `${names[i % names.length]} (Block ${String.fromCharCode(65 + (i % 5))})`,
      passType: vip.has(s.id) ? "vip" : "general",
      createdAt: new Date().toISOString(),
    });
  }
  return ev;
}
