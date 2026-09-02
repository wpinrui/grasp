/**
 * Iterate: replay everything built on the seeds, again and again.
 *
 * You give a map, one destination per seed. Round one is a copy of everything
 * that hangs off the seeds, with each seed swapped for where you sent it. Round
 * two is the same copy again, this time starting from where round one landed,
 * and so on to the depth asked for. Seed a triangle's corners, send each corner
 * to a midpoint, and the rounds nest triangles inside one another.
 *
 * Every copy is an ordinary object holding ordinary parents, so the whole orbit
 * is live: drag a seed and all of it follows.
 */

import {
  type ArcSpan,
  arcAt,
  type CircleSpan,
  circleAt,
  cornersOf,
  createArc,
  createCircle,
  createFill,
  createInterior,
  createLine,
  createPoint,
  type Derivation,
  filledPath,
  imageOf,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  isWriting,
  type LineSpan,
  lineAlong,
  type Settled,
  type SketchObject,
  type SketchPoint,
  settle,
  withDependents,
} from "./model";

/** As deep as one iteration is allowed to go. */
export const MAX_DEPTH = 20;

/** And as many objects as it is allowed to make, however deep it was asked. */
const MAX_OBJECTS = 4000;

export const DEFAULT_DEPTH = 3;

/** Point the derivation at whatever the substitution says stands in now. */
export function rewrite(from: Derivation, at: (id: string) => string): Derivation {
  if (from.kind === "translate") return { ...from, of: at(from.of) };
  if (from.kind === "midpoint" || from.kind === "cross") {
    return { ...from, of: at(from.of), and: at(from.and) };
  }
  if (from.kind === "on") return { ...from, path: at(from.path) };
  if (from.kind === "reflect") return { ...from, of: at(from.of), mirror: at(from.mirror) };
  return { ...from, of: at(from.of), centre: at(from.centre) };
}

/** And for what puts an arc where it is. */
export function rewriteArc(span: ArcSpan, at: (id: string) => string): ArcSpan {
  if (span.kind === "on") {
    return { ...span, circle: at(span.circle), from: at(span.from), to: at(span.to) };
  }
  if (span.kind === "centre") {
    return { ...span, centre: at(span.centre), from: at(span.from), to: at(span.to) };
  }
  return { ...span, from: at(span.from), via: at(span.via), to: at(span.to) };
}

/** And for what puts a circle where it is. */
export function rewriteCircle(span: CircleSpan, at: (id: string) => string): CircleSpan {
  return span.kind === "through"
    ? { ...span, centre: at(span.centre), edge: at(span.edge) }
    : { ...span, centre: at(span.centre), along: at(span.along) };
}

/** The same, for what puts a line where it is. */
export function rewriteSpan(span: LineSpan, at: (id: string) => string): LineSpan {
  if (span.kind === "through") return { ...span, ends: [at(span.ends[0]), at(span.ends[1])] };
  if (span.kind === "bisector") {
    return { ...span, corner: at(span.corner), a: at(span.a), b: at(span.b) };
  }
  return { ...span, at: at(span.at), to: at(span.to) };
}

/**
 * A seed has to be a point that was put down by hand, since an image is already
 * told where to be, and it has to have something built on it, since otherwise
 * there is nothing to repeat.
 */
export function canSeed(objects: SketchObject[], selection: string[]): boolean {
  if (selection.length === 0) return false;
  // A seed is a point you can move: one plotted by hand, or one on a path.
  const seeds = selection.map((id) => objects.find((object) => object.id === id));
  if (
    !seeds.every(
      (object) =>
        object !== undefined && isPoint(object) && (!object.from || object.from.kind === "on"),
    )
  ) {
    return false;
  }
  // And something an iteration can actually copy has to hang off it. A caption
  // that mentions a seed hangs off it too, and so does a measurement that reads
  // it, but writing is not repeated, so on its own it leaves the rounds empty.
  const family = withDependents(objects, selection);
  return objects.some(
    (object) => family.has(object.id) && !selection.includes(object.id) && !isWriting(object),
  );
}

