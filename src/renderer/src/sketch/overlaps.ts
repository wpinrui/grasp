/**
 * Telling apart two straight objects drawn over one another.
 *
 * A segment drawn along a line it lies on disappears into it: the same ink in
 * the same place, and no way to see there are two. So drawing one demotes what
 * it was drawn over a step down the run of styles, and the new one comes out
 * solid on top of it.
 *
 * The run is solid, dashed, dotted and no further. Two straight objects on one
 * stretch can be told apart and three cannot, so the run bottoms out rather
 * than wrapping round to solid and colliding again.
 *
 * It happens once, where the object is drawn. The style is then the line's own,
 * to change from the palette like any other, and deleting what demoted it
 * leaves it where it was put.
 */

import {
  isLine,
  type LineGeometry,
  type LinePattern,
  type Position,
  type SketchObject,
  settle,
} from "./model";

/** How far off a line a spot can lie and still count as on it, in sheet pixels. */
const SLACK = 0.01;

const NEXT: Record<LinePattern, LinePattern> = {
  solid: "dashed",
  dashed: "dotted",
  dotted: "dotted",
};

/** How far along the axis a spot lies. */
function along(spot: Position, origin: Position, way: Position): number {
  return (spot.x - origin.x) * way.x + (spot.y - origin.y) * way.y;
}

/** How far off the axis it lies, which is what says whether it is on it at all. */
function off(spot: Position, origin: Position, way: Position): number {
  return Math.abs((spot.x - origin.x) * -way.y + (spot.y - origin.y) * way.x);
}

/**
 * The stretch of the axis a straight object covers, or null where it does not
 * lie along that axis. A segment covers what is between its ends, a ray covers
 * everything one way from its first end, and a line covers the whole of it.
 */
function stretch(line: LineGeometry, origin: Position, way: Position): [number, number] | null {
  // Both ends on the axis means the whole of it is: parallel but apart, and
  // crossing it at an angle, are both caught here.
  if (off(line.a, origin, way) > SLACK || off(line.b, origin, way) > SLACK) return null;
  const from = along(line.a, origin, way);
  const to = along(line.b, origin, way);
  if (line.form === "segment") return [Math.min(from, to), Math.max(from, to)];
  if (line.form === "line") return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  return to >= from ? [from, Number.POSITIVE_INFINITY] : [Number.NEGATIVE_INFINITY, from];
}

/**
 * Whether two straight objects cover a stretch of one line between them. Two
 * that only meet at a point are not drawn over one another, so a shared stretch
 * has to have some length to it.
 */
function overlap(made: LineGeometry, held: LineGeometry): boolean {
  const dx = made.b.x - made.a.x;
  const dy = made.b.y - made.a.y;
  const span = Math.hypot(dx, dy);
  if (span === 0) return false;
  const way = { x: dx / span, y: dy / span };
  const mine = stretch(made, made.a, way);
  const theirs = stretch(held, made.a, way);
  if (!mine || !theirs) return false;
  return Math.min(mine[1], theirs[1]) - Math.max(mine[0], theirs[0]) > SLACK;
}

/**
 * The page with whatever the new straight objects were drawn over demoted a
 * step. The new objects themselves are not in what comes back: they are added
 * on top of it, solid, by whoever is landing them.
 */
export function demotedUnder(objects: SketchObject[], made: SketchObject[]): SketchObject[] {
  const drawn = made.filter(isLine);
  if (drawn.length === 0) return objects;
  const settled = settle([...objects, ...made]).settled;
  const under = new Set<string>();
  for (const one of drawn) {
    const mine = settled.lines.get(one.id);
    if (!mine) continue;
    for (const other of objects) {
      // Something out of sight has nothing to be told apart from.
      if (!isLine(other) || other.hidden === true) continue;
      const theirs = settled.lines.get(other.id);
      if (theirs && overlap(mine, theirs)) under.add(other.id);
    }
  }
  if (under.size === 0) return objects;
  return objects.map((object) =>
    under.has(object.id) ? { ...object, pattern: NEXT[object.pattern ?? "solid"] } : object,
  );
}
