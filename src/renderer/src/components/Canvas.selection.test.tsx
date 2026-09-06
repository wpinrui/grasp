import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LABEL_REACH } from "../sketch/labelling";
import {
  createCaption,
  createMeasurement,
  createPoint,
  createTable,
  lineThrough,
} from "../sketch/model";
import { press, stubTheSheet, watched } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

const a = {
  ...createPoint({ x: 100, y: 100 }, "medium"),
  id: "A",
  label: { name: "A", shown: true, off: { x: 0, y: 40 } },
};
const b = {
  ...createPoint({ x: 300, y: 100 }, "medium"),
  id: "B",
  label: { name: "B", shown: true, off: { x: 0, y: 40 } },
};
const segment = {
  ...lineThrough("segment", [a.id, b.id]),
  id: "segment",
  label: { name: "s", shown: true, off: { x: 0, y: -40 } },
};
const length = { ...createMeasurement("length", [segment.id], { x: 200, y: 200 }), id: "length" };
const caption = {
  ...createCaption({ x: 400, y: 200 }, 120, {
    font: "Times New Roman",
    size: 14,
    colour: "--color-ink-black",
  }),
  id: "caption",
  html: "Caption",
};
const table = { ...createTable([length.id], { x: 400, y: 350 }), id: "table" };
const figure = [a, b, segment, length, caption, table];

function labelOn(sheet: HTMLElement, id: string) {
  const label = sheet.querySelector<HTMLElement>(`.canvas__label[data-id="${id}"]`);
  if (!label) throw new Error(`Missing label ${id}`);
  return label;
}

function pickedLabels(sheet: HTMLElement) {
  return [...sheet.querySelectorAll<HTMLElement>(".canvas__label--picked")].map(
    (element) => element.dataset.id,
  );
}

function drag(element: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: to.x, clientY: to.y });
}

describe("consistent selection across geometry and writing", () => {
  it.each([".reading", ".caption", ".table-box"])(
    "plain clicks toggle %s without clearing geometry or labels",
    (selector) => {
      const { sheet, page } = watched(figure, "arrow", {
        selection: [segment.id],
        labelSelection: [a.id],
      });
      const writing = sheet.querySelector<HTMLElement>(selector);
      if (!writing?.dataset.id) throw new Error(`Missing selectable writing ${selector}`);
      const id = writing.dataset.id;
      press(writing, { x: 400, y: 200 });
      expect(page().selection).toEqual([segment.id, id]);
      expect(pickedLabels(sheet)).toEqual([a.id]);
      press(writing, { x: 400, y: 200 });
      expect(page().selection).toEqual([segment.id]);
      expect(pickedLabels(sheet)).toEqual([a.id]);
    },
  );

  it("plain clicks toggle vertex and segment labels without selecting their parents", () => {
    const { sheet, page } = watched(figure, "arrow", { selection: [length.id] });
    for (const id of [a.id, b.id, segment.id]) press(labelOn(sheet, id), { x: 100, y: 140 });
    expect(pickedLabels(sheet)).toEqual([a.id, b.id, segment.id]);
    expect(page().selection).toEqual([length.id]);
    press(labelOn(sheet, b.id), { x: 300, y: 140 });
    expect(pickedLabels(sheet)).toEqual([a.id, segment.id]);
    press(sheet, { x: 200, y: 100 });
    expect(page().selection).toEqual([length.id, segment.id]);
    expect(pickedLabels(sheet)).toEqual([a.id, segment.id]);
  });

  it.each(["Escape", "blank sheet"])("clears object and label selection with %s", (method) => {
    const { sheet, page } = watched(figure, "arrow", {
      selection: [length.id],
      labelSelection: [a.id, segment.id],
    });
    if (method === "Escape") fireEvent.keyDown(window, { key: "Escape" });
    else press(sheet, { x: 780, y: 580 });
    expect(page().selection).toEqual([]);
    expect(pickedLabels(sheet)).toEqual([]);
  });

  it("a marquee catches labels and geometry together", () => {
    const { sheet, page } = watched(figure, "arrow");
    drag(sheet, { x: 50, y: 40 }, { x: 350, y: 160 });
    expect(page().selection).toEqual(expect.arrayContaining([a.id, b.id, segment.id]));
    expect(pickedLabels(sheet)).toEqual([a.id, b.id, segment.id]);
  });

  it("a marquee can select labels without their parent geometry", () => {
    const { sheet, page } = watched(figure, "arrow");
    drag(sheet, { x: 50, y: 120 }, { x: 350, y: 170 });
    expect(page().selection).toEqual([]);
    expect(pickedLabels(sheet)).toEqual([a.id, b.id]);
  });

  it("a marquee touching only a label's edge still selects the label", () => {
    const { sheet, page } = watched(figure, "arrow");
    const label = labelOn(sheet, a.id);
    Object.defineProperties(label, {
      offsetWidth: { value: 20 },
      offsetHeight: { value: 20 },
    });
    drag(sheet, { x: 80, y: 125 }, { x: 92, y: 135 });
    expect(page().selection).toEqual([]);
    expect(pickedLabels(sheet)).toEqual([a.id]);
  });

  it("a cancelled marquee clears both groups", () => {
    const { sheet, page } = watched(figure, "arrow");
    fireEvent.pointerDown(sheet, { button: 0, pointerId: 1, clientX: 50, clientY: 40 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 350, clientY: 160 });
    expect(pickedLabels(sheet)).toEqual([a.id, b.id, segment.id]);
    fireEvent.pointerCancel(sheet, { pointerId: 1 });
    expect(page().selection).toEqual([]);
    expect(pickedLabels(sheet)).toEqual([]);
  });
});

