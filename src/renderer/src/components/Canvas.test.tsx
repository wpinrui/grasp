/**
 * The sheet as it draws, held to the letter.
 *
 * The canvas is the one part of GRASP that cannot be checked by reading the
 * types: a layer that stops drawing, or draws in the wrong order, or loses a
 * class, still compiles. So the figure below is drawn over a fixed viewport and
 * the SVG it comes out as is pinned. Splitting the component is meant to change
 * none of it, and anything that does change shows up here rather than on
 * someone's screen.
 *
 * The ids in the figure are written out rather than counted out by `nextId`,
 * which stamps a random token into every id and would put a different string in
 * the markup on every run.
 */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SketchObject, SketchState } from "../sketch/model";
import { useSketch } from "../sketch/useSketch";
import { SHEET, stubSheetBox } from "../testing/sheet";
import { Canvas } from "./Canvas";

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
    id: "but",
    kind: "button",
    name: "Show",
    does: { form: "hide-show", does: "toggle", of: ["C"] },
    x: 560,
    y: 260,
  },
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

interface HarnessProps {
  objects: SketchObject[];
  tool: string;
  /** What is picked when the figure is laid out. */
  selection?: string[];
  /** Called on every render with the page as it stands, for a test to read. */
  report?: (state: SketchState) => void;
  /** An object lit up from somewhere else, so the band drawn on it is covered. */
  spotlight?: string | null;
  /** What a dialog is holding, so the rings and bands it draws are covered. */
  marks?: { id: string; label: string }[];
}

/**
 * The canvas as the window puts it up, with the props that do not matter to
 * what is drawn tied off.
 */
function Harness({
  objects,
  tool,
  selection = [],
  report,
  spotlight = null,
  marks = [],
}: HarnessProps) {
  const sketch = useSketch();
  const laid = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the figure is laid out once, and the sketch handle is stable
  useEffect(() => {
    if (laid.current) return;
    laid.current = true;
    sketch.commit({ objects, selection });
  }, []);
  report?.(sketch.state);
  return (
    <Canvas
      activeTool={tool}
      sketch={sketch}
      pointSize="medium"
      view={sketch.view}
      onView={sketch.setView}
      picking={false}
      onPick={() => {}}
      lineForm="segment"
      polygonKind="interior"
      preview={[]}
      marks={marks}
      onRename={() => {}}
      spotlight={spotlight}
      onToggleLabel={() => {}}
      labelPick={[]}
      onLabelPick={() => {}}
      onEditValue={() => {}}
      onPressButton={() => {}}
      onCaptureRow={() => {}}
      onDropRow={() => {}}
      onMarkMirror={() => {}}
      editing={null}
      onEditing={() => {}}
      editor={{ current: null }}
      zoomable
      captionWanted={0}
      captionLook={{
        font: "Times New Roman",
        size: 14,
        colour: "--color-ink-black",
        align: "left",
      }}
      onViewport={() => {}}
      snapping={{
        objects: true,
        length: false,
        lengthCm: 1,
        angle: false,
        angleDegrees: 15,
        moving: false,
      }}
      measureKind="length"
      arrowKind="all"
      markForm="equal"
      hiddenKinds={{ marks: false, text: false }}
    />
  );
}

/**
 * Everything the sheet drew: the SVG the geometry is drawn in, and the labels,
 * captions and readings, which are HTML sitting over it.
 */
function drawn(container: HTMLElement): string {
  const sheet = container.querySelector(".canvas__sheet");
  if (!sheet) throw new Error("The canvas drew no sheet at all.");
  return sheet.innerHTML;
}

function put(
  objects: SketchObject[],
  tool: string,
  more: Omit<HarnessProps, "objects" | "tool"> = {},
) {
  return render(<Harness objects={objects} tool={tool} {...more} />);
}

let unstub: () => void;

beforeEach(() => {
  // jsdom has no ResizeObserver and lays nothing out, so the sheet is told its
  // size once. Without it the viewport is nothing and every line is clipped
  // away to nothing with it.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly said: ResizeObserverCallback) {}
      observe() {
        this.said(
          [{ contentRect: { width: SHEET.width, height: SHEET.height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  unstub = stubSheetBox();
  // jsdom implements no pointer capture, which every gesture on the sheet takes.
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  unstub();
  cleanup();
  vi.unstubAllGlobals();
});

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
  it("lights a fill as the shape it is", () => {
    const { container } = put(FIGURE, "arrow", { spotlight: "fill" });
    const band = container.querySelector("polygon.canvas__snap-band--round");
    expect(band).not.toBe(null);
    expect(band?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(band?.getAttribute("data-id")).toBe(null);
  });
});

describe("the gestures the sheet is drawn with", () => {
  function sheetOf(container: HTMLElement): HTMLElement {
    const found = container.querySelector(".canvas__sheet");
    if (!found) throw new Error("There is no sheet to press on.");
    return found as HTMLElement;
  }

  function press(element: HTMLElement, at: { x: number; y: number }) {
    fireEvent.pointerDown(element, { clientX: at.x, clientY: at.y, button: 0, pointerId: 1 });
    fireEvent.pointerUp(element, { clientX: at.x, clientY: at.y, button: 0, pointerId: 1 });
  }

  /** The page as it stood at the last render, which is where a gesture lands. */
  function watched(objects: SketchObject[], tool: string) {
    const seen: SketchState[] = [];
    const { container } = put(objects, tool, { report: (read) => seen.push(read) });
    return {
      sheet: sheetOf(container),
      page: () => seen[seen.length - 1] ?? { objects: [], selection: [] },
    };
  }

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
    const sheet = container.querySelector(".canvas__sheet") as HTMLElement;
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
        "but",
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
