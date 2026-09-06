import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createMeasurement, createPoint, createTick, lineThrough } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";
import { press, put, stubTheSheet, watched } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

it("previews a point's snapped location without creating it, and clears it on leave and touch", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const ui = watched([a, b, line], "point");
  fireEvent.pointerMove(ui.sheet, { clientX: 200, clientY: 103, pointerType: "mouse" });
  const ghost = ui.sheet.querySelector(".canvas__point--preview");
  expect(ghost?.getAttribute("cx")).toBe("200");
  expect(ghost?.getAttribute("cy")).toBe("100");
  expect(ui.page().objects).toHaveLength(3);
  fireEvent.pointerLeave(ui.sheet);
  expect(ui.sheet.querySelector(".canvas__point--preview")).toBeNull();
  fireEvent.pointerMove(ui.sheet, { clientX: 200, clientY: 150, pointerType: "touch" });
  expect(ui.sheet.querySelector(".canvas__point--preview")).toBeNull();
  fireEvent.pointerMove(ui.sheet, { clientX: 100, clientY: 100, pointerType: "mouse" });
  expect(ui.sheet.querySelector(".canvas__point--preview")).toBeNull();
});

it("draws a translucent side mark before a click and commits the same strokes", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const ui = watched([a, b, line], "marker");
  fireEvent.pointerMove(ui.sheet, { clientX: 250, clientY: 100, pointerType: "mouse" });
  const shape = ui.sheet.querySelector(".canvas__mark-stroke--preview")?.getAttribute("d");
  expect(shape).toBeTruthy();
  expect(ui.page().objects).toHaveLength(3);
  press(ui.sheet, { x: 250, y: 100 });
  expect(ui.sheet.querySelector(".canvas__mark-stroke--preview")).toBeNull();
  expect(ui.sheet.querySelector(".canvas__mark-stroke")?.getAttribute("d")).toBe(shape);
  expect(ui.page().objects).toHaveLength(4);
  fireEvent.pointerMove(ui.sheet, { clientX: 300, clientY: 100, pointerType: "mouse" });
  expect(ui.sheet.querySelector(".canvas__mark-stroke--preview")).toBeNull();
});

it.each(["ray", "line"] as const)("extends the %s preview to the viewport", (lineForm) => {
  const ui = watched([], "straightedge", { lineForm });
  press(ui.sheet, { x: 100, y: 100 });
  fireEvent.pointerMove(ui.sheet, { clientX: 200, clientY: 100 });
  const ghost = ui.sheet.querySelector(".canvas__rubber");
  expect(Number(ghost?.getAttribute("x2"))).toBeGreaterThan(200);
  if (lineForm === "ray") expect(Number(ghost?.getAttribute("x1"))).toBe(100);
  else expect(Number(ghost?.getAttribute("x1"))).toBeLessThanOrEqual(0);
});

it("previews mark formatting, commits from the original setting, and needs only one undo", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const mark = createTick({ path: line.id, form: "parallel", at: 0.5, strokes: 1, flipped: false });
  let sketch!: Sketch;
  const ui = put([a, b, line, mark], "arrow", {
    reportSketch: (value) => {
      sketch = value;
    },
  });
  const sheet = ui.container.querySelector(".canvas__sheet");
  if (!sheet) throw new Error("Missing canvas");
  fireEvent.doubleClick(sheet, { clientX: 250, clientY: 100 });
  const button = ui.getByRole("button", { name: "Turn the mark round" });
  const original = sketch.read();
  const before = ui.container.querySelector(".canvas__mark-stroke")?.getAttribute("d");
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  const preview = ui.container.querySelector(".canvas__mark-stroke")?.getAttribute("d");
  expect(preview).not.toBe(before);
  expect(sketch.read()).toBe(original);
  fireEvent.click(button);
  expect(ui.container.querySelector(".canvas__mark-stroke")?.getAttribute("d")).toBe(preview);
  act(() => sketch.undo());
  expect(ui.container.querySelector(".canvas__mark-stroke")?.getAttribute("d")).toBe(before);
});

it("previews reading precision without changing the reading or moving its panel", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const reading = createMeasurement("length", [line.id], { x: 200, y: 150 });
  let sketch!: Sketch;
  const ui = put([a, b, line, reading], "arrow", {
    reportSketch: (value) => {
      sketch = value;
    },
  });
  const element = ui.container.querySelector(".reading");
  if (!element) throw new Error("Missing reading");
  fireEvent.doubleClick(element);
  const button = ui.getByRole("button", { name: "One more decimal place" });
  const original = sketch.read();
  const panel = ui.container.querySelector(".mark-panel")?.getAttribute("style");
  const before = ui.container.querySelector(".reading")?.textContent;
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  const preview = ui.container.querySelector(".reading")?.textContent;
  expect(preview).not.toBe(before);
  expect(sketch.read()).toBe(original);
  expect(ui.container.querySelector(".mark-panel")?.getAttribute("style")).toBe(panel);
  fireEvent.click(button);
  expect(ui.container.querySelector(".reading")?.textContent).toBe(preview);
  act(() => sketch.undo());
  expect(ui.container.querySelector(".reading")?.textContent).toBe(before);
});

it.each(["object", "kind"])("removes an open reading panel after committed %s hiding", (way) => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 400, y: 100 }, "medium");
  const line = lineThrough("segment", [a.id, b.id]);
  const reading = createMeasurement("length", [line.id], { x: 200, y: 150 });
  let sketch!: Sketch;
  const ui = watched([a, b, line, reading], "arrow", {
    reportSketch: (value) => {
      sketch = value;
    },
  });
  const element = ui.sheet.querySelector(".reading");
  if (!element) throw new Error("Missing reading");
  fireEvent.doubleClick(element);
  expect(ui.sheet.querySelector(".mark-panel")).not.toBeNull();
  if (way === "kind") ui.rearm({ hiddenKinds: { marks: false, text: true } });
  else
    act(() =>
      sketch.commit({
        ...sketch.read(),
        objects: sketch
          .read()
          .objects.map((object) =>
            object.id === reading.id ? { ...object, hidden: true } : object,
          ),
      }),
    );
  expect(ui.sheet.querySelector(".reading")).toBeNull();
  expect(ui.sheet.querySelector(".mark-panel")).toBeNull();
});
