// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createAngleMark,
  createPoint,
  createTick,
  lineThrough,
  type SketchObject,
  settle,
} from "../../sketch/model";
import { arcsBetween, type Marking, markUnder } from "./marks";

/**
 * The markings on a figure. Neither of these is reached by the sheet's own
 * snapshot: one is asked only under a marking tool, the other only by the angle
 * preview and the which-angle dialog, and that figure is drawn with the Arrow.
 */

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };
const EAST = { ...lineThrough("segment", ["A", "B"]), id: "east" };
const SOUTH = { ...lineThrough("segment", ["A", "C"]), id: "south" };

/** Two ticks on the same segment at the same spot, laid one after the other. */
const TICK = { form: "equal" as const, path: "east", at: 0.5, flipped: false };
const UNDER = { ...createTick({ ...TICK, strokes: 1 }), id: "under" };
const OVER = { ...createTick({ ...TICK, strokes: 2 }), id: "over" };

const CORNER: SketchObject[] = [A, B, C, EAST, SOUTH];

function marking(objects: SketchObject[] = CORNER, angle = 2): Marking {
  return { settled: settle(objects).settled, scale: 1, lastMark: { angle, radius: 24 } };
}

/** The figure a mark is looked for on, which markUnder takes whole. */
function figure(objects: SketchObject[]) {
  return { objects, settled: settle(objects).settled, scale: 1 };
}

describe("the mark under the pointer", () => {
  it("finds the mark the pointer is on", () => {
    const found = markUnder({ x: 50, y: 0 }, figure([...CORNER, UNDER]));
    expect(found?.id).toBe("under");
  });

  it("takes the topmost where two are laid on the same spot", () => {
    const found = markUnder({ x: 50, y: 0 }, figure([...CORNER, UNDER, OVER]));
    expect(found?.id).toBe("over");
  });

  it("finds nothing out on bare sheet", () => {
    expect(markUnder({ x: 400, y: 400 }, figure([...CORNER, UNDER]))).toBe(null);
  });

  it("finds nothing on a figure that carries no marks at all", () => {
    expect(markUnder({ x: 50, y: 0 }, figure(CORNER))).toBe(null);
  });
});

describe("the arcs an angle would land as", () => {
  const arms: [string, string] = ["B", "C"];

  it("draws one stroke per stroke the last mark was set to", () => {
    expect(arcsBetween({ corner: "A", arms, reflex: false }, marking(CORNER, 1))).toHaveLength(1);
    expect(arcsBetween({ corner: "A", arms, reflex: false }, marking(CORNER, 3))).toHaveLength(3);
  });

  it("draws the other way round for the reflex angle", () => {
    const inner = arcsBetween({ corner: "A", arms, reflex: false }, marking());
    const outer = arcsBetween({ corner: "A", arms, reflex: true }, marking());
    expect(outer).toHaveLength(inner.length);
    expect(outer[0]).not.toBe(inner[0]);
  });

  it("draws nothing where an arm has no point to run to", () => {
    expect(arcsBetween({ corner: "A", arms: ["B", "gone"], reflex: false }, marking())).toEqual([]);
    expect(arcsBetween({ corner: "gone", arms, reflex: false }, marking())).toEqual([]);
  });

  /** An angle mark already on the corner says nothing about a new one. */
  it("draws off the last mark rather than off what is already at the corner", () => {
    const already = {
      ...createAngleMark({
        corner: "A",
        arms,
        sides: ["east", "south"],
        strokes: 1,
        reflex: false,
        radius: 60,
      }),
      id: "already",
    };
    const drawn = arcsBetween({ corner: "A", arms, reflex: false }, marking([...CORNER, already]));
    expect(drawn).toHaveLength(2);
  });
});
