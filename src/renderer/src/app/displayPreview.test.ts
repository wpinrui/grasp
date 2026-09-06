import { expect, it } from "vitest";
import { createPoint, isPoint } from "../sketch/model";
import { displayPreview } from "./displayPreview";

it("previews display settings without changing the source or unrelated objects", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = { ...createPoint({ x: 400, y: 100 }, "medium"), hidden: true };
  const objects = [a, b];
  const original = structuredClone(objects);
  const resized = displayPreview(objects, [a.id], "point-size:large");
  if (!resized) throw new Error("Missing size preview");
  expect(isPoint(resized[0]) && resized[0].size).toBe("large");
  expect(resized[1]).toBe(b);
  expect(displayPreview(objects, [a.id], "hide-objects")?.[0].hidden).toBe(true);
  expect(displayPreview(objects, [], "show-all-hidden")?.[1].hidden).toBe(false);
  const labelled = displayPreview(objects, [a.id], "show-labels");
  if (!labelled) throw new Error("Missing label preview");
  expect(labelled[0].label?.shown).toBe(true);
  expect(labelled[1]).toBe(b);
  expect(displayPreview(labelled, [a.id], "show-labels")?.[0].label?.shown).toBe(false);
  expect(displayPreview(objects, [], "save")).toBeNull();
  expect(objects).toEqual(original);
});
