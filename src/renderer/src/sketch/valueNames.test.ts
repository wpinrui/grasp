// @vitest-environment node
import { expect, it } from "vitest";
import { parse, write } from "./expression";
import { createMeasurement, createPoint, lineThrough, settle } from "./model";
import { valueNames } from "./valueNames";

it("gives equal-looking measurements distinct typeable references and preserves object IDs", () => {
  const a = createPoint({ x: 0, y: 0 }, "medium");
  const b = createPoint({ x: 100, y: 0 }, "medium");
  const segment = lineThrough("segment", [a.id, b.id]);
  const length = createMeasurement("length", [segment.id], { x: 0, y: 0 });
  const distance = createMeasurement("distance", [a.id, b.id], { x: 0, y: 0 });
  const objects = [a, b, segment, length, distance];
  const names = valueNames(objects, settle(objects).settled);
  expect(names.get(length.id)).toBe("AB");
  expect(names.get(distance.id)).toBe("AB_2");
  const expression = {
    kind: "binary" as const,
    op: "+" as const,
    left: { kind: "value" as const, of: length.id },
    right: { kind: "value" as const, of: distance.id },
  };
  expect(
    parse(write(expression, names), {
      value: (name) => [...names].find(([, held]) => held === name)?.[0] ?? null,
      fn: () => null,
    }),
  ).toEqual(expression);
  const renamed = objects.map((object) =>
    object.id === a.id ? { ...object, label: { name: "P" } } : object,
  );
  expect(write(expression, valueNames(renamed, settle(renamed).settled))).toBe("PA + PA_2");
});
