export type EventType = "wedding" | "birthday" | "community" | "corporate";
export type Dietary = "veg" | "non-veg" | "vegan" | "jain";
export type Rsvp = "pending" | "yes" | "no" | "maybe";
export type VendorStatus = "todo" | "contacted" | "quoted" | "booked" | "paid" | "delivered";
export type ZoneKind = "ceremony" | "dining" | "dance" | "vip" | "kids" | "service" | "lounge" | "custom";

export type BudgetCategory =
  "venue" | "catering" | "decor" | "rentals" | "photography" | "entertainment" | "attire" | "invitations" | "gifts" | "logistics" | "misc";

export type VendorCategory =
  | "venue"
  | "catering"
  | "decor"
  | "photography"
  | "dj"
  | "av"
  | "bakery"
  | "florist"
  | "mehendi"
  | "makeup"
  | "priest"
  | "invitations"
  | "transport"
  | "rentals"
  | "entertainment"
  | "power"
  | "security"
  | "attire"
  | "emcee";

/** All blueprint coordinates are in feet. x/y is the top-left corner of the un-rotated element. */
export interface Venue {
  name: string;
  widthFt: number;
  lengthFt: number;
  indoor: boolean;
  templateId?: string;
}

export interface PlacedElement {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string;
}

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  id: string;
  name: string;
  venue: Venue;
  elements: PlacedElement[];
  zones: Zone[];
}

export interface Guest {
  id: string;
  name: string;
  group: string;
  side?: string;
  dietary: Dietary;
  rsvp: Rsvp;
  vip: boolean;
  accessible: boolean;
  child: boolean;
  /** `${elementId}:${seatIndex}` in the active layout */
  seatId?: string;
  checkedIn: boolean;
  phone?: string;
  avoid?: string[];
}

export interface Vendor {
  id: string;
  category: VendorCategory;
  name: string;
  contact?: string;
  status: VendorStatus;
  quote: number;
  paid: number;
  zoneIds: string[];
  arrivalTime?: string;
  setupNotes?: string;
  arrived?: boolean;
  rating?: number;
}

export interface BudgetLine {
  id: string;
  category: BudgetCategory;
  label: string;
  estimated: number;
  actual: number;
  paid: number;
  dueDate?: string;
}

export interface Budget {
  total: number;
  perPlate: number;
  allocations: Partial<Record<BudgetCategory, number>>;
  lines: BudgetLine[];
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  phase: string;
  done: boolean;
  assignee?: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  durationMin: number;
  title: string;
  /** Linked blueprint element kind (resolved against the active layout) */
  elementKind?: string;
  vendorIds: string[];
  notes?: string;
}

export interface Booking {
  id: string;
  seatId: string;
  layoutId: string;
  name: string;
  passType: "general" | "vip";
  createdAt: string;
}

export interface BookingSettings {
  enabled: boolean;
  title: string;
  priceGeneral: number;
  priceVip: number;
  maxPerOrder: number;
}

export interface IdeaPack {
  themes: { name: string; description: string; palette: string[]; decor: string[] }[];
  activities: { title: string; description: string; audience: string }[];
  menu: { course: string; items: string[] }[];
  favors: string[];
  hashtags: string[];
  source: "ai" | "offline";
}

export interface EventPlan {
  id: string;
  name: string;
  type: EventType;
  date: string;
  startTime: string;
  city: string;
  guestCount: number;
  theme: string;
  notes: string;
  currency: string;
  layouts: Layout[];
  activeLayoutId: string;
  guests: Guest[];
  vendors: Vendor[];
  budget: Budget;
  tasks: Task[];
  schedule: ScheduleItem[];
  bookings: Booking[];
  booking: BookingSettings;
  ideas?: IdeaPack;
  createdAt: string;
  updatedAt: string;
}
