// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parse } from "./format";
import type { SketchObject } from "./model";

/** A point as a file holds one, with whatever label is wanted on it. */
function stored(id: string, x: number, label?: Record<string, unknown>) {
  return { id, kind: "point", x, y: 0, size: "medium", ...(label ? { label } : {}) };
}

function file(version: number, objects: unknown[]): string {
  return JSON.stringify({
    format: "grasp-sketch",
    version,
    pages: [{ name: "Page 1", objects }],
  });
}

function called(objects: SketchObject[], id: string): string | undefined {
  return objects.find((object) => object.id === id)?.label?.name;
}

/**
 * A sketch written before a label kept its own name was lettered by the order
 * it was built, whether or not anything was labelled, and those letters were
 * printed in readings, table headings and captions as well as beside the
 * figure. So they are written down as such a file is read: it has to open
 * saying exactly what it said when it was saved.
 */
describe("opening a sketch older than kept names", () => {
  it("writes down the letters that version lettered the page with", () => {
    const { pages } = parse(file(10, [stored("p1", 0), stored("p2", 10), stored("p3", 20)]));
    expect(called(pages[0].objects, "p1")).toBe("A");
    expect(called(pages[0].objects, "p2")).toBe("B");
    expect(called(pages[0].objects, "p3")).toBe("C");
  });

  it("letters what was never labelled too, since its readings printed those letters", () => {
    // Only the third point showed a label, but a measurement between the first
    // two printed their letters, and every other printer of a name did the
    // same. Naming only what showed would open the file reading "?? = 5 cm".
    const { pages } = parse(
      file(10, [stored("p1", 0), stored("p2", 10), stored("p3", 20, { shown: true })]),
    );
    expect(called(pages[0].objects, "p1")).toBe("A");
    expect(called(pages[0].objects, "p3")).toBe("C");
  });

  it("leaves a name that was typed exactly as it was typed", () => {
    const { pages } = parse(
      file(10, [stored("p1", 0, { name: "Q", shown: true }), stored("p2", 10)]),
    );
    expect(called(pages[0].objects, "p1")).toBe("Q");
    // The run steps over a name already spoken for, as it always did.
    expect(called(pages[0].objects, "p2")).toBe("A");
  });

  it("leaves a sketch that already keeps its names alone", () => {
    const { pages } = parse(file(11, [stored("p1", 0), stored("p2", 10, { shown: true })]));
    expect(called(pages[0].objects, "p1")).toBeUndefined();
    expect(called(pages[0].objects, "p2")).toBeUndefined();
  });

  it("refuses a sketch from a newer version rather than half-reading it", () => {
    expect(() => parse(file(99, [stored("p1", 0)]))).toThrow(/newer version/);
  });

  it("refuses one with no version at all, rather than reading it as either", () => {
    // Neither old nor new: without this it would fall through both branches and
    // open with its labels lettered as nothing.
    const versionless = JSON.stringify({
      format: "grasp-sketch",
      pages: [{ name: "Page 1", objects: [stored("p1", 0, { shown: true })] }],
    });
    expect(() => parse(versionless)).toThrow(/damaged/);
  });
});