/**
 * The objects an iteration would add, in the order they must be made. Empty
 * when the map is not filled in, or when nothing hangs off the seeds.
 */
export function iterated(
  objects: SketchObject[],
  seeds: string[],
  targets: (string | null)[],
  depth: number,
): SketchObject[] {
  if (seeds.length === 0 || targets.length !== seeds.length) return [];
  if (targets.some((target) => target === null)) return [];
  const family = withDependents(objects, seeds);
  // What gets copied: everything built on the seeds, but not the seeds.
  const chain = objects.filter((object) => family.has(object.id) && !seeds.includes(object.id));
  if (chain.length === 0) return [];

  const made: SketchObject[] = [];
  const known = new Map<string, SketchObject>(objects.map((object) => [object.id, object]));
  const settled = settle(objects).settled;
  // Where each seed sits this round. Round one is the map you gave.
  let seedAt = new Map(seeds.map((seed, index) => [seed, targets[index] as string]));

  for (let round = 0; round < Math.min(depth, MAX_DEPTH); round += 1) {
    const stands = new Map(seedAt);
    const copied = new Map<string, string>();
    for (const object of chain) {
      if (made.length >= MAX_OBJECTS) return made;
      const at = (id: string) => stands.get(id) ?? id;
      let copy: SketchObject | null = null;
      if (isInterior(object)) {
        const round = filledPath(object);
        copy = round ? createFill(at(round)) : createInterior((cornersOf(object) ?? []).map(at));
      } else if (isArc(object)) {
        copy = createArc(rewriteArc(object.span, at));
      } else if (isCircle(object)) {
        copy = createCircle(rewriteCircle(object.span, at));
      } else if (isLine(object)) {
        copy = createLine(object.form, rewriteSpan(object.span, at));
      } else if (isPoint(object) && object.from) {
        const from = rewrite(object.from, at);
        const where = imageOf(from, settled);
        if (where) copy = createPoint(where, object.size, from);
      }
      if (!copy) continue;
      stands.set(object.id, copy.id);
      copied.set(object.id, copy.id);
      known.set(copy.id, copy);
      made.push(copy);
      settleCopy(copy, settled);
    }
    // Next round starts where this one put each seed's destination.
    seedAt = new Map(
      seeds.map((seed, index) => {
        const target = targets[index] as string;
        return [seed, copied.get(target) ?? seedAt.get(target) ?? target];
      }),
    );
  }
  return made;
}

/**
 * A freshly copied object joining what is already settled, so the next copy can
 * hang off it without the whole page being worked out again.
 */
export function settleCopy(copy: SketchObject, settled: Settled): void {
  if (isPoint(copy)) {
    settled.points.set(copy.id, copy);
    return;
  }
  if (isLine(copy)) {
    const along = lineAlong(copy.span, copy.form, settled);
    if (along) settled.lines.set(copy.id, along);
    return;
  }
  if (isArc(copy)) {
    const arc = arcAt(copy.span, settled);
    if (arc) settled.arcs.set(copy.id, arc);
    return;
  }
  if (isCircle(copy)) {
    const round = circleAt(copy.span, settled);
    if (round) settled.circles.set(copy.id, round);
    return;
  }
  if (!isInterior(copy)) return;
  const corners = (cornersOf(copy) ?? []).map((id) => settled.points.get(id));
  if (corners.every((corner) => corner !== undefined)) {
    settled.shapes.set(
      copy.id,
      corners.map((corner) => ({ x: corner.x, y: corner.y })),
    );
  }
}

/** The points among what an iteration would add, for drawing it as a ghost. */
export function iteratedPoints(made: SketchObject[]): SketchPoint[] {
  return made.filter(isPoint);
}