describe("dragging selected labels", () => {
  it("moves the selected labels together without moving their objects or losing selection", () => {
    const { sheet, page } = watched(figure, "arrow", {
      selection: [length.id],
      labelSelection: [a.id, b.id],
    });
    drag(labelOn(sheet, a.id), { x: 100, y: 140 }, { x: 110, y: 140 });
    for (const id of [a.id, b.id]) {
      expect(page().objects.find((object) => object.id === id)?.label?.off).toEqual({
        x: 10,
        y: 40,
      });
    }
    expect(page().objects.find((object) => object.id === a.id)).toMatchObject({ x: 100, y: 100 });
    expect(page().selection).toEqual([length.id]);
    expect(pickedLabels(sheet)).toEqual([a.id, b.id]);
  });

  it("keeps group offsets together at the label reach limit", () => {
    const { sheet, page } = watched(figure, "arrow", { labelSelection: [a.id, b.id] });
    drag(labelOn(sheet, a.id), { x: 100, y: 140 }, { x: 1000, y: 140 });
    const first = page().objects.find((object) => object.id === a.id)?.label?.off;
    if (!first) throw new Error("Missing dragged label offset");
    const second = page().objects.find((object) => object.id === b.id)?.label?.off;
    expect(second).toEqual(first);
    expect(Math.hypot(first.x, first.y)).toBeCloseTo(LABEL_REACH);
  });

  it("does not deselect a selected label until a click is released", () => {
    const { sheet } = watched(figure, "arrow", { labelSelection: [a.id] });
    const label = labelOn(sheet, a.id);
    fireEvent.pointerDown(label, { button: 0, pointerId: 1, clientX: 100, clientY: 140 });
    expect(pickedLabels(sheet)).toEqual([a.id]);
    fireEvent.pointerUp(label, { pointerId: 1, clientX: 100, clientY: 140 });
    expect(pickedLabels(sheet)).toEqual([]);
  });

  it("Escape cancels a label group drag and clears both selections", () => {
    const { sheet, page } = watched(figure, "arrow", {
      selection: [length.id],
      labelSelection: [a.id, b.id],
    });
    const label = labelOn(sheet, a.id);
    fireEvent.pointerDown(label, { button: 0, pointerId: 1, clientX: 100, clientY: 140 });
    fireEvent.pointerMove(label, { pointerId: 1, clientX: 110, clientY: 140 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(label, { pointerId: 1, clientX: 110, clientY: 140 });
    expect(page().selection).toEqual([]);
    expect(pickedLabels(sheet)).toEqual([]);
    for (const id of [a.id, b.id]) {
      expect(page().objects.find((object) => object.id === id)?.label?.off).toEqual({
        x: 0,
        y: 40,
      });
    }
  });
});

describe("Select All uses the visible Arrow targets", () => {
  it.each([
    ["all", [a.id, b.id, segment.id, length.id, caption.id, table.id], [a.id, b.id, segment.id]],
    ["points", [a.id, b.id], []],
    ["paths", [segment.id], []],
    ["text", [length.id, caption.id, table.id], [a.id, b.id, segment.id]],
  ] as const)("respects the %s filter", (arrowKind, expectedObjects, expectedLabels) => {
    const selectAllRef = { current: () => {} };
    const hidden = {
      ...createPoint({ x: 500, y: 500 }, "medium"),
      hidden: true,
      label: { shown: true, name: "hidden" },
    };
    const { sheet, page } = watched([...figure, hidden], "arrow", { arrowKind, selectAllRef });
    act(() => selectAllRef.current());
    expect(page().selection).toEqual(expectedObjects);
    expect(pickedLabels(sheet)).toEqual(expectedLabels);
  });
});
