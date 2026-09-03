// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { MenuAction } from "../components/menus";
import { type Building, canBuild } from "./builds";
import { MEASURE_OF } from "./measured";
import {
  createCircle,
  createLine,
  createPoint,
  DEFAULT_VIEW,
  isCircle,
  isLine,
  isPoint,
  type Position,
  type SketchObject,
  settle,
} from "./model";

function building(objects: SketchObject[], selection: string[]): Building {
  const selected = selection
    .map((id) => objects.find((object) => object.id === id))
    .filter((object): object is SketchObject => object !== undefined);
  return {
    objects,
    selected,
    chosenLines: selected.filter(isLine),
    chosenPaths: selected.filter(
      (object): object is ReturnType<typeof createLine> | ReturnType<typeof createCircle> =>
        isLine(object) || isCircle(object),
    ),
    chosenPoints: selected.filter(isPoint),
    geometry: settle(objects).settled,
    pointSize: "medium",
    view: DEFAULT_VIEW,
    viewport: { width: 800, height: 600 },
  };
}

const point = (at: Position) => createPoint(at, "medium");

/**
 * The actions `canBuild` owns. Anything outside this list must come back null,
 * because `isEnabled` answers those itself and a stray `false` would grey a
 * working entry out for good.
 */
const OWNED = [
  "parallel",
  "perpendicular",
  "bisector",
  "intersection",
  "midpoint",
  "point-on-object",
  "interior",
  "circle-interior",
  "arc-sector",
  "arc-segment",
  "arc-on-circle",
  "arc-through",
  "locus",
  "circle-centre-point",
  "circle-centre-radius",
  "segment",
  "ray",
  "line",
] as const;

/**
 * Everything else. Some of these `isEnabled` answers before it ever asks,
 * but the ones that matter are those that fall through to its final `return
 * true`: a stray `false` from here would grey one of those out for good.
 */
const NOT_OWNED = [
  "translate",
  "rotate",
  "dilate",
  "reflect",
  "paste",
  "cut",
  "copy",
  "iterate",
  "hide-objects",
  "show-all-hidden",
  "print",
  "select-parents",
  "tabulate",
  "derivative",
  "split-merge",
  "mark-angle",
  "edit-definition",
  // The fall-through group, enabled unless something says otherwise.
  "undo",
  "redo",
  "select-all",
  "clear",
  "save",
  "calculate",
  "new-parameter",
] as const;

describe("which entries canBuild answers", () => {
  const empty = building([], []);

  it("answers every entry that draws or writes something", () => {
    for (const action of OWNED) {
      expect({ action, answer: canBuild(empty, action) }).toEqual({
        action,
        answer: expect.any(Boolean),
      });
    }
  });

  it("answers every Measure entry", () => {
    const measures = Object.keys(MEASURE_OF);
    expect(measures.length).toBeGreaterThan(0);
    for (const action of measures) {
      expect({ action, answer: canBuild(empty, action as MenuAction) }).toEqual({
        action,
        answer: expect.any(Boolean),
      });
    }
  });

  it("leaves everything else to the caller", () => {
    for (const action of NOT_OWNED) {
      expect({ action, answer: canBuild(empty, action as MenuAction) }).toEqual({
        action,
        answer: null,
      });
    }
  });

  it("says no to what it owns when nothing is selected", () => {
    for (const action of OWNED) {
      expect({ action, answer: canBuild(empty, action) }).toEqual({ action, answer: false });
    }
  });
});

