/**
 * The drawn cursor as a user meets it: on the sheet, following the pointer, and
 * gone the moment the pointer is. What it looks like cannot be checked
 * headlessly, but whether it is there, where it is put, and whether the browser
 * has been told to stop drawing its own, all can.
 */

import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { put, sheetOf, stubTheSheet } from "../testing/canvas";
import { BADGES, HOTSPOT } from "./canvas/cursorGeometry";

stubTheSheet();
afterEach(cleanup);

/** The stubbed sheet sits at the window's corner, so a client point is a sheet point. */
const ORIGIN = { x: 0, y: 0 };

/** Where each layer of the cursor has been put. Both must agree, or the outline
 *  and the glyph come apart. */
function placedIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".tool-cursor")].map(
    (layer) => layer.style.transform,
  );
}

/** How many of the layers are out of sight. Half of them is as wrong as none. */
function hiddenIn(container: HTMLElement): number {
  return container.querySelectorAll(".tool-cursor--away").length;
}

function moveTo(sheet: HTMLElement, at: { x: number; y: number }) {
  act(() => {
    fireEvent.pointerMove(sheet, {
      clientX: ORIGIN.x + at.x,
      clientY: ORIGIN.y + at.y,
      pointerId: 1,
      pointerType: "mouse",
    });
  });
}

describe("the cursor the sheet draws", () => {
  it("comes up under the pointer, and takes the browser's cursor away", () => {
    const { container } = put([], "point");
    const sheet = sheetOf(container);
    // Nothing until the pointer has been on the sheet, and nothing by halves:
    // one layer left showing is the outline or the glyph on its own.
    expect(hiddenIn(container)).toBe(2);
    expect(sheet.className).not.toContain("canvas__sheet--drawn-cursor");

    moveTo(sheet, { x: 220, y: 160 });
    expect(hiddenIn(container)).toBe(0);
    expect(sheet.className).toContain("canvas__sheet--drawn-cursor");
    const spot = `translate(${220 - HOTSPOT.x}px, ${160 - HOTSPOT.y}px)`;
    // Both layers, together: they only read as one cursor while they agree.
    expect(placedIn(container)).toEqual([spot, spot]);
  });

  it("follows the pointer across the sheet", () => {
    const { container } = put([], "compass");
    const sheet = sheetOf(container);
    moveTo(sheet, { x: 100, y: 100 });
    moveTo(sheet, { x: 340, y: 260 });
    const spot = `translate(${340 - HOTSPOT.x}px, ${260 - HOTSPOT.y}px)`;
    expect(placedIn(container)).toEqual([spot, spot]);
  });

  it("goes when the pointer leaves, and gives the browser its cursor back", () => {
    const { container } = put([], "marker");
    const sheet = sheetOf(container);
    moveTo(sheet, { x: 200, y: 200 });
    act(() => {
      fireEvent.pointerLeave(sheet);
    });
    expect(hiddenIn(container)).toBe(2);
    expect(sheet.className).not.toContain("canvas__sheet--drawn-cursor");
  });

  it("draws none under a finger, which has no cursor to replace", () => {
    const { container } = put([], "point");
    const sheet = sheetOf(container);
    act(() => {
      fireEvent.pointerMove(sheet, {
        clientX: 200,
        clientY: 200,
        pointerId: 1,
        pointerType: "touch",
      });
    });
    expect(hiddenIn(container)).toBe(2);
    expect(sheet.className).not.toContain("canvas__sheet--drawn-cursor");
  });

  it("draws none for the hand, which keeps the platform's grab", () => {
    const { container } = put([], "hand");
    const sheet = sheetOf(container);
    moveTo(sheet, { x: 200, y: 200 });
    expect(container.querySelector(".tool-cursor")).toBe(null);
    expect(sheet.className).not.toContain("canvas__sheet--drawn-cursor");
  });

  it("badges the Arrow with the arming the window is holding", () => {
    const marks = (container: HTMLElement) =>
      container.querySelectorAll(".tool-cursor")[1].querySelectorAll("path, text, circle").length;
    const plain = put([], "arrow", { arrowKind: "all" });
    moveTo(sheetOf(plain.container), { x: 200, y: 200 });
    const armed = put([], "arrow", { arrowKind: "points" });
    moveTo(sheetOf(armed.container), { x: 200, y: 200 });
    expect(marks(armed.container)).toBe(
      marks(plain.container) + BADGES["arrow.points"].marks.length,
    );
  });
});
