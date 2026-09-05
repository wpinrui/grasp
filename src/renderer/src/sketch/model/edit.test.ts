// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLine, createMeasurement, createPoint } from "./create";
import { asPasted, PASTE_STEP } from "./edit";
import { isMeasurement } from "./guards";
import type { SketchObject } from "./values";

/** A segment from A to B, and a length tied 20 above the middle of it. */
function measured() {
  const a = createPoint({ x: 0, y: 0 }, "medium");
  const b = createPoint({ x: 100, y: 0 }, "medium");
  const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
  const length = {
    ...createMeasurement("length", [seg.id], { x: 50, y: -20 }),
    bare: true,
    tied: { along: 0, across: 20 },
  };
  return { figure: [a, b, seg] as SketchObject[], length };
}

function pastedReading(taken: SketchObject[]) {
  const found = asPasted(taken, 1).find(isMeasurement);
  if (!found) throw new Error("no reading pasted");
  return found;
}

/**
 * Pasting a tied reading. The step off the original is what keeps a copy from
 * hiding under what it came from, and a copy that works its own way back to
 * where the original sits would throw that away.
 */
describe("pasting a reading tied to its figure", () => {
  it("cuts the copy loose where the figure did not come with it", () => {
    const { length } = measured();
    const copy = pastedReading([length]);
    expect(copy.tied).toBeUndefined();
    expect(copy.x).toBe(50 + PASTE_STEP);
    expect(copy.y).toBe(-20 + PASTE_STEP);
  });

  it("leaves the copy tied where the whole figure came with it", () => {
    const { figure, length } = measured();
    const copy = pastedReading([...figure, length]);
    // The copied reading reads the copied segment, so the copied figure is
    // what carries it and the tie is worth keeping.
    expect(copy.tied).toEqual({ along: 0, across: 20 });
    expect(copy.of[0]).not.toBe(length.of[0]);
  });

  it("leaves a reading that was never tied exactly as it was", () => {
    const { length } = measured();
    const copy = pastedReading([{ ...length, tied: undefined }]);
    expect(copy.tied).toBeUndefined();
    expect(copy.x).toBe(50 + PASTE_STEP);
  });
});
