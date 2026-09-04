/**
 * The relabel run as the sheet works it: what a click would write, drawn before
 * the click, and where that click lands.
 */

import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SketchObject } from "../sketch/model";
import { press, put, sheetOf, stubTheSheet } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

/** Three labelled vertices, which is all a run has to have something to name. */
const FIGURE: SketchObject[] = [
  { id: "A", kind: "point", x: 120, y: 420, size: "medium", label: { name: "A", shown: true } },
  { id: "B", kind: "point", x: 520, y: 420, size: "medium", label: { name: "B", shown: true } },
  { id: "C", kind: "point", x: 320, y: 140, size: "medium", label: { name: "C", shown: true } },
];

/**
 * A relabel run promises what a click will write before it writes it: the
 * letter, translucent, where the label will hang. The vertex's own label is
 * left out from under it, so it is never drawn saying two names at once.
 */
describe("a relabel run", () => {
  /** Every name drawn beside the figure, the promised one included. */
  function drawn(container: HTMLElement): (string | null)[] {
    return [...container.querySelectorAll(".canvas__label")].map((one) => one.textContent);
  }

  function hover(sheet: HTMLElement, at: { x: number; y: number }) {
    fireEvent.pointerMove(sheet, { clientX: at.x, clientY: at.y, pointerId: 1 });
  }

  it("draws the letter it would write, in place of the label there now", () => {
    const { container } = put(FIGURE, "text", { labelKind: "relabel", relabelName: "Z" });
    const sheet = sheetOf(container);
    act(() => hover(sheet, { x: 120, y: 420 }));
    expect(container.querySelector(".canvas__label--ghost")?.textContent).toBe("Z");
    // A is the vertex under the pointer, so its own label gives way to the Z.
    expect(drawn(container)).not.toContain("A");
    expect(drawn(container)).toContain("B");
  });

  it("gives the label back on leaving the sheet", () => {
    const { container } = put(FIGURE, "text", { labelKind: "relabel", relabelName: "Z" });
    const sheet = sheetOf(container);
    act(() => hover(sheet, { x: 120, y: 420 }));
    act(() => {
      fireEvent.pointerLeave(sheet);
    });
    expect(container.querySelector(".canvas__label--ghost")).toBe(null);
    expect(drawn(container)).toContain("A");
  });

  it("promises nothing over bare sheet", () => {
    const { container } = put(FIGURE, "text", { labelKind: "relabel", relabelName: "Z" });
    act(() => hover(sheetOf(container), { x: 300, y: 300 }));
    expect(container.querySelector(".canvas__label--ghost")).toBe(null);
  });

  it("hands the letter to the vertex clicked", () => {
    const given: string[] = [];
    const { container } = put(FIGURE, "text", {
      labelKind: "relabel",
      relabelName: "Z",
      onRelabelGive: (id) => given.push(id),
    });
    act(() => press(sheetOf(container), { x: 120, y: 420 }));
    expect(given).toEqual(["A"]);
  });

  it("asks which letter to start at before a run is going", () => {
    const asked: string[] = [];
    const given: string[] = [];
    const { container } = put(FIGURE, "text", {
      labelKind: "relabel",
      relabelName: null,
      onRelabelAsk: (id) => asked.push(id),
      onRelabelGive: (id) => given.push(id),
    });
    act(() => press(sheetOf(container), { x: 120, y: 420 }));
    expect(asked).toEqual(["A"]);
    expect(given).toEqual([]);
  });

  it("names nothing when the press was a drag rather than a click", () => {
    const given: string[] = [];
    const { container } = put(FIGURE, "text", {
      labelKind: "relabel",
      relabelName: "Z",
      onRelabelGive: (id) => given.push(id),
    });
    const sheet = sheetOf(container);
    act(() => {
      fireEvent.pointerDown(sheet, { clientX: 120, clientY: 420, button: 0, pointerId: 1 });
      fireEvent.pointerMove(sheet, { clientX: 300, clientY: 300, button: 0, pointerId: 1 });
      fireEvent.pointerUp(sheet, { clientX: 300, clientY: 300, button: 0, pointerId: 1 });
    });
    expect(given).toEqual([]);
  });

  it("leaves bare sheet alone, having no vertex to name", () => {
    const asked: string[] = [];
    const { container } = put(FIGURE, "text", {
      labelKind: "relabel",
      relabelName: null,
      onRelabelAsk: (id) => asked.push(id),
    });
    act(() => press(sheetOf(container), { x: 300, y: 300 }));
    expect(asked).toEqual([]);
  });
});
