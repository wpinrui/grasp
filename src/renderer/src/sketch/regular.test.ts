// @vitest-environment node
import { describe, expect, it } from "vitest";
import { distance, isInterior, isLine, isPoint, resolve, type SketchObject } from "./model";
import { canBuildSides, regularPolygon } from "./regular";

const AT = { x: 400, y: 300 };

function built(sides: number, locked: boolean): SketchObject[] {
  return resolve(regularPolygon({ at: AT, sides, size: "medium", locked }));
}

const cornersOf = (made: SketchObject[]) => made.filter(isPoint);

/** How long each side is, going round the ring the edges were made in. */
function sides(made: SketchObject[]): number[] {
  const points = cornersOf(made);
  const ring = (isInterior(made.find(isInterior) as SketchObject) &&
    (made.find(isInterior) as { vertices?: string[] }).vertices) as string[];
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
  it("comes out with every side the same length", () => {
    for (const count of [3, 4, 5, 6, 7, 8, 12]) {
      const lengths = sides(built(count, false));
      expect(lengths).toHaveLength(count);
      for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 6);
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
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 6);
  });

  it("comes with its fill and one edge per side", () => {
    const made = built(7, false);
    expect(made.filter(isInterior)).toHaveLength(1);
    expect(made.filter(isLine)).toHaveLength(7);
  });

  it("builds nothing where the number of sides is not one a polygon has", () => {
    expect(canBuildSides(2)).toBe(false);
    expect(canBuildSides(3.5)).toBe(false);
    expect(canBuildSides(1000)).toBe(false);
    expect(canBuildSides(3)).toBe(true);
    expect(regularPolygon({ at: AT, sides: 2, size: "medium", locked: false })).toEqual([]);
  });
});
