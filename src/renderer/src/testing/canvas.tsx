/**
 * The canvas as a test puts it up: the harness, and the stubs jsdom needs before
 * the sheet will draw or take a gesture at all.
 *
 * It lives apart from the tests so that more than one suite can draw the same
 * sheet the same way. The figure is not here: each suite brings the one it is
 * about.
 */

import { fireEvent, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { Canvas } from "../components/Canvas";
import type { SketchObject, SketchState } from "../sketch/model";
import { useSketch } from "../sketch/useSketch";
import { SHEET, stubSheetBox } from "./sheet";

/** How a caption comes out, which makes no difference to any test. */
const CAPTION_LOOK = {
  font: "Times New Roman",
  size: 14,
  colour: "--color-ink-black",
  align: "left",
} as const;

/**
 * Snapping as the app ships it: on to objects, which always wins over the rest,
 * and off for length, angle and moving. A gesture aimed near a point does land
 * on the point.
 */
const SNAPPING = {
  objects: true,
  length: false,
  lengthCm: 1,
  angle: false,
  angleDegrees: 15,
  moving: false,
};

export interface HarnessProps {
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
  /** The ghosts of what a dialog would make, which are drawn as a preview. */
  preview?: SketchObject[];
  /** What the Text tool is armed with: captions, or a relabel run. */
  labelKind?: string;
  /** The letter a relabel run would write next, or null before one has started. */
  relabelName?: string | null;
  onRelabelAsk?: (id: string, at: { x: number; y: number }) => void;
  onRelabelGive?: (id: string) => void;
  onRegularAsk?: (asked: { spot: { x: number; y: number }; at: { x: number; y: number } }) => void;
  /** What the polygon tool is armed with, since one of them opens a box. */
  polygonKind?: string;
  /** What the Arrow is armed with, which is what its cursor is badged by. */
  arrowKind?: string;
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
  preview = [],
  labelKind = "caption",
  arrowKind = "all",
  relabelName = null,
  onRelabelAsk = () => {},
  onRelabelGive = () => {},
  onRegularAsk = () => {},
  polygonKind = "interior-edges",
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
      tieReadings={false}
      view={sketch.view}
      onView={sketch.setView}
      picking={false}
      onPick={() => {}}
      lineForm="segment"
      polygonKind={polygonKind}
      preview={preview}
      marks={marks}
      onRename={() => {}}
      labelKind={labelKind}
      relabelName={relabelName}
      onRelabelAsk={onRelabelAsk}
      onRelabelGive={onRelabelGive}
      onRegularAsk={onRegularAsk}
      spotlight={spotlight}
      onToggleLabel={() => {}}
      labelPick={[]}
      onLabelPick={() => {}}
      onEditValue={() => {}}
      onCaptureRow={() => {}}
      onDropRow={() => {}}
      onMarkMirror={() => {}}
      editing={null}
      onEditing={() => {}}
      editor={{ current: null }}
      zoomable
      captionWanted={0}
      captionLook={CAPTION_LOOK}
      onViewport={() => {}}
      snapping={SNAPPING}
      measureKind="length"
      arrowKind={arrowKind}
      markForm="equal"
      hiddenKinds={{ marks: false, text: false }}
    />
  );
}

export function put(
  objects: SketchObject[],
  tool: string,
  more: Omit<HarnessProps, "objects" | "tool"> = {},
) {
  return render(<Harness objects={objects} tool={tool} {...more} />);
}

/** The sheet inside what was rendered, which is what a gesture is aimed at. */
export function sheetOf(container: HTMLElement): HTMLElement {
  const found = container.querySelector(".canvas__sheet");
  if (!found) throw new Error("There is no sheet to press on.");
  return found as HTMLElement;
}

/** A click: down and up in the one spot, which is what most gestures are. */
export function press(element: HTMLElement, at: { x: number; y: number }) {
  fireEvent.pointerDown(element, { clientX: at.x, clientY: at.y, button: 0, pointerId: 1 });
  fireEvent.pointerUp(element, { clientX: at.x, clientY: at.y, button: 0, pointerId: 1 });
}

/**
 * The page as it stood at the last render, which is where a gesture lands, and
 * the way to re-arm the tool without laying the figure out again: the harness
 * lays it out once, so a second render is the same sheet with the tool changed.
 */
export function watched(
  objects: SketchObject[],
  tool: string,
  more: Omit<HarnessProps, "objects" | "tool" | "report"> = {},
) {
  const seen: SketchState[] = [];
  const props = { ...more, report: (read: SketchState) => seen.push(read) };
  const shown = render(<Harness objects={objects} tool={tool} {...props} />);
  return {
    sheet: sheetOf(shown.container),
    page: () => seen[seen.length - 1] ?? { objects: [], selection: [] },
    rearm: (part: Omit<HarnessProps, "objects" | "tool">) =>
      shown.rerender(<Harness objects={objects} tool={tool} {...props} {...part} />),
  };
}

/**
 * Everything jsdom will not do for itself: a size for the sheet, a size for
 * every box on it, and the pointer capture every gesture takes. Called at the
 * top of a suite that draws the sheet.
 */
export function stubTheSheet(): void {
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

  // Unmounting is not one of jsdom's gaps, so it is left to the suite.
  afterEach(() => {
    unstub();
    vi.unstubAllGlobals();
  });
}