describe("what the selection lets through", () => {
  it("takes two points for a segment, a ray or a line", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const page = building([a, b], [a.id, b.id]);
    for (const action of ["segment", "ray", "line"] as const) {
      expect({ action, answer: canBuild(page, action) }).toEqual({ action, answer: true });
    }
    // A third point is not a straight object between two of them.
    const c = point({ x: 50, y: 80 });
    const three = building([a, b, c], [a.id, b.id, c.id]);
    expect(canBuild(three, "segment")).toBe(false);
  });

  it("takes three points for an interior and refuses two", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const c = point({ x: 50, y: 80 });
    expect(canBuild(building([a, b, c], [a.id, b.id, c.id]), "interior")).toBe(true);
    expect(canBuild(building([a, b, c], [a.id, b.id]), "interior")).toBe(false);
  });

  it("takes two selected points, or one segment, for a midpoint", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const between = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    expect(canBuild(building([a, b], [a.id, b.id]), "midpoint")).toBe(true);
    expect(canBuild(building([a, b, between], [between.id]), "midpoint")).toBe(true);
    expect(canBuild(building([a, b], [a.id]), "midpoint")).toBe(false);
  });

  it("takes one straight object and a point for a parallel", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const away = point({ x: 20, y: 60 });
    const along = createLine("line", { kind: "through", ends: [a.id, b.id] });
    const page = building([a, b, away, along], [along.id, away.id]);
    expect(canBuild(page, "parallel")).toBe(true);
    expect(canBuild(page, "perpendicular")).toBe(true);
    // The straight object on its own has nothing to run through.
    expect(canBuild(building([a, b, along], [along.id]), "parallel")).toBe(false);
  });

  it("takes a path for a point on it", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const along = createLine("line", { kind: "through", ends: [a.id, b.id] });
    expect(canBuild(building([a, b, along], [along.id]), "point-on-object")).toBe(true);
    // A point in the selection alongside it is not a path.
    expect(canBuild(building([a, b, along], [along.id, a.id]), "point-on-object")).toBe(false);
  });

  it("takes two crossing paths for an intersection and refuses two that miss", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const c = point({ x: 50, y: -50 });
    const d = point({ x: 50, y: 50 });
    const across = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    const down = createLine("segment", { kind: "through", ends: [c.id, d.id] });
    const objects = [a, b, c, d, across, down];
    expect(canBuild(building(objects, [across.id, down.id]), "intersection")).toBe(true);

    const far = point({ x: 0, y: 400 });
    const alsoFar = point({ x: 100, y: 400 });
    const parallel = createLine("segment", { kind: "through", ends: [far.id, alsoFar.id] });
    const missing = [a, b, far, alsoFar, across, parallel];
    expect(canBuild(building(missing, [across.id, parallel.id]), "intersection")).toBe(false);
  });

  it("takes a circle for its inside", () => {
    const centre = point({ x: 0, y: 0 });
    const rim = point({ x: 50, y: 0 });
    const round = createCircle({ kind: "through", centre: centre.id, edge: rim.id });
    const objects = [centre, rim, round];
    expect(canBuild(building(objects, [round.id]), "circle-interior")).toBe(true);
    expect(canBuild(building(objects, [centre.id]), "circle-interior")).toBe(false);
  });

  it("takes two segments meeting at a point for a bisector", () => {
    const corner = point({ x: 0, y: 0 });
    const along = point({ x: 100, y: 0 });
    const up = point({ x: 0, y: 100 });
    const one = createLine("segment", { kind: "through", ends: [corner.id, along.id] });
    const other = createLine("segment", { kind: "through", ends: [corner.id, up.id] });
    const objects = [corner, along, up, one, other];
    expect(canBuild(building(objects, [one.id, other.id]), "bisector")).toBe(true);

    // Two segments that share no end make no corner to halve.
    const far = point({ x: 400, y: 400 });
    const alsoFar = point({ x: 500, y: 400 });
    const apart = createLine("segment", { kind: "through", ends: [far.id, alsoFar.id] });
    const loose = [corner, along, far, alsoFar, one, apart];
    expect(canBuild(building(loose, [one.id, apart.id]), "bisector")).toBe(false);
  });

  it("takes a point on a path and something built on it for a locus", () => {
    const a = point({ x: 0, y: 0 });
    const b = point({ x: 100, y: 0 });
    const along = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    const driver = createPoint({ x: 50, y: 0 }, "medium", { kind: "on", path: along.id, at: 0.5 });
    const away = point({ x: 50, y: 80 });
    const driven = createPoint({ x: 0, y: 0 }, "medium", {
      kind: "midpoint",
      of: driver.id,
      and: away.id,
    });
    const objects = [a, b, along, driver, away, driven];
    expect(canBuild(building(objects, [driver.id, driven.id]), "locus")).toBe(true);

    // The driven object has to be built on the driver.
    expect(canBuild(building(objects, [driver.id, away.id]), "locus")).toBe(false);
  });

  it("takes a centre and a point on the rim for a circle", () => {
    const centre = point({ x: 0, y: 0 });
    const rim = point({ x: 50, y: 0 });
    expect(canBuild(building([centre, rim], [centre.id, rim.id]), "circle-centre-point")).toBe(
      true,
    );
    expect(canBuild(building([centre, rim], [centre.id]), "circle-centre-point")).toBe(false);
  });
});
