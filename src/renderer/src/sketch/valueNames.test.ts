// @vitest-environment node
import { expect, it } from "vitest";
import { parse, write } from "./expression";
import { createMeasurement, createPoint, lineThrough, settle } from "./model";
import { valueNames } from "./valueNames";

it.each([
  ["l", "n"],
  ["1", "2"],
])("keeps colliding references parseable for vertex labels %s and %s", (first, second) => {
  const a = { ...createPoint({ x: 0, y: 0 }, "medium"), label: { name: first } };
  const b = { ...createPoint({ x: 100, y: 0 }, "medium"), label: { name: second } };
  const readings = [0, 1].map(() => createMeasurement("distance", [a.id, b.id], { x: 0, y: 0 }));
  const objects = [a, b, ...readings];
  const names = valueNames(objects, settle(objects).settled);
  for (const reading of readings) {
    const expression = { kind: "value" as const, of: reading.id };
    expect(
      parse(write(expression, names), {
        value: (name) => [...names].find(([, held]) => held === name)?.[0] ?? null,
        fn: () => null,
      }),
    ).toEqual(expression);
  }
  expect(names.get(readings[0].id)).not.toBe(names.get(readings[1].id));
});

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
