// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreRing, StatTile } from "@/components/event/score-ring";
import { NativeSelect } from "@/components/ui/native-select";

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
