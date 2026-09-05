import { filledPath, radiusOf, type SketchPoint, wedgeOf } from "./figures";
import type { Settled } from "./geometry";
import {
  type ArcGeometry,
  type CircleGeometry,
  clipToRect,
  distance,
  edgesOf,
  insideShape,
  type LineGeometry,
  type Position,
  pathIn,
  type Rect,
  slackAt,
} from "./geometry";
import {
  isArc,
  isCircle,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isPoint,
  isTransform,
  isWriting,
  pointsOf,
} from "./guards";
import { markShape, nearMark } from "./marks";
import { distanceToPath, insideWedge, spotOnPath, wholePath } from "./paths";
import { nearLocus, settle } from "./settle";
import type { SketchObject } from "./values";
/** The page a pick reads: what is on it, at what zoom, and where it all settled. */
export interface Picking {
  objects: SketchObject[];
  scale: number;
  settled?: Settled;
}

/**
 * Topmost object under the pointer, or null. Points win over lines wherever the
 * two overlap, since a line always has points sitting on it; among their own
 * kind, later objects sit on top.
 */
export function objectAt(at: Position, page: Picking): SketchObject | null {
  const { objects, scale } = page;
  const settled = page.settled ?? settle(objects).settled;
  const slack = slackAt(scale);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isPoint(object) && distance(object, at) <= radiusOf(object) / scale + slack) {
      return object;
    }
  }
  // A mark is drawn over what it marks, so it is picked before it: clicking a
  // tick catches the tick rather than the side it sits on.
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isMark(object) && nearMark(object, at, { scale, settled, objects })) return object;
  }
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isLocus(object)) {
      const shape = settled.loci.get(object.id);
      if (shape && nearLocus(shape, at, slack)) return object;
      continue;
    }
    if (!isLine(object) && !isCircle(object) && !isArc(object)) continue;
    const along = pathIn(settled, object.id);
    if (along && distanceToPath(along, at) <= slack) return object;
  }
  // A fill picks anywhere inside it, and so comes last: a point or a line
  // lying on top of one is what you meant to click.
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (!isInterior(object)) continue;
    const inside = filledPath(object);
    if (inside) {
      const wedge = wedgeOf(object);
      const arc = wedge ? settled.arcs.get(inside) : undefined;
      if (arc) {
        if (insideWedge(arc, wedge as "sector" | "segment", at)) return object;
        continue;
      }
      const where = settled.circles.get(inside);
      if (where && distance(where.at, at) <= where.radius) return object;
      continue;
    }
    const corners = settled.shapes.get(object.id);
    if (corners && insideShape(corners, at)) return object;
  }
  return null;
}

export function endsById(objects: SketchObject[]): Map<string, SketchPoint> {
  return new Map(pointsOf(objects).map((point) => [point.id, point]));
}

export function rectBetween(a: Position, b: Position): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Whether a circle's rim runs through a rectangle: the nearest corner of the
 * rectangle is inside the rim and the furthest is outside, or the other way
 * about.
 */
function ringTouches(round: CircleGeometry, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const near = {
    x: Math.min(Math.max(round.at.x, left), right),
    y: Math.min(Math.max(round.at.y, top), bottom),
  };
  const far = {
    x: round.at.x - left > right - round.at.x ? left : right,
    y: round.at.y - top > bottom - round.at.y ? top : bottom,
  };
  return distance(round.at, near) <= round.radius && distance(round.at, far) >= round.radius;
}

/** Whether an arc runs through a rectangle, walked a step at a time. */
function arcTouches(arc: ArcGeometry, rect: Rect): boolean {
  if (arc.flat) return clipToRect(wholePath(arc) as LineGeometry, rect) !== null;
  const steps = 32;
  for (let step = 0; step < steps; step += 1) {
    const one = spotOnPath(arc, step / steps);
    const next = spotOnPath(arc, (step + 1) / steps);
    if (clipToRect({ a: one, b: next, form: "segment" }, rect)) return true;
  }
  return false;
}

