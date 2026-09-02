import type { Quantity } from "../expression";
import { cornersOf, radiusOf, type SketchLocus } from "./figures";
import {
  type ArcGeometry,
  type CircleGeometry,
  distance,
  insideShape,
  type LineGeometry,
  type LocusShape,
  MAX_SAMPLES,
  type Position,
  pathIn,
  type Rect,
  type Settled,
} from "./geometry";
import {
  familyOf,
  isArc,
  isButton,
  isCaption,
  isCircle,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isPoint,
  isTransform,
  isValue,
  isWriting,
  pointsOf,
} from "./guards";
import {
  arcAt,
  circleAt,
  distanceToLine,
  distanceToPath,
  imageOf,
  lineAlong,
  spotOnPath,
} from "./paths";
import type { SketchObject } from "./values";

/**
 * Work out where one object belongs from what has already been placed, and
 * write that into `settled`. Everything it needs is there, because parents
 * always come before their children.
 */
function place(object: SketchObject, settled: Settled): void {
  // Neither a locus nor writing is placed here: a locus is worked out after
  // everything else, and writing sits where it was put.
  if (isLocus(object) || isWriting(object) || isMark(object)) return;
  if (isCircle(object)) {
    const round = circleAt(object.span, settled);
    if (round) settled.circles.set(object.id, round);
    return;
  }
  if (isArc(object)) {
    const arc = arcAt(object.span, settled);
    if (arc) settled.arcs.set(object.id, arc);
    return;
  }
  if (isInterior(object)) {
    // A circle's inside is wherever its circle is, so there is nothing of its
    // own to work out.
    const wanted = cornersOf(object);
    if (!wanted) return;
    const corners = wanted.map((id) => settled.points.get(id));
    if (corners.every((corner) => corner !== undefined)) {
      settled.shapes.set(
        object.id,
        corners.map((corner) => ({ x: corner.x, y: corner.y })),
      );
    }
    return;
  }
  if (isLine(object)) {
    const along = lineAlong(object.span, object.form, settled);
    if (along) settled.lines.set(object.id, along);
    return;
  }
  // A custom transform is a relationship, not a thing on the sheet, so it has
  // nowhere to be put.
  if (isTransform(object)) return;
  if (isButton(object)) return;
  const at = object.from ? imageOf(object.from, settled) : null;
  settled.points.set(object.id, at ? { ...object, x: at.x, y: at.y } : object);
}

/**
 * A locus, sample by sample: park the driver at each spot along its stretch of
 * the domain, follow everything built on it, and keep where the driven object
 * ended up. The page itself is left exactly as it was.
 */
function locusOf(locus: SketchLocus, objects: SketchObject[], settled: Settled): LocusShape | null {
  const domain = pathIn(settled, locus.domain);
  const driver = settled.points.get(locus.driver);
  const before = objects.slice(
    0,
    objects.findIndex((object) => object.id === locus.id),
  );
  const driven = before.find((object) => object.id === locus.driven);
  if (!domain || !driver || !driven) return null;
  // What has to be worked out again for each sample: everything hanging off
  // the driver, in the order it was built, the driver itself excepted.
  const family = withDependents(before, [locus.driver]);
  const chain = before.filter(
    (object) => family.has(object.id) && object.id !== locus.driver && !isLocus(object),
  );
  const read = isPoint(driven)
    ? (from: Settled) => from.points.get(driven.id)
    : isLine(driven)
      ? (from: Settled) => from.lines.get(driven.id)
      : isCircle(driven)
        ? (from: Settled) => from.circles.get(driven.id)
        : isArc(driven)
          ? (from: Settled) => from.arcs.get(driven.id)
          : (from: Settled) => from.shapes.get(driven.id);
  const count = Math.max(2, Math.min(MAX_SAMPLES, Math.round(locus.samples)));
  const at: (Position | LineGeometry | CircleGeometry | ArcGeometry | Position[])[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = locus.span[0] + ((locus.span[1] - locus.span[0]) * index) / (count - 1);
    const scratch: Settled = {
      points: new Map(settled.points),
      values: settled.values,
      lines: new Map(settled.lines),
      circles: new Map(settled.circles),
      arcs: new Map(settled.arcs),
      shapes: new Map(settled.shapes),
      loci: settled.loci,
    };
    scratch.points.set(driver.id, { ...driver, ...spotOnPath(domain, t) });
    for (const object of chain) place(object, scratch);
    const found = read(scratch);
    // A settled point carries more than a place, so only its place is kept.
    if (found) at.push("x" in found ? { x: found.x, y: found.y } : found);
  }
  if (at.length === 0) return null;
  if (isPoint(driven)) return { kind: "points", at: at as Position[] };
  if (isLine(driven)) return { kind: "lines", at: at as LineGeometry[] };
  if (isCircle(driven)) return { kind: "circles", at: at as CircleGeometry[] };
  if (isArc(driven)) return { kind: "arcs", at: at as ArcGeometry[] };
  return { kind: "shapes", at: at as Position[][] };
}

