// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint } from "../../sketch/model";
import {
  clampScale,
  overlaps,
  SNAP_RING,
  type Snap,
  snapKey,
  snapRadius,
  stepped,
  stopAbove,
  stopBelow,
} from "./sheet";

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

/**
 * The ring drawn where a click would land. On a dot it is that dot's own size
 * with a little room round it, so the ring reads as being about the dot; on a
 * path there is no dot to be about, so it is a fixed size instead. Either way
 * it keeps its size on screen.
 */
describe("the ring at a snap", () => {
  const A = { ...createPoint({ x: 0, y: 0 }, "large"), id: "A" };
  const ends = new Map([["A", A]]);

  it("takes its size from the dot it found", () => {
    // A large point is drawn at radius 6.5, and the ring leaves 5.5 round it.
    const round = snapRadius({ kind: "point", ids: ["A"], at: A }, { scale: 1, ends });
    expect(round).toBe(12);
  });

  it("is a fixed size on a path, there being no dot to be about", () => {
    const on: Snap = { kind: "line", ids: ["seg"], at: { x: 5, y: 5 } };
    expect(snapRadius(on, { scale: 1, ends })).toBe(SNAP_RING);
  });

  it("halves on the sheet as the sheet doubles on screen", () => {
    const on: Snap = { kind: "line", ids: ["seg"], at: { x: 5, y: 5 } };
    expect(snapRadius(on, { scale: 2, ends })).toBe(SNAP_RING / 2);
  });

  it("falls back to the fixed size where the dot is not on the page", () => {
    const gone: Snap = { kind: "point", ids: ["gone"], at: { x: 0, y: 0 } };
    expect(snapRadius(gone, { scale: 1, ends })).toBe(SNAP_RING);
  });
});
