// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCaption, createMeasurement, createPoint } from "./create";
import type { SketchPoint } from "./figures";
import { canStartAt, nameAt, nameable, namesAsBuilt, namesFor, namesToGive } from "./naming";
import type { SketchObject } from "./values";

function point(x: number): SketchPoint {
  return createPoint({ x, y: 0 }, "medium");
}

/** The same point, labelled and carrying the name it was given. */
function called(one: SketchPoint, name: string, shown = true): SketchPoint {
  return { ...one, label: { name, shown } };
}

describe("what a figure is called", () => {
  it("leaves what was never labelled with no name at all", () => {
    const names = namesFor([point(0), point(10)]);
    expect(names.size).toBe(0);
  });

  it("letters the labelled ones from the start of the run", () => {
    // Nine points on the page and only the last one labelled: it is A, not J,
    // because the eight nobody labelled never took a letter.
    const drawn = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((step) => point(step * 10));
    const wanted = drawn[8];
    expect(namesToGive(drawn, [wanted.id]).get(wanted.id)).toBe("A");
  });

  it("hands out the letters in the order the objects were built", () => {
    const drawn = [point(0), point(10), point(20)];
    const given = namesToGive(drawn, [drawn[2].id, drawn[0].id]);
    // Handed out oldest first, whatever order they were asked for in.
    expect(given.get(drawn[0].id)).toBe("A");
    expect(given.get(drawn[2].id)).toBe("B");
  });

  it("steps over a letter something already answers to", () => {
    const drawn = [called(point(0), "A"), point(10)];
    expect(namesToGive(drawn, [drawn[1].id]).get(drawn[1].id)).toBe("B");
  });

  it("gives nothing to what is named already", () => {
    // Asked for a name it has, it is left out rather than answered with the
    // one it holds, so nothing that writes these names down renames anything.
    const drawn = [called(point(0), "A"), point(10)];
    const given = namesToGive(drawn, [drawn[0].id, drawn[1].id]);
    expect(given.has(drawn[0].id)).toBe(false);
    expect(given.get(drawn[1].id)).toBe("B");
  });

  it("keeps a letter when the label beside it is hidden", () => {
    // B's label is put away. A and C are not renumbered by it, and B keeps the
    // name it was given, so showing it again brings the same letter back.
    const drawn = [called(point(0), "A"), called(point(10), "B", false), called(point(20), "C")];
    const names = namesFor(drawn);
    expect(names.get(drawn[0].id)).toBe("A");
    expect(names.get(drawn[1].id)).toBe("B");
    expect(names.get(drawn[2].id)).toBe("C");
  });

  it("still names what writes its own name rather than hanging a label", () => {
    const ends = [point(0), point(10)];
    const measurement = createMeasurement(
      "length",
      ends.map((end) => end.id),
      { x: 0, y: 0 },
    );
    const names = namesFor([...ends, measurement] as SketchObject[]);
    expect(names.get(measurement.id)).toBe("m1");
  });

  it("says what can carry a name whether or not it has one", () => {
    const bare = point(0);
    expect(nameable(bare, [bare])).toBe(true);
    // A caption says what it says and a button has its name written on it, so
    // neither takes a turn in any run. The panel and Ctrl+K both lean on this.
    const caption = createCaption({ x: 0, y: 0 }, 100, {
      font: "Arial",
      size: 12,
      colour: "--color-canvas-text",
    });
    expect(nameable(caption, [caption])).toBe(false);
  });

  it("letters everything as a sketch written before was lettered", () => {
    // The reading a file older than kept names opens with: every object took
    // its turn in the run, labelled or not, so the third point is C.
    const drawn = [point(0), point(10), point(20)];
    expect(namesAsBuilt(drawn).get(drawn[2].id)).toBe("C");
  });
});

/**
 * A relabel run hands out the letters in order from the one it was started at,
 * so what it says next depends on nothing but that letter and how far along the
 * run is. That is what lets the run read its place off the page.
 */
describe("the letters a relabel run hands out", () => {
  it("walks the alphabet from the letter it started at", () => {
    expect([0, 1, 2].map((step) => nameAt("A", step))).toEqual(["A", "B", "C"]);
    expect([0, 1, 2].map((step) => nameAt("P", step))).toEqual(["P", "Q", "R"]);
  });

  it("wraps, so the name after Z is A again", () => {
    expect(nameAt("Z", 1)).toBe("A");
    expect(nameAt("Y", 3)).toBe("B");
  });

  it("walks the small letters from a small start", () => {
    expect([0, 1].map((step) => nameAt("x", step))).toEqual(["x", "y"]);
    expect(nameAt("z", 1)).toBe("a");
  });

  it("starts at one letter and nothing else", () => {
    expect(canStartAt("A")).toBe(true);
    expect(canStartAt("q")).toBe(true);
    expect(canStartAt("")).toBe(false);
    expect(canStartAt("AB")).toBe(false);
    expect(canStartAt("1")).toBe(false);
  });
});
