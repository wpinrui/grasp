import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import type { MenuAction } from "../components/menus";
import type { Building } from "../sketch/builds";
import {
  createCustomTransform,
  createPoint,
  DEFAULT_VIEW,
  isPoint,
  type SketchObject,
  settle,
} from "../sketch/model";
import { useSketch } from "../sketch/useSketch";
import { customPreview } from "./customs";
import { useTransforms } from "./useTransforms";

it("previews known transform inputs and waits for a missing centre", () => {
  const a = createPoint({ x: 100, y: 100 }, "medium");
  const b = createPoint({ x: 300, y: 100 }, "medium");
  const objects = [a, b];
  const geometry = settle(objects).settled;
  const building: Building = {
    objects,
    selected: [b],
    chosenPoints: [b],
    chosenLines: [],
    chosenPaths: [],
    geometry,
    pointSize: "medium",
    view: DEFAULT_VIEW,
    viewport: { width: 800, height: 600 },
  };
  const ui = renderHook(
    ({ hovered }: { hovered: MenuAction | null }) => {
      const sketch = useSketch();
      return useTransforms({
        sketch,
        building,
        objects,
        selection: [b.id],
        geometry,
        names: new Map(),
        pointSize: "medium",
        hovered,
        calculating: false,
        setInsert: () => {},
      });
    },
    { initialProps: { hovered: "rotate" as MenuAction | null } },
  );
  expect(ui.result.current.preview).toEqual([]);
  act(() => ui.result.current.setCentre(a.id));
  const positions = (made: SketchObject[]) => made.filter(isPoint).map(({ x, y }) => ({ x, y }));
  const preview = positions(ui.result.current.preview);
  expect(preview).toHaveLength(1);
  act(() => ui.result.current.openDialog("rotate"));
  expect(positions(ui.result.current.preview)).toEqual(preview);
});

it("keeps custom transform dependencies hidden while resolving the visible image", () => {
  const seed = createPoint({ x: 100, y: 100 }, "medium");
  const pivot = createPoint({ x: 300, y: 100 }, "medium");
  const image = {
    ...createPoint({ x: 200, y: 100 }, "medium"),
    from: { kind: "midpoint" as const, of: seed.id, and: pivot.id },
  };
  const target = createPoint({ x: 500, y: 100 }, "medium");
  const transform = createCustomTransform("Halfway", seed.id, image.id);
  const objects = [seed, pivot, image, target, transform];
  const original = structuredClone(objects);
  const preview = customPreview(transform.id, objects, [target.id]);
  const visible = preview.filter(isPoint).filter((point) => !point.hidden);
  expect(visible).toHaveLength(1);
  expect(visible[0]).toMatchObject({ x: 400, y: 100 });
  expect(objects).toEqual(original);
  expect(customPreview("missing", objects, [target.id])).toEqual([]);
});
