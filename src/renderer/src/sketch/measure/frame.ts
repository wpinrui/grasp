/**
 * The frame a tied reading's number hangs in.
 *
 * A number left to itself sits at a spot on the sheet and stays there, so
 * moving the figure leaves it behind while the arrows and arcs that mark the
 * same measurement follow along. A tied one holds its place in a frame built
 * out of what it reads instead: a spot to measure from and a way along. Move
 * the figure and the frame moves with it, turn the figure and the frame turns,
 * and the number rides both.
 *
 * The offset itself stays in sheet units. Where a number sits beside a figure
 * is a drawing convention rather than a part of the figure: a dimension stands
 * a set distance clear of its segment and an angle's number stands clear of its
 * arc, and neither of those gaps is meant to double because the figure did.
 *
 * There is a frame for everything the Measure tool can be pointed at, since a
 * number left behind by its shape is no better than one left behind by its
 * segment: a length off a segment, an area off a shape or a circle or an arc's
 * fill, an angle off a corner. Those are the only readings a chain is offered
 * on, so those are the only frames there are. Each is built out of whatever the
 * settled geometry gives: the ends of a segment, the corner and the bisector of
 * an angle, a circle's centre and the way its reference runs, the corners of a
 * shape, the middle of an arc.
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
  type Position,
  type ReadingSpot,
  type Settled,
  type SketchInterior,
  type SketchMeasurement,
  type SketchObject,
  spotOnPath,
  TINY,
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
}

/** A unit vector that way, or null where there is no way to speak of. */
function unit(x: number, y: number): Position | null {
  const far = Math.hypot(x, y);
  return far < TINY ? null : { x: x / far, y: y / far };
}

/** A frame measured from one spot and running towards another. */
function towards(at: Position, to: Position): Frame | null {
  const along = unit(to.x - at.x, to.y - at.y);
  return along ? { at, along } : null;
}

/** The three points of an angle: an arm either side, and the corner between. */
function cornerPoints(reading: SketchMeasurement, objects: SketchObject[]): string[] | null {
  if (reading.of.length >= 3) return reading.of.slice(0, 3);
  const [one, other] = reading.of.map((id) => find(objects, id));
  return one && other ? cornerOf(one, other) : null;
}

/**
 * An angle's frame: measured from the corner, running out along the bisector.
 * That is the line the arc marking the angle is drawn about, so a number hung
 * in this frame swings with the arc as the arms open and close instead of
 * being left inside it or out on its own.
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
  return { at: { x: corner.x, y: corner.y }, along: { x: half.x * way, y: half.y * way } };
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
function fillFrame(fill: SketchInterior, settled: Settled): Frame | null {
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
 * The frame the thing a reading was taken from gives, whatever kind it is, or
 * null where that thing carries no frame. A point is one of those: the tool
 * takes no reading off a point on its own, and one point would say where the
 * number goes but not which way round it turns as the figure does.
 */
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
  return isInterior(object) ? fillFrame(object, settled) : null;
}

/**
 * The frame a reading's number hangs in, or null where what it reads has not
 * settled anywhere or carries no frame. An angle is measured from its corner,
 * since that is where its arc is drawn from; everything else from the frame the
 * thing it was taken from gives.
 */
export function frameOf(
  reading: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): Frame | null {
  if (reading.of.length === 0) return null;
  if (reading.measure === "angle") return angleFrame(reading, objects, settled);
  const held = find(objects, reading.of[0]);
  return held ? frameOfOne(held, settled) : null;
}

/** Where a number hung in this frame sits on the sheet. */
export function spotIn(frame: Frame, spot: ReadingSpot): Position {
  const across = { x: -frame.along.y, y: frame.along.x };
  return {
    x: frame.at.x + frame.along.x * spot.along + across.x * spot.across,
    y: frame.at.y + frame.along.y * spot.along + across.y * spot.across,
  };
}

/** How a number sitting there hangs in this frame, which is what a drag writes. */
export function spotOf(frame: Frame, at: Position): ReadingSpot {
  const away = { x: at.x - frame.at.x, y: at.y - frame.at.y };
  const across = { x: -frame.along.y, y: frame.along.x };
  return {
    along: away.x * frame.along.x + away.y * frame.along.y,
    across: away.x * across.x + away.y * across.y,
  };
}
