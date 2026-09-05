/**
 * The frame a tied reading's number hangs in.
 *
 * A number left to itself sits at a spot on the sheet and stays there, so
 * moving the figure leaves it behind while the arrows and arcs that mark the
 * same measurement follow along. A tied one holds its place in a frame built
 * out of what it reads instead: a spot to measure from, a way along, and how
 * much one whole way along is worth. Turn the figure and the frame turns with
 * it, stretch the figure and the frame stretches, and the number rides both.
 *
 * There is such a frame for every kind of reading, since a number left behind
 * by its shape is no better than one left behind by its segment. What each is
 * built from is whatever the settled geometry gives: the ends of a segment, the
 * corner and the bisector of an angle, a circle's centre and the way its
 * reference runs, the corners of a shape.
 */

import {
  type ArcGeometry,
  type CircleGeometry,
  cornersOf,
  filledPath,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isMeasurement,
  isPoint,
  type Position,
  pathIn,
  type ReadingSpot,
  type Settled,
  type SketchMeasurement,
  type SketchObject,
  spotOnPath,
  TINY,
  tangentOnPath,
} from "../model";
import { cornerOf, find } from "./shape";

/**
 * Where a tied number is measured from, and the way the two offsets run. The
 * way across is the way along turned a quarter turn, so it is not held here.
 */
export interface Frame {
  /** The spot the number's offset is measured from. */
  at: Position;
  /** Which way along runs, as a unit vector. */
  along: Position;
  /** What one whole `along` is worth in sheet units, and never nought. */
  span: number;
}

/** A unit vector that way, or null where there is no way to speak of. */
function unit(x: number, y: number): Position | null {
  const far = Math.hypot(x, y);
  return far < TINY ? null : { x: x / far, y: y / far };
}

/** A frame measured from one spot and running towards another. */
function towards(at: Position, to: Position): Frame | null {
  const along = unit(to.x - at.x, to.y - at.y);
  return along ? { at, along, span: Math.hypot(to.x - at.x, to.y - at.y) } : null;
}

/** The three points of an angle: an arm either side, and the corner between. */
function cornerPoints(reading: SketchMeasurement, objects: SketchObject[]): string[] | null {
  if (reading.of.length >= 3) return reading.of.slice(0, 3);
  const [one, other] = reading.of.map((id) => find(objects, id));
  return one && other ? cornerOf(one, other) : null;
}

/**
 * An angle's frame: measured from the corner, running out along the bisector,
 * with one whole way along the mean of the two arms. That is where the arc
 * marking the angle sits, so a number hung in this frame opens and closes with
 * the arc instead of being left inside or outside it.
 */
function angleFrame(
  reading: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): Frame | null {
  const three = cornerPoints(reading, objects);
  if (!three) return null;
  const [one, corner, other] = three.map((id) => settled.points.get(id));
  if (!one || !corner || !other) return null;
  const first = unit(one.x - corner.x, one.y - corner.y);
  const second = unit(other.x - corner.x, other.y - corner.y);
  if (!first || !second) return null;
  // Which way the bisector runs out is which angle is being read: the reflex
  // angle is the rest of the turn, so its arc is on the other side of the
  // corner and its number belongs there too.
  const half = unit(first.x + second.x, first.y + second.y) ?? { x: -first.y, y: first.x };
  const way = reading.reflex ? -1 : 1;
  const arms =
    (Math.hypot(one.x - corner.x, one.y - corner.y) +
      Math.hypot(other.x - corner.x, other.y - corner.y)) /
    2;
  return {
    at: { x: corner.x, y: corner.y },
    along: { x: half.x * way, y: half.y * way },
    span: arms,
  };
}

/** A circle's frame: its centre, running the way its reference runs. */
function roundFrame(round: CircleGeometry): Frame | null {
  return towards(round.at, spotOnPath(round, 0));
}

/** An arc's frame: its centre, running out through the middle of the arc. */
function arcFrame(arc: ArcGeometry): Frame | null {
  return towards(arc.at, spotOnPath(arc, 0.5));
}

