/**
 * The sheet as it draws, held to the letter.
 *
 * The canvas is the one part of GRASP that cannot be checked by reading the
 * types: a layer that stops drawing, or draws in the wrong order, or loses a
 * class, still compiles. So the figure is drawn over a fixed viewport and the
 * SVG it comes out as is pinned. Splitting the component is meant to change
 * none of it, and anything that does change shows up here rather than on
 * someone's screen.
 *
 * The harness lives in `testing/canvas`, since more than one suite draws the
 * same sheet. The ids in the figure are written out rather than counted out by
 * `nextId`, which stamps a random token into every id and would put a different
 * string in the markup on every run.
 */

import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createCircle,
  createInterior,
  createLocus,
  createPoint,
  lineThrough,
  type SketchObject,
} from "../sketch/model";
import { press, put, sheetOf, stubTheSheet, watched } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

/** A figure holding one of every kind the layers draw. */
const FIGURE: SketchObject[] = [
  { id: "A", kind: "point", x: 120, y: 420, size: "medium", label: { name: "A", shown: true } },
  { id: "B", kind: "point", x: 520, y: 420, size: "medium", label: { name: "B", shown: true } },
  { id: "C", kind: "point", x: 320, y: 140, size: "large", label: { name: "C", shown: true } },
  // Derived, so `settle` has something to work out rather than read.
  {
    id: "M",
    kind: "point",
    x: 0,
    y: 0,
    size: "small",
    from: { kind: "midpoint", of: "A", and: "B" },
  },
  { id: "seg", kind: "line", form: "segment", span: { kind: "through", ends: ["A", "B"] } },
  { id: "ray", kind: "line", form: "ray", span: { kind: "through", ends: ["A", "C"] } },
  { id: "circ", kind: "circle", span: { kind: "through", centre: "C", edge: "A" } },
  { id: "arc", kind: "arc", span: { kind: "through", from: "A", via: "C", to: "B" } },
  { id: "fill", kind: "interior", vertices: ["A", "B", "C"] },
  { id: "tick", kind: "mark", form: "equal", path: "seg", at: 0.5, strokes: 2 },
  {
    id: "ang",
    kind: "mark",
    form: "angle",
    corner: "A",
    arms: ["B", "C"],
    sides: ["seg", "ray"],
    strokes: 1,
    radius: 28,
  },
  { id: "len", kind: "measurement", measure: "length", of: ["seg"], x: 200, y: 470 },
  // A locus, and the point and path it is driven along, so the layer that draws
  // it is covered. Its domain is a segment, which has two ends of its own, so
  // no arrowhead is drawn on it and that half is covered in `shapes.test.ts`.
  {
    id: "D",
    kind: "point",
    x: 200,
    y: 300,
    size: "small",
    from: { kind: "on", path: "seg", at: 0.2 },
  },
  {
    id: "E",
    kind: "point",
    x: 0,
    y: 0,
    size: "small",
    from: { kind: "midpoint", of: "D", and: "C" },
  },
  { id: "loc", kind: "locus", driver: "D", domain: "seg", driven: "E", span: [0, 1], samples: 12 },
  { id: "par", kind: "parameter", value: 3, unit: "none", places: 1, x: 560, y: 120 },
  { id: "calc", kind: "calculation", expression: { kind: "number", value: 2 }, x: 560, y: 160 },
  { id: "tab", kind: "table", of: ["par"], rows: [], x: 560, y: 200 },
  {
    id: "cap",
    kind: "caption",
    x: 100,
    y: 500,
    width: 220,
    html: "Triangle <b>ABC</b>",
    align: "left",
    font: "Times New Roman",
    size: 14,
    colour: "--color-ink-black",
  },
];

/**
 * Everything the sheet drew: the SVG the geometry is drawn in, and the labels,
 * captions and readings, which are HTML sitting over it.
 */
