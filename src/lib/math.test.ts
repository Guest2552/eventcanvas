import { describe, expect, it } from "vitest";
import { clamp, roundEven, roundHalf } from "./math";

describe("math helpers", () => {
  it("clamps into a range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it("snaps to the half-foot grid", () => {
    expect(roundHalf(3.2)).toBe(3);
    expect(roundHalf(3.3)).toBe(3.5);
    expect(roundHalf(-1.74)).toBe(-1.5);
  });

  it("rounds to even integers", () => {
    expect(roundEven(1079)).toBe(1080);
    expect(roundEven(7)).toBe(8);
    expect(roundEven(6.9)).toBe(6);
  });
});
