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
    // Nothing until the pointer has been on the sheet.
    expect(container.querySelector(".tool-cursor--away")).not.toBe(null);
    expect(sheet.className).not.toContain("canvas__sheet--drawn-cursor");

    moveTo(sheet, { x: 220, y: 160 });
    expect(container.querySelector(".tool-cursor--away")).toBe(null);
    expect(sheet.className).toContain("canvas__sheet--drawn-cursor");
    expect((container.querySelector(".tool-cursor") as HTMLElement).style.transform).toBe(
      `translate(${220 - HOTSPOT.x}px, ${160 - HOTSPOT.y}px)`,
    );
  });

  it("follows the pointer across the sheet", () => {
    const { container } = put([], "compass");
    const sheet = sheetOf(container);
    moveTo(sheet, { x: 100, y: 100 });
    moveTo(sheet, { x: 340, y: 260 });
    expect((container.querySelector(".tool-cursor") as HTMLElement).style.transform).toBe(
      `translate(${340 - HOTSPOT.x}px, ${260 - HOTSPOT.y}px)`,
    );
  });

  it("goes when the pointer leaves, and gives the browser its cursor back", () => {
    const { container } = put([], "marker");
    const sheet = sheetOf(container);
    moveTo(sheet, { x: 200, y: 200 });
    act(() => {
      fireEvent.pointerLeave(sheet);
    });
    expect(container.querySelector(".tool-cursor--away")).not.toBe(null);
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
    expect(container.querySelector(".tool-cursor--away")).not.toBe(null);
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
