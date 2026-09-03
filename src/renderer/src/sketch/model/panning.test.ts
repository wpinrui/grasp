// @vitest-environment node
import { describe, expect, it } from "vitest";
import { centreOf, pannedView, panTravel } from "./panning";

describe("the point the fingers are around", () => {
  it("is the midpoint of two", () => {
    expect(
      centreOf([
        { x: 0, y: 0 },
        { x: 100, y: 40 },
      ]),
    ).toEqual({ x: 50, y: 20 });
  });

  it("is the average of three", () => {
    expect(
      centreOf([
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 0, y: 60 },
      ]),
    ).toEqual({ x: 10, y: 20 });
  });

  it("is nowhere when no finger is down", () => {
    expect(centreOf([])).toEqual({ x: 0, y: 0 });
  });
});

describe("where a pan leaves the view", () => {
  const from = { view: { x: 100, y: 100 }, clientX: 200, clientY: 200 };

  it("moves the sheet the way the fingers went, so the view goes the other", () => {
    expect(pannedView(from, { x: 260, y: 200 }, 1)).toEqual({ x: 40, y: 100 });
    expect(pannedView(from, { x: 200, y: 140 }, 1)).toEqual({ x: 100, y: 160 });
  });

  it("moves half as far through a sheet at twice its size", () => {
    expect(pannedView(from, { x: 220, y: 200 }, 2)).toEqual({ x: 90, y: 100 });
  });

  it("moves twice as far through a sheet at half its size", () => {
    expect(pannedView(from, { x: 220, y: 200 }, 0.5)).toEqual({ x: 60, y: 100 });
  });

  it("leaves the view alone when the fingers have not moved", () => {
    expect(pannedView(from, { x: 200, y: 200 }, 1)).toEqual(from.view);
  });

  it("carries the sheet half as far as one finger of two, not all of it", () => {
    // This is the whole reason the centre is followed rather than a finger:
    // one finger sliding while the other rests must not drag the sheet along
    // with it at full speed.
    const still = { x: 0, y: 0 };
    const began = centreOf([still, { x: 100, y: 0 }]);
    const now = centreOf([still, { x: 200, y: 0 }]);
    const pan = { view: { x: 0, y: 0 }, clientX: began.x, clientY: began.y };
    expect(pannedView(pan, now, 1)).toEqual({ x: -50, y: 0 });
  });
});

describe("how far a pan has come", () => {
  const from = { view: { x: 0, y: 0 }, clientX: 100, clientY: 100 };

  it("is measured on the screen, so the zoom does not change it", () => {
    // A press that has not moved far enough to be a drag is still a press,
    // however far into the sheet it is zoomed.
    expect(panTravel(from, { x: 102, y: 100 })).toBe(2);
    expect(panTravel(from, { x: 100, y: 98 })).toBe(2);
  });

  it("counts travel in either direction", () => {
    expect(panTravel(from, { x: 97, y: 104 })).toBe(7);
  });
});