/**
 * How a number on the sheet is read, in centimetres and degrees. Working one out
 * lives in `measure.ts`, which is built on this file and so cannot be reached
 * from it, so that module hands the reader over as it loads. The same seam
 * `writeIn` uses to set the units readings are written in.
 */
type ValueReader = (
  object: SketchObject,
  objects: SketchObject[],
  settled: Settled,
) => Quantity | null;

let readValue: ValueReader | null = null;

export function readValuesWith(reader: ValueReader): void {
  readValue = reader;
}

export function settle(objects: SketchObject[]): { objects: SketchObject[]; settled: Settled } {
  const settled: Settled = {
    values: new Map(),
    points: new Map(),
    lines: new Map(),
    circles: new Map(),
    arcs: new Map(),
    shapes: new Map(),
    loci: new Map(),
  };
  let moved = false;
  const next = objects.map((object) => {
    if (isLocus(object)) {
      const shape = locusOf(object, objects, settled);
      if (shape) settled.loci.set(object.id, shape);
      return object;
    }
    // A number settles here too, so a transform later in the list can follow
    // one. Parents always come earlier than what hangs off them, so by the time
    // a transform is reached whatever it follows has already been worked out.
    if (isValue(object)) {
      settled.values.set(object.id, readValue?.(object, objects, settled) ?? null);
      return object;
    }
    place(object, settled);
    if (!isPoint(object)) return object;
    const image = settled.points.get(object.id);
    if (!image || (image.x === object.x && image.y === object.y)) return object;
    moved = true;
    return image;
  });
  return { objects: moved ? next : objects, settled };
}

export function resolve(objects: SketchObject[]): SketchObject[] {
  return settle(objects).objects;
}

/** The given objects, and everything that hangs off them however far down. */
export function withDependents(objects: SketchObject[], ids: string[]): Set<string> {
  const going = new Set(ids);
  for (const object of objects) {
    const parents = familyOf(object);
    if (!parents) continue;
    if (parents.some((parent) => going.has(parent))) going.add(object.id);
  }
  return going;
}

/** Whether a spot lands on a locus: on the curve, on a sample, or inside one. */
export function nearLocus(shape: LocusShape, at: Position, slack: number): boolean {
  if (shape.kind === "arcs") {
    return shape.at.some((arc) => distanceToPath(arc, at) <= slack);
  }
  if (shape.kind === "circles") {
    return shape.at.some((round) => distanceToPath(round, at) <= slack);
  }
  if (shape.kind === "lines") return shape.at.some((line) => distanceToLine(line, at) <= slack);
  if (shape.kind === "shapes") return shape.at.some((corners) => insideShape(corners, at));
  return shape.at.some((spot, index) => {
    if (index === 0) return distance(spot, at) <= slack;
    const step: LineGeometry = { a: shape.at[index - 1], b: spot, form: "segment" };
    return distanceToLine(step, at) <= slack;
  });
}

/** The sheet the drawing takes up, dots included, or null when it is empty. */
export function contentBounds(
  objects: SketchObject[],
  scale: number,
  settled = settle(objects).settled,
): Rect | null {
  const captions = objects.filter(isWriting);
  if (pointsOf(objects).length === 0 && captions.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  // Only a point has a place of its own, and a line is drawn between points.
  for (const object of pointsOf(objects)) {
    const reach = radiusOf(object) / scale;
    left = Math.min(left, object.x - reach);
    top = Math.min(top, object.y - reach);
    right = Math.max(right, object.x + reach);
    bottom = Math.max(bottom, object.y + reach);
  }
  // A caption hangs by its top left corner and holds the width it was given,
  // in screen pixels, so how much sheet it covers depends on the zoom.
  for (const caption of captions) {
    const width = isCaption(caption) ? caption.width : 0;
    left = Math.min(left, caption.x);
    top = Math.min(top, caption.y);
    right = Math.max(right, caption.x + width / scale);
    bottom = Math.max(bottom, caption.y);
  }
  // A circle reaches past the points that hold it, so it brings its own edges.
  for (const round of settled.circles.values()) {
    left = Math.min(left, round.at.x - round.radius);
    top = Math.min(top, round.at.y - round.radius);
    right = Math.max(right, round.at.x + round.radius);
    bottom = Math.max(bottom, round.at.y + round.radius);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
