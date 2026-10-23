import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { activeLayout } from "@/lib/engine/costs";
import { createEventPlan } from "@/lib/engine/factory";
import { markDuePaid, resolveElements, swapElements } from "./actions";
import { createDemoWedding } from "@/lib/seed/demo";

const ev = createEventPlan(
  {
    name: "t",
    type: "wedding",
    date: "2026-12-12",
    startTime: "18:00",
    city: "Coimbatore",
    guestCount: 120,
    budgetTotal: 800000,
    theme: "",
    templateId: "banquet",
  },
  new Date("2026-10-23T10:00:00"),
);

describe("assistant actions", () => {
  it("resolves items by label, type and loose names", () => {
    const layout = activeLayout(ev);
    expect(resolveElements(layout, "Registration desk")[0]?.kind).toBe("registration");
    expect(resolveElements(layout, "gift table")[0]?.kind).toBe("gift-table");
    expect(resolveElements(layout, "dj-booth")[0]?.kind).toBe("dj-booth");
    expect(resolveElements(layout, "the DJ")[0]?.kind).toBe("dj-booth");
  });

  it("swaps two items' positions", () => {
    const before = activeLayout(ev);
    const reg = before.elements.find((e) => e.kind === "registration")!;
    const gift = before.elements.find((e) => e.kind === "gift-table")!;
    let r: ReturnType<typeof swapElements> = null;
    const next = produce(ev, (d) => {
      r = swapElements(d, "Registration desk", "Gift table");
    });
    // Read after the update finishes, exactly like the assistant does
    const res = r as ReturnType<typeof swapElements>;
    expect([res?.a.label, res?.b.label]).toEqual(["Registration desk", "Gift table"]);
    const after = activeLayout(next);
    const reg2 = after.elements.find((e) => e.id === reg.id)!;
    expect(reg2.x + reg2.w / 2).toBeCloseTo(gift.x + gift.w / 2, 0);
  });
});

describe("markDuePaid", () => {
  const demo = createDemoWedding(new Date("2026-10-23T10:00:00"));

  it("pays an expense line in full", () => {
    const line = demo.budget.lines.find((l) => l.paid < Math.max(l.estimated, l.actual))!;
    const next = produce(demo, (d) =>
      markDuePaid(d, { id: line.id, label: line.label, amount: 1, dueDate: "", overdue: false, source: "line" }),
    );
    expect(next.budget.lines.find((l) => l.id === line.id)!.paid).toBe(Math.max(line.estimated, line.actual));
  });

  it("clears a booked vendor's balance and marks them paid", () => {
    const vendor = demo.vendors.find((v) => v.status === "booked" && v.paid < v.quote)!;
    const next = produce(demo, (d) =>
      markDuePaid(d, { id: vendor.id, label: vendor.name, amount: 1, dueDate: "", overdue: false, source: "vendor" }),
    );
    expect(next.vendors.find((v) => v.id === vendor.id)).toMatchObject({ paid: vendor.quote, status: "paid" });
  });

  it("ignores unknown ids", () => {
    const next = produce(demo, (d) => markDuePaid(d, { id: "nope", label: "", amount: 1, dueDate: "", overdue: false, source: "vendor" }));
    expect(next).toBe(demo);
  });
});
