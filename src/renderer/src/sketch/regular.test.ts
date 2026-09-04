// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createPoint,
  distance,
  isInterior,
  isLine,
  isPoint,
  resolve,
  type SketchObject,
} from "./model";
import { canBuildSides, MOST_SIDES, regularPolygon, withRegular } from "./regular";

const AT = { x: 400, y: 300 };

function built(sides: number, locked: boolean): SketchObject[] {
  return resolve(regularPolygon({ at: AT, sides, size: "medium", locked }));
}

const cornersOf = (made: SketchObject[]) => made.filter(isPoint);

/** The corners the fill was built from, in the order they go round. */
function ringOf(made: SketchObject[]): string[] {
  const fill = made.find(isInterior);
  if (!fill || !("vertices" in fill) || fill.vertices === undefined) {
    throw new Error("The polygon was built with no ring of corners.");
  }
  return fill.vertices;
}

/** How long each side is, going round the ring the edges were made in. */
function sides(made: SketchObject[]): number[] {
  const points = cornersOf(made);
  const ring = ringOf(made);
  return ring.map((id, at) => {
    const one = points.find((point) => point.id === id);
    const next = points.find((point) => point.id === ring[(at + 1) % ring.length]);
    return one && next ? distance(one, next) : Number.NaN;
  });
}

/**
 * A regular polygon is built rather than clicked out, so what makes it regular
 * is checked here: every side the same length, a level bottom edge, and, when
 * it is held, corners that are turned about the middle rather than placed.
 */
describe("a regular polygon", () => {
  it("comes out with every side the same length, about one middle", () => {
    for (const count of [3, 4, 5, 6, 7, 8, 12]) {
      const made = built(count, false);
      const lengths = sides(made);
      expect(lengths).toHaveLength(count);
      for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 6);
      // Equal sides alone would let a rhombus through, so the corners are also
      // all the same distance from where the click was, which is regularity.
      const reaches = cornersOf(made).map((corner) => distance(corner, AT));
      for (const reach of reaches) expect(reach).toBeCloseTo(reaches[0], 6);
    }
  });

  it("sits flat, so a square is square and not a diamond", () => {
    const corners = cornersOf(built(4, false));
    const lowest = corners.filter((corner) => corner.y > AT.y);
    // The two corners along the bottom are level with each other.
    expect(lowest).toHaveLength(2);
    expect(lowest[0].y).toBeCloseTo(lowest[1].y, 6);
  });

  it("points a triangle up", () => {
    const corners = cornersOf(built(3, false));
    const top = corners.reduce((one, other) => (other.y < one.y ? other : one));
    expect(top.x).toBeCloseTo(AT.x, 6);
  });

  it("leaves every corner free when it is loose, and adds no middle", () => {
    const made = built(6, false);
    const corners = cornersOf(made);
    expect(corners).toHaveLength(6);
    expect(corners.every((corner) => corner.from === undefined)).toBe(true);
  });

  it("turns the corners about the middle when it is held", () => {
    const made = built(6, true);
    const corners = cornersOf(made);
    // Six corners and the middle they are turned about.
    expect(corners).toHaveLength(7);
    const turned = corners.filter((corner) => corner.from?.kind === "rotate");
    expect(turned).toHaveLength(5);
    expect(turned.map((corner) => (corner.from as { degrees: number }).degrees)).toEqual([
      60, 120, 180, 240, 300,
    ]);
  });

  it("stays regular when the corner it hangs off is moved", () => {
    const made = built(5, true);
    // The one corner nothing was turned off, which is not the middle: which of
    // the corners it is depends on how many there are.
    const first = cornersOf(made).find(
      (corner) => corner.from === undefined && distance(corner, AT) > 1,
    );
    expect(first).toBeTruthy();
    // Drag that one corner out and round; the rest follow and the shape holds.
    const moved = resolve(
      made.map((object) =>
        object.id === first?.id ? { ...object, x: AT.x + 60, y: AT.y - 30 } : object,
      ),
    );
    const lengths = sides(moved);
    expect(lengths).toHaveLength(5);
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 6);
  });

  it("comes with its fill and an edge between each pair of corners, closing round", () => {
    const made = built(7, false);
    expect(made.filter(isInterior)).toHaveLength(1);
    const ring = ringOf(made);
    const drawn = made.filter(isLine).map((edge) => {
      const ends = edge.span.kind === "through" ? edge.span.ends : [];
      return [...ends].sort().join("-");
    });
    // Every consecutive pair, the last one back to the first: a ring, not a
    // line of six edges with a gap where the seventh should close it.
    const wanted = ring.map((corner, at) =>
      [corner, ring[(at + 1) % ring.length]].sort().join("-"),
    );
    expect(drawn.sort()).toEqual(wanted.sort());
  });

  it("goes round the corners in order rather than across them", () => {
    // Equal sides would let a star through, whose points are all as far apart
    // as each other, so the ring is checked to advance one step of angle at a
    // time about the middle rather than jumping across the shape.
    const made = built(7, false);
    const points = cornersOf(made);
    const ring = ringOf(made);
    const angles = ring.map((id) => {
      const corner = points.find((point) => point.id === id);
      return corner ? Math.atan2(corner.y - AT.y, corner.x - AT.x) : Number.NaN;
    });
    const step = (2 * Math.PI) / 7;
    for (let at = 0; at < angles.length; at += 1) {
      const gone = angles[at] - angles[(at + 1) % angles.length];
      // One step either way, whichever way round the ring was built.
      const turned = Math.abs(((gone % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
      expect(Math.min(turned, 2 * Math.PI - turned)).toBeCloseTo(step, 6);
    }
  });

  it("builds nothing where the number of sides is not one a polygon has", () => {
    expect(canBuildSides(2)).toBe(false);
    expect(canBuildSides(3.5)).toBe(false);
    expect(canBuildSides(1000)).toBe(false);
    expect(canBuildSides(3)).toBe(true);
    expect(canBuildSides(MOST_SIDES)).toBe(true);
    expect(canBuildSides(MOST_SIDES + 1)).toBe(false);
    expect(regularPolygon({ at: AT, sides: 2, size: "medium", locked: false })).toEqual([]);
  });
});

/**
 * What lands on the page, which is the whole of the answer the box gives: the
 * shape added to what was there, and it alone left picked.
 */
describe("a regular polygon landing on the page", () => {
  const already = createPoint({ x: 10, y: 10 }, "medium");
  const before = { objects: [already], selection: [already.id] };

  it("adds the shape and leaves nothing but it picked", () => {
    const after = withRegular(before, { at: AT, sides: 5, size: "medium", locked: false });
    // What was there is still there, ahead of what was built.
    expect(after.objects.slice(0, 1)).toEqual(before.objects);
    expect(after.objects).toHaveLength(1 + 5 + 1 + 5);
    // What was picked before is not picked now: the shape is, and only it.
    expect(after.selection).not.toContain(already.id);
    expect(after.selection).toEqual(after.objects.slice(1).map((object) => object.id));
  });

  it("leaves the page alone where the number of sides is not one a polygon has", () => {
    expect(withRegular(before, { at: AT, sides: 2, size: "medium", locked: false })).toBe(before);
  });
});
