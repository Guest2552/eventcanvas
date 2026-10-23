import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { blankGuest, GUEST_CSV_TEMPLATE, parseGuestRows } from "./guests";

describe("guest import", () => {
  it("reads the downloadable CSV template back into guests", () => {
    const { data } = Papa.parse<Record<string, string>>(GUEST_CSV_TEMPLATE, { header: true, skipEmptyLines: true });
    const guests = parseGuestRows(data);
    expect(guests.map((g) => g.name)).toEqual(["Lakshmi Iyer", "Karthik Menon"]);
    expect(guests[0]).toMatchObject({ group: "Iyer family", side: "Bride", dietary: "veg", rsvp: "yes", vip: true, accessible: false });
    expect(guests[1]).toMatchObject({ dietary: "non-veg", rsvp: "pending", vip: false });
  });

  it("matches loosely named columns and normalises values", () => {
    const [g] = parseGuestRows([
      {
        " Full Name ": " Asha Rao ",
        Family: "Rao",
        WhatsApp: "98400 12345",
        Diet: "Jain only",
        Status: "Maybe",
        Wheelchair: "TRUE",
        Kid: "1",
      },
    ]);
    expect(g).toMatchObject({
      name: "Asha Rao",
      group: "Rao",
      phone: "98400 12345",
      dietary: "jain",
      rsvp: "maybe",
      accessible: true,
      child: true,
    });
  });

  it("falls back to safe defaults and skips rows without a name", () => {
    const guests = parseGuestRows([
      { name: "Ravi", rsvp: "definitely", dietary: "" },
      { name: "  ", group: "Ghost" },
      { group: "No name" },
    ]);
    expect(guests).toHaveLength(1);
    expect(guests[0]).toMatchObject({ rsvp: "pending", dietary: "veg", vip: false, checkedIn: false });
  });

  it("gives every guest a unique id", () => {
    const ids = new Set([blankGuest().id, blankGuest().id, ...parseGuestRows([{ name: "A" }, { name: "B" }]).map((g) => g.id)]);
    expect(ids.size).toBe(4);
  });
});
