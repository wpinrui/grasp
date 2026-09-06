import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createMeasurement,
  createPoint,
  isMark,
  isMeasurement,
  lineThrough,
} from "../sketch/model";
import { press, put, stubTheSheet, watched } from "../testing/canvas";

stubTheSheet();
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })),
);
afterEach(cleanup);
const a = { ...createPoint({ x: 200, y: 200 }, "medium"), id: "a" };
const b = { ...createPoint({ x: 350, y: 200 }, "medium"), id: "b" };
const c = { ...createPoint({ x: 200, y: 350 }, "medium"), id: "c" };
const horizontal = { ...lineThrough("line", ["a", "b"]), id: "horizontal" };
const vertical = { ...lineThrough("ray", ["a", "c"]), id: "vertical" };
const objects = [a, b, c, horizontal, vertical];

it("hands a measurement box directly to the open calculator", () => {
  const measurement = createMeasurement("distance", ["a", "b"], { x: 400, y: 400 });
  const pick = vi.fn();
  const shown = put([...objects, measurement], "arrow", { picking: true, onPick: pick });
  const box = shown.container.querySelector<HTMLElement>(`[data-id="${measurement.id}"]`);
  expect(box?.style.pointerEvents).toBe("auto");
  if (box) press(box, { x: 410, y: 410 });
  expect(pick).toHaveBeenCalledExactlyOnceWith(measurement.id);
});

it.each(["marker", "measure"])("traces and commits a reflex angle with the %s tool", (tool) => {
  const shown = watched(objects, tool, { markForm: "angle", measureKind: "angle" });
  const event = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
  fireEvent.pointerDown(shown.sheet, event(260, 200));
  fireEvent.pointerMove(shown.sheet, event(200, 140));
  fireEvent.pointerMove(shown.sheet, event(140, 200));
  fireEvent.pointerMove(shown.sheet, event(200, 260));
  expect(shown.sheet.querySelector(".canvas__mark-stroke")).not.toBeNull();
  fireEvent.pointerUp(shown.sheet, event(200, 260));
  const marks = shown.page().objects.filter(isMark);
  expect(marks).toHaveLength(1);
  expect("corner" in marks[0] && marks[0].reflex).toBe(true);
  if (tool === "measure") expect(shown.page().objects.filter(isMeasurement)[0]?.reflex).toBe(true);
});

it("offers labelled, nondegenerate choices for an unlabelled vertex on a line", () => {
  const shown = put(objects, "measure", { measureKind: "angle" });
  const sheet = shown.container.querySelector<HTMLElement>(".canvas__sheet");
  if (sheet) press(sheet, { x: 200, y: 200 });
  expect(shown.getByText("Which angle at A?")).toBeTruthy();
  expect(shown.container.querySelectorAll(".angles__row")).toHaveLength(2);
  expect(shown.container.querySelector(".angles")?.textContent).not.toContain("?");
});