/** A ring of corners as a frame: their middle, running out to the first of them. */
function ringFrame(corners: Position[]): Frame | null {
  if (corners.length === 0) return null;
  const middle = {
    x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
    y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
  };
  return towards(middle, corners[0]);
}

/** A fill's frame: off its corners where it has them, off the path it fills where not. */
function fillFrame(fill: SketchObject, settled: Settled): Frame | null {
  if (!isInterior(fill)) return null;
  if (cornersOf(fill)) {
    const corners = settled.shapes.get(fill.id);
    return corners ? ringFrame(corners) : null;
  }
  const path = filledPath(fill);
  if (!path) return null;
  const arc = settled.arcs.get(path);
  if (arc) return arcFrame(arc);
  const round = settled.circles.get(path);
  return round ? roundFrame(round) : null;
}

/**
 * A point's frame: the point itself, running the way the path under it runs.
 * One point says where but not which way round, so a point riding a path takes
 * its way along from the path, and a point riding nothing has none and keeps
 * its number square to the sheet.
 */
function pointFrame(point: SketchObject, settled: Settled): Frame | null {
  if (!isPoint(point)) return null;
  const at = settled.points.get(point.id) ?? point;
  const on = point.from?.kind === "on" ? point.from : null;
  const path = on ? pathIn(settled, on.path) : undefined;
  const along = path ? tangentOnPath(path, on?.at ?? 0) : null;
  return { at: { x: at.x, y: at.y }, along: along ?? { x: 1, y: 0 }, span: 1 };
}

/** The frame the first thing a reading was taken from gives, whatever kind it is. */
function frameOfOne(object: SketchObject, settled: Settled): Frame | null {
  if (isLine(object)) {
    const along = settled.lines.get(object.id);
    return along ? ringFrame([along.a, along.b]) : null;
  }
  if (isCircle(object)) {
    const round = settled.circles.get(object.id);
    return round ? roundFrame(round) : null;
  }
  if (isArc(object)) {
    const arc = settled.arcs.get(object.id);
    return arc ? arcFrame(arc) : null;
  }
  if (isInterior(object)) return fillFrame(object, settled);
  return pointFrame(object, settled);
}

/**
 * The frame a reading's number hangs in, or null where what it reads has not
 * settled anywhere. An angle is measured from its corner; a pair of points from
 * the middle of the pair, which is where a distance is written; everything else
 * from the frame the first thing it was taken from gives.
 */
export function frameOf(
  reading: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): Frame | null {
  if (!isMeasurement(reading) || reading.of.length === 0) return null;
  if (reading.measure === "angle") return angleFrame(reading, objects, settled);
  const held = reading.of.map((id) => find(objects, id)).filter((one) => one !== undefined);
  if (held.length === 0) return null;
  if (held.length >= 2 && held.every(isPoint)) {
    const spots = held.map((point) => settled.points.get(point.id));
    if (spots[0] && spots[1]) return ringFrame([spots[0], spots[1]]);
  }
  return frameOfOne(held[0], settled);
}

/** Where a number hung in this frame sits on the sheet. */
export function spotIn(frame: Frame, spot: ReadingSpot): Position {
  const across = { x: -frame.along.y, y: frame.along.x };
  const out = spot.along * frame.span;
  return {
    x: frame.at.x + frame.along.x * out + across.x * spot.across,
    y: frame.at.y + frame.along.y * out + across.y * spot.across,
  };
}

/** How a number sitting there hangs in this frame, which is what a drag writes. */
export function spotOf(frame: Frame, at: Position): ReadingSpot {
  const away = { x: at.x - frame.at.x, y: at.y - frame.at.y };
  const across = { x: -frame.along.y, y: frame.along.x };
  return {
    along: (away.x * frame.along.x + away.y * frame.along.y) / frame.span,
    across: away.x * across.x + away.y * across.y,
  };
}
