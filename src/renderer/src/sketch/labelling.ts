import type {
  PathGeometry,
  Position,
  Settled,
  SketchLine,
  SketchObject,
  SketchPoint,
} from "./model";
import {
  distance,
  distanceToPath,
  filledPath,
  insideShape,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  isWriting,
  spotOnPath,
  wedgeOf,
} from "./model";
/**
 * Where a label sits beside what it names.
 *
 * A label hangs off an anchor on the object, and leans out of it into the
 * widest gap between everything running through that spot, shunning any gap
 * that leads into a fill. A plain figure therefore labels itself the same way
 * throughout, and a label never lands on the ink it belongs to.
 */

/** The page as the labelling reads it: where everything settled, and at what zoom. */
export interface Labelling {
  objects: SketchObject[];
  settled: Settled;
  /** Screen pixels per sheet pixel, which is what "near enough" is measured in. */
  scale: number;
  /** The two ends of every straight object, by id. */
  ends: Map<string, SketchPoint>;
  /** Where a straight object is drawn, cut to what is on screen. */
  spanOf: (line: SketchLine) => [Position, Position] | null;
}

/** How far from what it names a label sits until it is dragged, in screen pixels. */
const LABEL_OFF = 16;

/** Which way a label leans when nothing is in the way: up and to the right. */
const LABEL_LEAN = -Math.PI / 4;

/** How many ways round a label looks for a gap to sit in. */
const LABEL_TRIES = 24;

/** How much a way into a fill loses by, more than any gap can make up. */
const LABEL_SHUN = 10;

/** How far from what it names a label can be dragged, in screen pixels. */
export const LABEL_REACH = 48;

/**
 * Where an object's label hangs: on a point, halfway along a straight object,
 * on the rim of a circle, the middle of an arc, the middle of a fill.
 */
export function labelAnchor(page: Labelling, object: SketchObject): Position | null {
  // A caption says what it says, and a measurement writes its own name in
  // front of its value. Neither hangs a label anywhere.
  if (isWriting(object)) return null;
  if (isPoint(object)) return page.ends.get(object.id) ?? null;
  if (isLine(object)) {
    const span = page.spanOf(object);
    return span ? { x: (span[0].x + span[1].x) / 2, y: (span[0].y + span[1].y) / 2 } : null;
  }
  if (isCircle(object)) {
    const round = page.settled.circles.get(object.id);
    if (!round) return null;
    // Up and to the right of the rim, clear of the centre and the points.
    return {
      x: round.at.x + round.radius * Math.cos(-Math.PI / 4),
      y: round.at.y + round.radius * Math.sin(-Math.PI / 4),
    };
  }
  if (isArc(object)) {
    const arc = page.settled.arcs.get(object.id);
    return arc ? spotOnPath(arc, 0.5) : null;
  }
  if (isInterior(object)) {
    const inside = filledPath(object);
    if (inside) {
      const arc = page.settled.arcs.get(inside);
      if (arc) {
        const middle = spotOnPath(arc, 0.5);
        return wedgeOf(object) === "sector"
          ? { x: (arc.at.x + middle.x) / 2, y: (arc.at.y + middle.y) / 2 }
          : middle;
      }
      const round = page.settled.circles.get(inside);
      return round ? { x: round.at.x, y: round.at.y } : null;
    }
    const corners = page.settled.shapes.get(object.id);
    if (!corners || corners.length === 0) return null;
    return {
      x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
      y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
    };
  }
  const shape = page.settled.loci.get(object.id);
  if (shape?.kind !== "points" || shape.at.length === 0) return null;
  return shape.at[Math.floor(shape.at.length / 2)];
}

/**
 * The ways objects leave a spot, so a label can be put somewhere none of them
 * is. One way for a path that stops here, two for one that carries on through.
 */
function throughSpot(page: Labelling, at: Position): number[] {
  const ways: number[] = [];
  const close = 0.5 / page.scale;
  const add = (dx: number, dy: number) => ways.push(Math.atan2(dy, dx));
  const both = (dx: number, dy: number) => {
    add(dx, dy);
    add(-dx, -dy);
  };
  const atEnd = (path: PathGeometry, end: 0 | 1) => distance(spotOnPath(path, end), at) <= close;
  for (const along of page.settled.lines.values()) {
    if (distanceToPath(along, at) > close) continue;
    const dx = along.b.x - along.a.x;
    const dy = along.b.y - along.a.y;
    // A line runs on past both its points, a ray past the second only, and a
    // segment past neither, so at an end each of those leaves one way only.
    if (along.form !== "line" && atEnd(along, 0)) add(dx, dy);
    else if (along.form === "segment" && atEnd(along, 1)) add(-dx, -dy);
    else both(dx, dy);
  }
  for (const round of page.settled.circles.values()) {
    // A circle runs across the spot along its tangent there.
    if (distanceToPath(round, at) <= close) both(-(at.y - round.at.y), at.x - round.at.x);
  }
  for (const arc of page.settled.arcs.values()) {
    if (distanceToPath(arc, at) > close) continue;
    if (arc.flat) {
      const dx = arc.flat[1].x - arc.flat[0].x;
      const dy = arc.flat[1].y - arc.flat[0].y;
      if (atEnd(arc, 0)) add(dx, dy);
      else if (atEnd(arc, 1)) add(-dx, -dy);
      else both(dx, dy);
      continue;
    }
    // The tangent, taken the way the arc sweeps, so an end leaves inwards.
    const onward = arc.sweep >= 0 ? 1 : -1;
    const dx = -(at.y - arc.at.y) * onward;
    const dy = (at.x - arc.at.x) * onward;
    if (atEnd(arc, 0)) add(dx, dy);
    else if (atEnd(arc, 1)) add(-dx, -dy);
    else both(dx, dy);
  }
  return ways;
}

