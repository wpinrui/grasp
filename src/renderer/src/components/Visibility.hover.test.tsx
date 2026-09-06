import { cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createMeasurement, createPoint, createTick, lineThrough } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";
import { put, stubTheSheet } from "../testing/canvas";
import { HiddenPanel } from "./HiddenPanel";
import { LabelPanel } from "./LabelPanel";

stubTheSheet();
afterEach(cleanup);

function figure() {
  const a = { ...createPoint({ x: 100, y: 100 }, "medium"), label: { name: "A", shown: false } };
  const b = { ...createPoint({ x: 400, y: 100 }, "medium"), label: { name: "B", shown: false } };
  const line = { ...lineThrough("segment", [a.id, b.id]), label: { name: "j", shown: false } };
  return { a, b, line };
}

it("previews row, selected, group and page labels while preserving committed actions and history", () => {
  const { a, b, line } = figure();
  const objects = [a, b, line];
  const commit = vi.fn();
  let sketch!: Sketch;
  const ui = put(objects, "arrow", {
    selection: [a.id],
    reportSketch: (value) => {
      sketch = value;
    },
    controls: (
      <LabelPanel
        rows={objects.map((object) => ({
          id: object.id,
          name: object.label.name,
          kind: object.kind === "line" ? "segment" : "point",
          shown: false,
          selected: object.id === a.id,
        }))}
        onRename={() => {}}
        onShow={commit}
        onSpot={() => {}}
        labelNew={false}
        onLabelNew={() => {}}
      />
    ),
  });
  const original = sketch.read();
  const undo = sketch.canUndo;
  const row = ui.getByRole("button", { name: "A" }).parentElement;
  const page = ui.getByText("Page").parentElement;
  const selected = ui.getByText("Selected").parentElement;
  const group = ui.getByRole("button", { name: /^Points/ }).parentElement;
  if (!row || !page || !selected || !group) throw new Error("Missing label controls");
  const cases: [HTMLElement, string[]][] = [
    [within(row).getByRole("button", { name: "Show this label" }), ["A"]],
    [within(selected).getByRole("button", { name: "Show" }), ["A"]],
    [within(group).getByRole("button", { name: "Show" }), ["A", "B"]],
    [within(page).getByRole("button", { name: "Show" }), ["A", "B", "j"]],
  ];
  for (const [button, names] of cases) {
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(
      [...ui.container.querySelectorAll(".canvas__label")].map((label) => label.textContent).sort(),
    ).toEqual(names.sort());
    expect(sketch.read()).toBe(original);
    expect(sketch.canUndo).toBe(undo);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerLeave(button);
    expect(ui.container.querySelectorAll(".canvas__label")).toHaveLength(0);
  }
});

it("previews individual, group, all and whole-kind visibility without changing committed visibility", () => {
  const { a, b, line } = figure();
  const objects = [a, b, line].map((object) => ({ ...object, hidden: true }));
  const mark = createTick({ path: line.id, form: "equal", at: 0.5, strokes: 1, flipped: false });
  const reading = createMeasurement("length", [line.id], { x: 200, y: 150 });
  const kinds = { marks: true, text: true };
  const commit = vi.fn();
  let sketch!: Sketch;
  const ui = put([...objects, mark, reading], "arrow", {
    hiddenKinds: kinds,
    reportSketch: (value) => {
      sketch = value;
    },
    controls: (
      <HiddenPanel
        rows={objects.map((object) => ({
          id: object.id,
          name: object.label.name,
          kind: object.kind === "line" ? "segment" : "point",
        }))}
        kinds={kinds}
        onKinds={commit}
        onShow={commit}
        onSpot={() => {}}
      />
    ),
  });
  const original = sketch.read();
  const row = ui.getByText("A").parentElement;
  const group = ui.getByText("Points").parentElement;
  if (!row || !group) throw new Error("Missing hidden controls");
  const cases: [HTMLElement, number, number, number][] = [
    [within(row).getByRole("button", { name: "Show" }), 1, 0, 0],
    [within(group).getByRole("button", { name: "Show" }), 2, 0, 0],
    [ui.getByRole("button", { name: "Show all" }), 2, 0, 0],
    [ui.getByRole("switch", { name: "Hide all markings" }), 0, 1, 0],
    [ui.getByRole("switch", { name: "Hide all text" }), 0, 0, 1],
  ];
  for (const [button, points, marks, readings] of cases) {
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(ui.container.querySelectorAll(".canvas__point")).toHaveLength(points);
    expect(ui.container.querySelectorAll(".canvas__mark-stroke")).toHaveLength(marks);
    expect(ui.container.querySelectorAll(".reading")).toHaveLength(readings);
    expect(sketch.read()).toBe(original);
    expect(commit).not.toHaveBeenCalled();
    expect(kinds).toEqual({ marks: true, text: true });
    fireEvent.pointerLeave(button);
    expect(
      ui.container.querySelectorAll(".canvas__point, .canvas__mark-stroke, .reading"),
    ).toHaveLength(0);
  }
});
