// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreRing, StatTile } from "@/components/event/score-ring";
import { NativeSelect } from "@/components/ui/native-select";
import { NUDGE_FT, NUDGE_LARGE_FT, useStudioShortcuts } from "@/components/blueprint/use-studio-shortcuts";
import type { PlacedElement } from "@/lib/types";

afterEach(cleanup);

describe("ScoreRing", () => {
  it("shows the rounded score with its label", () => {
    render(<ScoreRing value={91.6} label="safety" />);
    expect(screen.getByText("92")).toBeTruthy();
    expect(screen.getByText("safety")).toBeTruthy();
  });

  it("clamps out-of-range values", () => {
    render(<ScoreRing value={140} />);
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("hides the decorative ring from assistive tech", () => {
    const { container } = render(<ScoreRing value={50} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("StatTile", () => {
  it("renders label, value and sub text", () => {
    render(<StatTile label="Seats / guests" value="170 / 159" sub="Everyone fits" />);
    expect(screen.getByText("Seats / guests")).toBeTruthy();
    expect(screen.getByText("170 / 159")).toBeTruthy();
    expect(screen.getByText("Everyone fits")).toBeTruthy();
  });
});

describe("NativeSelect", () => {
  it("is reachable by its accessible name and reports changes", () => {
    const onChange = vi.fn();
    render(
      <NativeSelect aria-label="RSVP" defaultValue="pending" onChange={onChange}>
        <option value="pending">Pending</option>
        <option value="yes">Yes</option>
      </NativeSelect>,
    );
    const select = screen.getByRole("combobox", { name: "RSVP" }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "yes" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select.value).toBe("yes");
  });

  it("gets its name from a wrapping label", () => {
    render(
      <label>
        <span>Food</span>
        <NativeSelect defaultValue="veg">
          <option value="veg">Veg</option>
        </NativeSelect>
      </label>,
    );
    expect(screen.getByRole("combobox", { name: "Food" })).toBeTruthy();
  });
});

describe("useStudioShortcuts", () => {
  const el: PlacedElement = { id: "e1", kind: "round-8", x: 10, y: 10, w: 6, h: 6, rotation: 0, label: "T1" };
  const setup = (selectedElement?: PlacedElement) => {
    const handlers = { onEscape: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(), onRotate: vi.fn(), onNudge: vi.fn() };
    const hook = renderHook(() => useStudioShortcuts({ hasSelection: !!selectedElement, selectedElement, ...handlers }));
    return { handlers, hook };
  };
  const press = (key: string, init: KeyboardEventInit = {}, target: Window | Element = window) =>
    fireEvent.keyDown(target, { key, bubbles: true, ...init });

  it("nudges by the small step, and the large step with Shift", () => {
    const { handlers } = setup(el);
    press("ArrowLeft");
    press("ArrowDown", { shiftKey: true });
    expect(handlers.onNudge).toHaveBeenNthCalledWith(1, el, -NUDGE_FT, 0);
    expect(handlers.onNudge).toHaveBeenNthCalledWith(2, el, 0, NUDGE_LARGE_FT);
  });

  it("deletes, duplicates and rotates the selection", () => {
    const { handlers } = setup(el);
    press("Delete");
    press("d", { ctrlKey: true });
    press("r");
    expect(handlers.onDelete).toHaveBeenCalledOnce();
    expect(handlers.onDuplicate).toHaveBeenCalledWith(el);
    expect(handlers.onRotate).toHaveBeenCalledWith(el);
  });

  it("only handles Escape when nothing is selected", () => {
    const { handlers } = setup();
    press("Escape");
    press("Delete");
    press("ArrowUp");
    expect(handlers.onEscape).toHaveBeenCalledOnce();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onNudge).not.toHaveBeenCalled();
  });

  it("ignores keys typed into form fields and stops listening on unmount", () => {
    const { handlers, hook } = setup(el);
    const input = document.body.appendChild(document.createElement("input"));
    press("Backspace", {}, input);
    expect(handlers.onDelete).not.toHaveBeenCalled();
    input.remove();
    hook.unmount();
    press("Delete");
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });
});