/** How far apart two angles are, never more than half a turn. */
function apart(one: number, other: number): number {
  const gap = Math.abs(((one - other) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return gap > Math.PI ? Math.PI * 2 - gap : gap;
}

/** Where a label lands on the sheet when it goes out a given way. */
function labelSpot(page: Labelling, at: Position, angle: number): Position {
  return {
    x: at.x + (Math.cos(angle) * LABEL_OFF) / page.scale,
    y: at.y + (Math.sin(angle) * LABEL_OFF) / page.scale,
  };
}

/**
 * Whether a spot falls in a fill, which is no place for a label. A fill's own
 * label is the exception: that one hangs in the middle of what it names.
 */
function inFill(page: Labelling, object: SketchObject, at: Position): boolean {
  return page.objects.some((other) => {
    if (other.id === object.id || !isInterior(other) || filledPath(other)) return false;
    const corners = page.settled.shapes.get(other.id);
    return corners ? insideShape(corners, at) : false;
  });
}

/** The first of these ways out that keeps the label clear of every fill. */
function clearOf(page: Labelling, object: SketchObject, at: Position, ways: number[]): number {
  return ways.find((way) => !inFill(page, object, labelSpot(page, at, way))) ?? ways[0];
}

/** Every way out, starting from the one wanted, to look for a clear one. */
function around(from: number): number[] {
  return Array.from(
    { length: LABEL_TRIES },
    (_, step) => from + (step / LABEL_TRIES) * Math.PI * 2,
  );
}

/**
 * Where a label sits when it has not been dragged: out of the way of
 * everything running through the spot it hangs from, clear of any fill, and
 * leaning up and to the right when it is free to.
 */
export function labelOff(page: Labelling, object: SketchObject, at: Position): Position {
  const out = (angle: number) => ({
    x: Math.cos(angle) * LABEL_OFF,
    y: Math.sin(angle) * LABEL_OFF,
  });
  if (isLine(object)) {
    // Beside the line rather than across it, on the upper side unless that
    // side is the one filled, in which case the other one.
    const span = page.spanOf(object);
    if (!span) return out(clearOf(page, object, at, around(LABEL_LEAN)));
    const angle = Math.atan2(span[1].y - span[0].y, span[1].x - span[0].x) - Math.PI / 2;
    const upper = Math.sin(angle) > 0 ? angle + Math.PI : angle;
    return out(clearOf(page, object, at, [upper, upper + Math.PI]));
  }
  if (isCircle(object) || isArc(object)) {
    // Outside the rim, straight out from the middle.
    const round = page.settled.circles.get(object.id) ?? page.settled.arcs.get(object.id);
    if (!round || (isArc(object) && page.settled.arcs.get(object.id)?.flat)) {
      return out(clearOf(page, object, at, around(LABEL_LEAN)));
    }
    const away = Math.atan2(at.y - round.at.y, at.x - round.at.x);
    return out(clearOf(page, object, at, around(away)));
  }
  if (!isPoint(object)) return out(clearOf(page, object, at, around(LABEL_LEAN)));
  const ways = throughSpot(page, at);
  if (ways.length === 0) return out(clearOf(page, object, at, around(LABEL_LEAN)));
  // The widest gap between what runs through here, less any gap that leads
  // into a fill, with the lean breaking any tie so a plain figure still
  // labels itself the same way throughout.
  let best = LABEL_LEAN;
  let score = -Infinity;
  for (let step = 0; step < LABEL_TRIES; step += 1) {
    const angle = LABEL_LEAN + (step / LABEL_TRIES) * Math.PI * 2;
    const room = Math.min(...ways.map((way) => apart(angle, way)));
    const filled = inFill(page, object, labelSpot(page, at, angle)) ? LABEL_SHUN : 0;
    const worth = room + 0.001 * Math.cos(angle - LABEL_LEAN) - filled;
    if (worth > score) {
      score = worth;
      best = angle;
    }
  }
  return out(best);
}
