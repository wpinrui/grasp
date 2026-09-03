// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clampScale, overlaps, snapKey, stepped, stopAbove, stopBelow } from "./sheet";

/**
 * The zoom buttons step to round numbers rather than multiplying from wherever
 * the wheel left the sheet, so what matters is that a press always moves, and
 * that neither end runs off.
 */
describe("stepping the zoom", () => {
  it("moves off a stop it is already sitting on", () => {
    expect(stopAbove(1)).toBe(1.5);
    expect(stopBelow(1)).toBe(0.75);
  });

  it("takes the next stop from anywhere between two", () => {
    expect(stopAbove(1.2)).toBe(1.5);
    expect(stopBelow(1.2)).toBe(1);
  });

  it("stops at either end rather than running off", () => {
    expect(stopAbove(4)).toBe(4);
    expect(stopBelow(0.1)).toBe(0.1);
  });

  it("holds any scale between the two ends", () => {
    expect(clampScale(9)).toBe(4);
    expect(clampScale(0.01)).toBe(0.1);
    expect(clampScale(1.3)).toBe(1.3);
  });
});

describe("the rest of what the sheet is drawn by", () => {
  it("holds a direction to the nearest fifteen degrees, keeping its reach", () => {
    const from = { x: 0, y: 0 };
    // 20 degrees below the horizontal, at a reach of 100, comes back at 15.
    const to = { x: 100 * Math.cos(0.35), y: 100 * Math.sin(0.35) };
    const held = stepped(from, to);
    expect(Math.hypot(held.x, held.y)).toBeCloseTo(100);
    expect((Math.atan2(held.y, held.x) * 180) / Math.PI).toBeCloseTo(15);
  });

  it("counts touching rectangles as overlapping, and parted ones as not", () => {
    const one = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(one, { x: 10, y: 10, width: 5, height: 5 })).toBe(true);
    expect(overlaps(one, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
  });

  it("tells one snap from another, and from none", () => {
    const at = { x: 3, y: 4 };
    expect(snapKey({ kind: "point", ids: ["a"], at })).toBe("point:a:3,4");
    expect(snapKey({ kind: "point", ids: ["a"], at })).not.toBe(
      snapKey({ kind: "line", ids: ["a"], at }),
    );
    expect(snapKey(null)).toBe("");
  });
});
