import { beforeEach, describe, expect, it } from "vitest";
import { activeLayout } from "@/lib/engine/costs";
import { createDemoWedding } from "@/lib/seed/demo";
import { buildPlanContext, runAssistantTool, toolLabel } from "./assistant-tools";
import { useStore } from "./store";

let id = "";
const ev = () => useStore.getState().events[id];
const kinds = (k: string) => activeLayout(ev()).elements.filter((e) => e.kind === k);

beforeEach(() => {
  const demo = createDemoWedding(new Date("2026-10-23T10:00:00"));
  id = demo.id;
  useStore.setState({ events: { [id]: demo }, history: {} });
});

describe("AI co-planner tools", () => {
  it("adds items by natural name near a reference", () => {
    const out = runAssistantTool(id, "add_items", { kind: "photo booth", count: 1, near: "entry" });
    expect(out).toMatch(/Added 1 × Photo booth/);
    expect(out).toMatch(/Safety score/);
    expect(kinds("photo-booth")).toHaveLength(2);
  });

  it("moves, swaps and removes items", () => {
    expect(runAssistantTool(id, "move_item", { target: "dj-booth", awayFrom: "VIP tables" })).toMatch(/Moved DJ booth \d+ ft away/);
    const reg = kinds("registration")[0];
    expect(runAssistantTool(id, "swap_items", { first: "Registration desk", second: "Gift table" })).toMatch(/Swapped Registration desk and Gift table/);
    expect(kinds("registration")[0].x).not.toBe(reg.x);
    expect(runAssistantTool(id, "remove_items", { target: "plant" })).toMatch(/Removed 2/);
    expect(runAssistantTool(id, "remove_items", { target: "submarine" })).toMatch(/Nothing matching/);
  });

  it("explains failures instead of throwing", () => {
    expect(runAssistantTool(id, "move_item", { target: "unicorn", near: "stage" })).toMatch(/No item matching/);
    expect(runAssistantTool(id, "swap_items", { first: "stage", second: "moon" })).toMatch(/Couldn't find both/);
    expect(runAssistantTool(id, "teleport", {})).toMatch(/Unknown tool/);
    expect(runAssistantTool("missing", "add_items", {})).toBe("Event not found.");
  });

  it("edits budget, tasks, schedule, vendors and event details", () => {
    runAssistantTool(id, "set_allocation", { category: "decor", amount: 150000 });
    expect(ev().budget.allocations.decor).toBe(150000);
    runAssistantTool(id, "add_expense", { category: "gifts", label: "Silver coins", amount: 20000 });
    expect(ev().budget.lines.at(-1)).toMatchObject({ label: "Silver coins", estimated: 20000 });
    runAssistantTool(id, "add_task", { title: "Book nadaswaram", dueDate: "2026-11-20" });
    expect(ev().tasks.at(-1)?.title).toBe("Book nadaswaram");
    runAssistantTool(id, "add_schedule_item", { time: "20:30", title: "Cake cutting", durationMin: 15, location: "cake table" });
    expect(ev().schedule.at(-1)).toMatchObject({ elementKind: "cake-table", time: "20:30" });
    runAssistantTool(id, "add_vendor", { category: "florist", name: "Malli Florals", quote: 30000 });
    expect(ev().vendors.at(-1)).toMatchObject({ name: "Malli Florals", status: "todo" });
    expect(runAssistantTool(id, "update_event", { theme: "Temple Gold", guestCount: 200 })).toBe("Updated theme, guest count.");
    expect(runAssistantTool(id, "update_event", {})).toBe("Nothing to update.");
  });

  it("re-seats everyone and regenerates layouts as new versions", () => {
    expect(runAssistantTool(id, "auto_seat", {})).toMatch(/^Seated \d+ of \d+ guests/);
    const before = ev().layouts.length;
    expect(runAssistantTool(id, "auto_layout", { tableKind: "round-8", asNewVersion: true })).toMatch(/Generated a layout with \d+ seats as a new version/);
    expect(ev().layouts).toHaveLength(before + 1);
  });

  it("builds a compact plan snapshot for the model", () => {
    const ctx = buildPlanContext(ev());
    expect(ctx.event.name).toBe(ev().name);
    expect(typeof ctx.layout.items).toBe("string");
    expect(JSON.stringify(ctx).length).toBeLessThan(8000);
    expect(toolLabel("swap_items")).toBe("Swapping items");
  });
});