function drawn(container: HTMLElement): string {
  const sheet = container.querySelector(".canvas__sheet");
  if (!sheet) throw new Error("The canvas drew no sheet at all.");
  return sheet.innerHTML;
}

describe("the figure on the sheet", () => {
  it("draws every layer of it", () => {
    const { container } = put(FIGURE, "arrow");
    expect(drawn(container)).toMatchSnapshot();
  });

  it("draws the same figure picked, haloes and all", () => {
    const { container } = put(FIGURE, "arrow", {
      selection: FIGURE.map((object) => object.id),
    });
    expect(drawn(container)).toMatchSnapshot();
  });

  /**
   * The bands and rings the window asks for rather than the page: an object lit
   * up from somewhere else, and the points and paths a dialog is holding. The
   * two figures above draw none of it, so the layers that lay it out would move
   * with nothing watching.
   */
  it("draws what the window is pointing at, lit and held", () => {
    const { container } = put(FIGURE, "arrow", {
      spotlight: "ang",
      marks: [
        { id: "A", label: "1" },
        { id: "seg", label: "2" },
      ],
    });
    expect(container.querySelector(".canvas__snap-band")).not.toBe(null);
    // The mark lights its two sides with it, which are straight objects.
    expect(container.querySelectorAll("line.canvas__snap-band")).toHaveLength(2);
    expect(container.querySelector(".canvas__mark")).not.toBe(null);
    expect(container.querySelector(".canvas__mark-band")).not.toBe(null);
    expect(drawn(container)).toMatchSnapshot();
  });

  /**
   * A lit fill is drawn as the shape it is, which is the one way an interior is
   * drawn that carries a stroke to keep at any zoom and no id to pick by.
   */
  /**
   * A locus running along a ray is open at one end, so it carries an arrowhead
   * there to drag it further. The figure above runs its locus along a segment,
   * which fixes both ends, so nothing in it draws one.
   */
  it("draws the arrowhead an open locus is dragged by", () => {
    const open = [
      ...FIGURE,
      { ...lineThrough("ray", ["A", "B"]), id: "open-dom" },
      {
        ...createLocus({ driver: "D", domain: "open-dom", driven: "M", span: [0, 1], samples: 4 }),
        id: "open-loc",
      },
    ];
    const { container } = put(open, "arrow");
    expect(container.querySelectorAll("polygon.canvas__locus-arrow")).toHaveLength(1);
  });

  it("lights a fill as the shape it is", () => {
    const { container } = put(FIGURE, "arrow", { spotlight: "fill" });
    const band = container.querySelector("polygon.canvas__snap-band--round");
    expect(band).not.toBe(null);
    expect(band?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(band?.getAttribute("data-id")).toBe(null);
  });

  /**
   * The ghosts of what an open dialog would make. They settle against a page
   * that has them on it, which is not the page that is drawn, so nothing in the
   * figures above reaches them.
   */
  it("draws the ghosts of what a dialog would make", () => {
    const P = { ...createPoint({ x: 600, y: 500 }, "medium"), id: "P" };
    const Q = { ...createPoint({ x: 700, y: 560 }, "medium"), id: "Q" };
    const { container } = put(FIGURE, "arrow", {
      preview: [
        P,
        Q,
        { ...lineThrough("segment", ["P", "Q"]), id: "ghost-line" },
        { ...createCircle({ kind: "through", centre: "P", edge: "Q" }), id: "ghost-round" },
        { ...createInterior(["P", "Q", "A"]), id: "ghost-fill" },
        {
          ...createLocus({ driver: "P", domain: "ray", driven: "Q", span: [0, 1], samples: 4 }),
          id: "ghost-locus",
        },
      ],
    });
    expect(container.querySelector("line.canvas__line--preview")).not.toBe(null);
    expect(container.querySelector("circle.canvas__circle--preview")).not.toBe(null);
    expect(container.querySelector("polygon.canvas__interior--preview")).not.toBe(null);
    expect(container.querySelectorAll("circle.canvas__point--preview")).toHaveLength(2);
    expect(container.querySelector(".canvas__locus--preview")).not.toBe(null);
    expect(drawn(container)).toMatchSnapshot();
  });
});

describe("the gestures the sheet is drawn with", () => {
  it("plots a point where the Point tool is clicked", () => {
    const { sheet, page } = watched([], "point");
    act(() => press(sheet, { x: 100, y: 120 }));
    expect(page().objects).toHaveLength(1);
    // The view opens at the origin at 100%, so the click lands where it was made.
    expect(page().objects[0]).toMatchObject({ kind: "point", x: 100, y: 120 });
  });

  it("draws a segment across two clicks of the straightedge", () => {
    const { sheet, page } = watched([], "straightedge");
    act(() => press(sheet, { x: 100, y: 100 }));
    act(() => press(sheet, { x: 300, y: 200 }));
    expect(page().objects.map((object) => object.kind)).toEqual(["point", "point", "line"]);
  });

  /**
   * Between the two clicks the sheet says what it would draw: how long the line
   * is so far, and the angle it makes. It is gone the moment the line lands.
   */
  it("says what a half-drawn line comes to, until it lands", () => {
    const { container } = put([], "straightedge");
    const sheet = sheetOf(container);
    act(() => press(sheet, { x: 100, y: 100 }));
    act(() => {
      fireEvent.pointerMove(sheet, { clientX: 300, clientY: 200, pointerId: 1 });
    });
    expect(container.querySelector(".canvas__guide")).not.toBe(null);
    expect(container.querySelector(".canvas__guide-datum")).not.toBe(null);
    act(() => press(sheet, { x: 300, y: 200 }));
    expect(container.querySelector(".canvas__guide")).toBe(null);
  });

  /**
   * A length asked to be drawn out gets a run between the segment's ends with an
   * arrowhead at each. The figures above carry a bare number instead, so nothing
   * there reaches the layer that lays that out.
   */
  it("draws out a length that is asked to be drawn out", () => {
    const bounded = FIGURE.map((object) =>
      object.id === "len" ? { ...object, bounds: "full" as const } : object,
    );
    const { container } = put(bounded, "arrow");
    expect(container.querySelector(".canvas__dimension")).not.toBe(null);
    expect(container.querySelectorAll(".canvas__dimension-head")).toHaveLength(2);
  });

  it("catches what a marquee is dragged over", () => {
    const { sheet, page } = watched(FIGURE, "arrow");
    act(() => {
      // From a corner of bare sheet: the circle drawn about C is wide enough
      // that a press near the top left lands on it and drags it instead.
      fireEvent.pointerDown(sheet, { clientX: 795, clientY: 595, button: 0, pointerId: 1 });
      fireEvent.pointerMove(sheet, { clientX: 60, clientY: 60, button: 0, pointerId: 1 });
      fireEvent.pointerUp(sheet, { clientX: 60, clientY: 60, button: 0, pointerId: 1 });
    });
    // Everything the box was pulled over, not merely something.
    expect([...page().selection].sort()).toEqual(
      [
        "A",
        "B",
        "C",
        "D",
        "E",
        "M",
        "ang",
        "arc",
        "calc",
        "cap",
        "circ",
        "fill",
        "len",
        "loc",
        "par",
        "ray",
        "seg",
        "tab",
        "tick",
      ].sort(),
    );
  });

  it("drags a point to where it was let go", () => {
    const { sheet, page } = watched(FIGURE, "arrow");
    act(() => {
      fireEvent.pointerDown(sheet, { clientX: 120, clientY: 420, button: 0, pointerId: 1 });
      fireEvent.pointerMove(sheet, { clientX: 160, clientY: 450, button: 0, pointerId: 1 });
      fireEvent.pointerUp(sheet, { clientX: 160, clientY: 450, button: 0, pointerId: 1 });
    });
    const moved = page().objects.find((object) => object.id === "A");
    expect(moved).toMatchObject({ x: 160, y: 450 });
  });
});
