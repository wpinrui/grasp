import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createMeasurement, createPoint, lineThrough } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";
import { put, stubTheSheet } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

it("clears measurement hover when deleted and does not restore it on undo", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 300, y: 100 }, "medium");
  const segment = lineThrough("segment", [a.id, b.id]);
  const length = createMeasurement("length", [segment.id], { x: 200, y: 150 });
  let sketch!: Sketch;
  const { container } = put([a, b, segment, length], "arrow", {
    reportSketch: (value) => {
      sketch = value;
    },
  });
  const reading = container.querySelector(".reading");
  if (!reading) throw new Error("Missing measurement");
  fireEvent.mouseEnter(reading);
  expect(container.querySelector(".canvas__snap-band")).not.toBeNull();
  act(() => sketch.commit({ objects: [a, b, segment], selection: [] }));
  expect(container.querySelector(".canvas__snap-band")).toBeNull();
  act(() => sketch.undo());
  expect(container.querySelector(".reading")).not.toBeNull();
  expect(container.querySelector(".canvas__snap-band")).toBeNull();
});