/**
 * Marquee catch. Touching is enough: an object does not have to sit inside the
 * rectangle, so a point counts as soon as its dot overlaps.
 */
export function objectsTouching(rect: Rect, page: Picking): SketchObject[] {
  const { objects, scale } = page;
  const settled = page.settled ?? settle(objects).settled;
  return objects.filter((object) => {
    if (isLocus(object)) {
      const shape = settled.loci.get(object.id);
      if (!shape) return false;
      if (shape.kind === "arcs") return shape.at.some((arc) => arcTouches(arc, rect));
      if (shape.kind === "circles") {
        return shape.at.some((round) => ringTouches(round, rect));
      }
      if (shape.kind === "lines") {
        return shape.at.some((line) => clipToRect(line, rect) !== null);
      }
      if (shape.kind === "shapes") {
        return shape.at.some((corners) =>
          edgesOf(corners).some((edge) => clipToRect(edge, rect) !== null),
        );
      }
      return shape.at.some(
        (spot) =>
          spot.x >= rect.x &&
          spot.x <= rect.x + rect.width &&
          spot.y >= rect.y &&
          spot.y <= rect.y + rect.height,
      );
    }
    if (isInterior(object)) {
      const inside = filledPath(object);
      if (inside) {
        const wedge = wedgeOf(object);
        const arc = wedge ? settled.arcs.get(inside) : undefined;
        if (arc) {
          // The rim being caught is the usual way in, and a rectangle wholly
          // inside the wedge counts too.
          return (
            arcTouches(arc, rect) ||
            insideWedge(arc, wedge as "sector" | "segment", { x: rect.x, y: rect.y })
          );
        }
        const where = settled.circles.get(inside);
        if (!where) return false;
        // Any overlap counts, so the nearest corner of the rectangle being
        // inside the circle is enough.
        const near = {
          x: Math.min(Math.max(where.at.x, rect.x), rect.x + rect.width),
          y: Math.min(Math.max(where.at.y, rect.y), rect.y + rect.height),
        };
        return distance(where.at, near) <= where.radius;
      }
      const corners = settled.shapes.get(object.id);
      if (!corners) return false;
      // Touching is enough, so an edge crossing the marquee counts, and so
      // does a marquee drawn wholly inside the shape.
      return (
        edgesOf(corners).some((edge) => clipToRect(edge, rect) !== null) ||
        insideShape(corners, { x: rect.x, y: rect.y })
      );
    }
    if (isCircle(object)) {
      const round = settled.circles.get(object.id);
      return round ? ringTouches(round, rect) : false;
    }
    if (isArc(object)) {
      const arc = settled.arcs.get(object.id);
      return arc ? arcTouches(arc, rect) : false;
    }
    // Nothing on the sheet to catch: it is a relationship between two points.
    if (isTransform(object)) return false;
    if (isLine(object)) {
      const along = settled.lines.get(object.id);
      return along ? clipToRect(along, rect) !== null : false;
    }
    // Writing is drawn over the sheet rather than in it, so what it covers is
    // measured where it is drawn and a marquee is told about it from there.
    if (isWriting(object)) return false;
    // A mark is caught where it is drawn: the spot a tick rides, or the corner
    // an angle mark turns about.
    if (isMark(object)) {
      const shape = markShape(object, { settled, objects, scale });
      if (!shape) return false;
      return (
        shape.at.x >= rect.x &&
        shape.at.x <= rect.x + rect.width &&
        shape.at.y >= rect.y &&
        shape.at.y <= rect.y + rect.height
      );
    }
    const reach = radiusOf(object) / scale;
    return (
      object.x >= rect.x - reach &&
      object.x <= rect.x + rect.width + reach &&
      object.y >= rect.y - reach &&
      object.y <= rect.y + rect.height + reach
    );
  });
}
