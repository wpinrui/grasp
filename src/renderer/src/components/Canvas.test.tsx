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
import { Canvas } from "./Canvas";

/** The size the sheet reports, since jsdom lays nothing out. */
const SHEET = { width: 800, height: 600 };

/** A figure with one of everything the layers draw. */
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
}

/**
 * The canvas as the window puts it up, with the props that do not matter to
 * what is drawn tied off.
 */
function Harness({ objects, tool, selection = [], report }: HarnessProps) {
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
      marks={[]}
      onRename={() => {}}
      spotlight={null}
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
  more: { selection?: string[]; report?: (state: SketchState) => void } = {},
) {
  return render(
    <Harness objects={objects} tool={tool} selection={more.selection} report={more.report} />,
  );
}

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
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: SHEET.width,
      bottom: SHEET.height,
      ...SHEET,
    }) as DOMRect;
  // jsdom implements no pointer capture, which every gesture on the sheet takes.
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
});

afterEach(() => {
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
    expect(page().objects[0].kind).toBe("point");
  });

  it("draws a segment across two clicks of the straightedge", () => {
    const { sheet, page } = watched([], "straightedge");
    act(() => press(sheet, { x: 100, y: 100 }));
    act(() => press(sheet, { x: 300, y: 200 }));
    expect(page().objects.map((object) => object.kind)).toEqual(["point", "point", "line"]);
  });

  it("catches what a marquee is dragged over", () => {
    const { sheet, page } = watched(FIGURE, "arrow");
    act(() => {
      fireEvent.pointerDown(sheet, { clientX: 5, clientY: 5, button: 0, pointerId: 1 });
      fireEvent.pointerMove(sheet, { clientX: 700, clientY: 500, button: 0, pointerId: 1 });
      fireEvent.pointerUp(sheet, { clientX: 700, clientY: 500, button: 0, pointerId: 1 });
    });
    expect(page().selection.length).toBeGreaterThan(0);
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
