import { beforeEach, describe, expect, it } from "vitest";
import { createEventPlan } from "@/lib/engine/factory";
import { activeLayoutOf, draftLayout, updateEvent, useStore } from "./store";

const make = () =>
  createEventPlan({ name: "Store test", type: "birthday", date: "2026-12-01", startTime: "17:00", city: "Chennai", guestCount: 40, budgetTotal: 150000, theme: "" }, new Date("2026-10-23T10:00:00"));

beforeEach(() => useStore.setState({ events: {}, history: {} }));

describe("event store", () => {
  it("adds, updates and removes events immutably", () => {
    const ev = make();
    useStore.getState().addEvent(ev);
    updateEvent(ev.id, (d) => void (d.theme = "Superheroes"));
    const next = useStore.getState().events[ev.id];
    expect(next.theme).toBe("Superheroes");
    expect(ev.theme).toBe("");
    expect(next.layouts).toBe(ev.layouts); // untouched branches are shared, not copied
    useStore.getState().removeEvent(ev.id);
    expect(useStore.getState().events[ev.id]).toBeUndefined();
  });

  it("undoes and redoes changes", () => {
    const ev = make();
    useStore.getState().addEvent(ev);
    updateEvent(ev.id, (d) => void (d.guestCount = 50));
    updateEvent(ev.id, (d) => void (d.guestCount = 60));
    const { undo, redo } = useStore.getState();
    undo(ev.id);
    expect(useStore.getState().events[ev.id].guestCount).toBe(50);
    undo(ev.id);
    expect(useStore.getState().events[ev.id].guestCount).toBe(40);
    redo(ev.id);
    expect(useStore.getState().events[ev.id].guestCount).toBe(50);
    updateEvent(ev.id, (d) => void (d.guestCount = 70));
    expect(useStore.getState().history[ev.id].future).toHaveLength(0);
  });

  it("merges rapid edits with the same key into one undo step", () => {
    const ev = make();
    useStore.getState().addEvent(ev);
    for (const n of ["S", "Su", "Sup"]) updateEvent(ev.id, (d) => void (d.theme = n), { coalesce: "theme" });
    expect(useStore.getState().history[ev.id].past).toHaveLength(1);
    useStore.getState().undo(ev.id);
    expect(useStore.getState().events[ev.id].theme).toBe("");
  });

  it("can skip history for navigation-like changes", () => {
    const ev = make();
    useStore.getState().addEvent(ev);
    updateEvent(ev.id, (d) => void (d.activeLayoutId = d.layouts[0].id), { history: false });
    expect(useStore.getState().history[ev.id].past).toHaveLength(0);
  });

  it("finds the active layout in plain objects and drafts", () => {
    const ev = make();
    useStore.getState().addEvent(ev);
    expect(activeLayoutOf(ev).id).toBe(ev.activeLayoutId);
    updateEvent(ev.id, (d) => void (draftLayout(d).name = "Renamed"));
    expect(activeLayoutOf(useStore.getState().events[ev.id]).name).toBe("Renamed");
  });
});
