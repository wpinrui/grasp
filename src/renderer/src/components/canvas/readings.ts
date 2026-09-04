/**
 * What the Measure tool would write, where it hangs, and how a length is drawn
 * out as a dimension.
 *
 * A reading lands beside what it reads rather than at the pointer, so the
 * figure is not covered by the number taken off it. Working out where "beside"
 * is takes the figure, the zoom and about how big the number will come out, so
 * all of that is handed in rather than read off the window.
 */

import { armsAt, endsOf } from "../../sketch/measure";
import {
  createAngleMark,
  createMeasurement,
  distance,
  filledPath,
  isCircle,
  isInterior,
  isLine,
  isMark,
  isMeasurement,
  isPoint,
  isRightAngle,
  type LineGeometry,
  type MeasureKind,
  markReach,
  markStrokes,
  markSweep,
  objectAt,
  type Position,
  radiusOf,
  type Settled,
  type SketchMark,
  type SketchMeasurement,
  type SketchObject,
  type SketchPoint,
  slackAt,
} from "../../sketch/model";
import {
  ANGLE_READING_OFF,
  ARROW_HEAD,
  ARROW_WING,
  BREAK_GAP,
  LEADER_PAST,
  READING_CHAR,
  READING_HEIGHT,
  READING_OFF,
  READING_POINTS,
  type Written,
} from "./sheet";

/** How big a reading came out once it was drawn, by the reading's id. */
export type Boxes = Map<string, { width: number; height: number }>;

/** What the last angle mark was set to, which is what the next one takes. */
export interface LastMark {
  angle: number;
  radius: number;
}

/** The figure a reading is taken off, and what settles how it comes out. */
export interface Measuring {
  objects: SketchObject[];
  points: SketchPoint[];
  settled: Settled;
  scale: number;
  /** What the Measure tool is armed with, or null while it is not up. */
  measure: string | null;
  /** The words a reading comes out as, which is how wide it is going to be. */
  saying: (made: SketchMeasurement) => string;
  /** How big each reading actually came out, once it has been drawn once. */
  boxes: Boxes;
  lastMark: LastMark;
  /** How far out a new angle mark sits, clear of what is at the corner already. */
  clearOf: (corner: string) => number;
}

/** About how big a reading comes out on screen, before it has been drawn. */
export function readingBox(
  made: SketchMeasurement,
  measuring: Measuring,
): { width: number; height: number } {
  return {
    width: measuring.saying(made).length * READING_CHAR,
    height: READING_HEIGHT,
  };
}

/** A reading moved from where it hangs now to where it should hang. */
function shift(was: Position, to: Position, made: SketchMeasurement): Position {
  return { x: made.x + (to.x - was.x), y: made.y + (to.y - was.y) };
}

/**
 * A reading as the Measure tool writes it: the number alone, at 16px, hung by
 * the middle of what it says rather than by its top left corner, so it sits
 * where it was asked for instead of hanging down and to the right of there.
 */
function newReading(
  measure: MeasureKind,
  of: string[],
  at: Position,
  measuring: Measuring,
): SketchMeasurement {
  const made = { ...createMeasurement(measure, of, at), size: READING_POINTS, bare: true };
  const box = readingBox(made, measuring);
  const { scale } = measuring;
  return { ...made, x: at.x - box.width / 2 / scale, y: at.y - box.height / 2 / scale };
}

/** The two straight objects at a corner, as the three points of its angle. */
function cornerArms(corner: string, measuring: Measuring): [string, string, string] | null {
  const arms = armsAt(corner, measuring.objects, measuring.settled);
  return arms.length === 2 ? [arms[0].end, corner, arms[1].end] : null;
}

/** The point under the pointer, which is what an angle is marked at. */
export function pointUnder(at: Position, measuring: Measuring): SketchPoint | null {
  const { points, scale } = measuring;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (distance(point, at) <= radiusOf(point) / scale + slackAt(scale)) return point;
  }
  return null;
}

/** The same three points, read about the same corner, whichever arm comes first. */
export function sameAngle(of: string[], at3: string[]): boolean {
  if (of.length !== 3 || at3.length !== 3 || of[1] !== at3[1]) return false;
  return (of[0] === at3[0] && of[2] === at3[2]) || (of[0] === at3[2] && of[2] === at3[0]);
}

/**
 * Whether two readings are of the same thing. An angle is three points and the
 * middle one is the corner, so the same three points name three different
 * angles: ∠BEC and ∠ECB are B, E and C either way round, and only where they
 * turn about the same point are they the one angle. Comparing them as a bag of
 * ids says every one of them is already on the sheet.
 */
function sameMeasured(one: SketchMeasurement, other: SketchMeasurement): boolean {
  if (one.measure !== other.measure || one.of.length !== other.of.length) return false;
  if (one.measure !== "angle" || one.of.length !== 3) {
    return one.of.every((id) => other.of.includes(id));
  }
  if (one.of[1] !== other.of[1]) return false;
  return (
    (one.of[0] === other.of[0] && one.of[2] === other.of[2]) ||
    (one.of[0] === other.of[2] && one.of[2] === other.of[0])
  );
}

/**
 * The reading already on the sheet that says what this one would say. The same
 * thing is read once: a click on something that already carries the number the
 * tool would write goes to that one rather than laying another of it on top,
 * and the preview says so before the click.
 */
export function readingAlready(written: Written, measuring: Measuring): SketchMeasurement | null {
  const wanted = written.reading;
  const found = measuring.objects.find(
    (object) =>
      isMeasurement(object) &&
      sameMeasured(object, wanted) &&
      (object.reflex === true) === (wanted.reflex === true),
  );
  return found && isMeasurement(found) ? found : null;
}

/** The mark on an angle, made where that way round is not marked already. */
export function angleMarkOn(
  angle: { corner: string; arms: [string, string]; reflex: boolean },
  hit: SketchObject | null,
  measuring: Measuring,
): SketchMark {
  const { corner, arms, reflex } = angle;
  const { objects, settled, lastMark, clearOf } = measuring;
  if (hit && isMark(hit) && !("path" in hit) && (hit.reflex === true) === reflex) return hit;
  const already = objects.find(
    (object) =>
      isMark(object) &&
      !("path" in object) &&
      object.corner === corner &&
      object.arms.every((arm) => arms.includes(arm)) &&
      (object.reflex === true) === reflex,
  );
  if (already && isMark(already)) return already;
  const sides = armsAt(corner, objects, settled)
    .filter((arm) => arms.includes(arm.end))
    .map((arm) => arm.side);
  return createAngleMark({
    corner,
    arms,
    sides: [sides[0], sides[1]] as [string, string],
    strokes: lastMark.angle,
    reflex,
    radius: clearOf(corner),
  });
}

/**
 * Where the number on an angle hangs: along the bisector of the angle it is
 * about, far enough out to clear the marking on it. The reflex angle is on the
 * other side of the corner, so turning one round moves its number over.
 */
export function angleReadingSpot(
  reading: SketchMeasurement,
  mark: SketchMark,
  reflex: boolean,
  measuring: Measuring,
): Position | null {
  const { settled, scale } = measuring;
  const [one, corner, other] = reading.of;
  const spot = settled.points.get(corner);
  const a = settled.points.get(one);
  const b = settled.points.get(other);
  if (!spot || !a || !b) return null;
  const from = Math.atan2(a.y - spot.y, a.x - spot.x);
  const to = Math.atan2(b.y - spot.y, b.x - spot.x);
  const middle = from + markSweep(from, to, false) / 2;
  const bisector = reflex ? middle + Math.PI : middle;
  const box = readingBox({ ...reading, reflex }, measuring);
  const way = { x: Math.cos(bisector), y: Math.sin(bisector) };
  const clear =
    markReach(mark) +
    ANGLE_READING_OFF +
    (Math.abs(way.x) * box.width + Math.abs(way.y) * box.height) / 2;
  return { x: spot.x + (way.x * clear) / scale, y: spot.y + (way.y * clear) / scale };
}

/**
 * The number for one angle, said by its corner and the two arms it runs
 * between, and the mark it has to be given first. `hit` is whatever was under
 * the pointer, where a click is what asked; nothing, where a drag or the dialog
 * named the arms itself.
 */
export function angleWritten(
  angle: { corner: string; arms: [string, string] },
  hit: SketchObject | null,
  measuring: Measuring,
  named = false,
): Written | null {
  const { corner, arms } = angle;
  const { objects, settled } = measuring;
  const at3 = [arms[0], corner, arms[1]];
  const spot = settled.points.get(corner);
  const ends = arms.map((id) => settled.points.get(id));
  if (!spot || ends.some((end) => end === undefined)) return null;
  // An angle has two sizes, and both can be on the sheet. The first click reads
  // the angle itself; asking again reads the reflex angle, which goes on the
  // other side of the corner so the two never sit on each other.
  const taken = (reflex: boolean) =>
    objects.some(
      (object) =>
        isMeasurement(object) &&
        object.measure === "angle" &&
        sameAngle(object.of, at3) &&
        (object.reflex === true) === reflex,
    );
  // Clicking the same corner again is how the reflex angle is asked for, so a
  // click that lands where a number already is means the other way round.
  // Naming an angle is not that: a row picked out of the dialog, or a drag from
  // one side to the other, said which angle it wanted, and the answer to that is
  // the angle it named or the number already on it.
  const reflex = !named && taken(false) && !taken(true);
  // An angle has to be marked before it can be read: the arcs say which of the
  // angles at that corner the number is about. One already there is used as it
  // is, and the number goes outside it.
  const mark = angleMarkOn({ corner, arms, reflex }, hit, measuring);
  const made = { ...newReading("angle", at3, spot, measuring), reflex };
  const hangs = angleReadingSpot(made, mark, reflex, measuring);
  return {
    reading: hangs ? { ...made, ...hangs } : made,
    mark: objects.some((object) => object.id === mark.id) ? null : mark,
  };
}

/** Every point joined to these ones by straight objects, however far along. */
function joinedTo(ends: string[], measuring: Measuring): Position[] {
  const { objects, settled } = measuring;
  const seen = new Set<string>(ends);
  const queue = [...ends];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const arm of armsAt(id, objects, settled)) {
      if (seen.has(arm.end)) continue;
      seen.add(arm.end);
      queue.push(arm.end);
    }
  }
  return [...seen]
    .map((id) => settled.points.get(id))
    .filter((spot): spot is SketchPoint => spot !== undefined);
}

/**
 * Which way is out of the figure at a segment: away from the middle of
 * everything its ends are joined to, so a number taken off a polygon's edge
 * lands outside the polygon rather than across it. With nothing joined to it
 * there is no inside to be out of, so it goes up the page.
 */
function outwardOf(along: LineGeometry, ends: [string, string], measuring: Measuring): Position {
  const way = { x: along.b.x - along.a.x, y: along.b.y - along.a.y };
  const length = Math.hypot(way.x, way.y) || 1;
  const across = { x: -way.y / length, y: way.x / length };
  const up = across.y > 0 ? { x: -across.x, y: -across.y } : across;
  const ring = joinedTo(ends, measuring);
  if (ring.length < 3) return up;
  const middle = {
    x: ring.reduce((sum, spot) => sum + spot.x, 0) / ring.length,
    y: ring.reduce((sum, spot) => sum + spot.y, 0) / ring.length,
  };
  const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
  const outward = (mid.x - middle.x) * across.x + (mid.y - middle.y) * across.y;
  if (Math.abs(outward) < 1e-9) return up;
  return outward > 0 ? across : { x: -across.x, y: -across.y };
}

/** The length a click on a segment would take, hung clear of the segment. */
function lengthFrom(hit: SketchObject, measuring: Measuring): Written | null {
  const { settled, scale } = measuring;
  if (!isLine(hit) || hit.form !== "segment") return null;
  const along = settled.lines.get(hit.id);
  const ends = endsOf(hit);
  if (!along || !ends) return null;
  const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
  const out = outwardOf(along, ends, measuring);
  // Far enough out that the whole of the number clears the segment, which is
  // further on a steep one, where the number lies across it rather than along it.
  const made = newReading("length", [hit.id], mid, measuring);
  const box = readingBox(made, measuring);
  const clear = READING_OFF + (Math.abs(out.x) * box.width + Math.abs(out.y) * box.height) / 2;
  const to = { x: mid.x + out.x * (clear / scale), y: mid.y + out.y * (clear / scale) };
  return { reading: { ...made, ...shift(mid, to, made) }, mark: null };
}

/** The area a click would take, off a fill or off a whole circle. */
function areaFrom(hit: SketchObject, measuring: Measuring): Written | null {
  const { settled } = measuring;
  if (isInterior(hit)) {
    const corners = settled.shapes.get(hit.id);
    const inside = filledPath(hit);
    const round = inside ? settled.circles.get(inside) : undefined;
    const middle = corners
      ? {
          x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
          y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
        }
      : round?.at;
    if (!middle) return null;
    return { reading: newReading("area", [hit.id], middle, measuring), mark: null };
  }
  if (isCircle(hit)) {
    const round = settled.circles.get(hit.id);
    if (!round) return null;
    return { reading: newReading("area", [hit.id], round.at, measuring), mark: null };
  }
  return null;
}

/** The angle a click would take, off an angle mark or off a bare corner. */
function angleFrom(hit: SketchObject, measuring: Measuring): Written | null {
  const corner = isMark(hit) && !("path" in hit) ? hit.corner : isPoint(hit) ? hit.id : null;
  if (!corner) return null;
  const at3 =
    isMark(hit) && !("path" in hit)
      ? [hit.arms[0], corner, hit.arms[1]]
      : cornerArms(corner, measuring);
  if (!at3) return null;
  return angleWritten({ corner, arms: [at3[0], at3[2]] }, hit, measuring);
}

/**
 * A reading of what was clicked, where the Measure tool can take one from it: a
 * length off a segment, an area off a fill or a circle, an angle off an angle
 * mark or off a corner with two straight objects at it. Anything else is
 * measured from the Measure menu, with the objects picked first.
 */
export function readingFrom(at: Position, measuring: Measuring): Written | null {
  const { objects, settled, scale, measure } = measuring;
  const hit = objectAt(at, { objects, scale, settled });
  if (!hit) return null;
  if (measure === "length") return lengthFrom(hit, measuring);
  if (measure === "area") return areaFrom(hit, measuring);
  if (measure === "angle") return angleFrom(hit, measuring);
  return null;
}

/** The arcs an angle would land as, drawn while it is being asked about. */
export function arcsBetween(
  corner: string,
  arms: [string, string],
  reflex: boolean,
  measuring: Measuring,
): string[] {
  const { settled, scale, lastMark } = measuring;
  const spot = settled.points.get(corner);
  const ends = arms.map((id) => settled.points.get(id));
  if (!spot || ends.some((end) => end === undefined)) return [];
  const [one, other] = ends as SketchPoint[];
  const from = Math.atan2(one.y - spot.y, one.x - spot.x);
  const to = Math.atan2(other.y - spot.y, other.x - spot.x);
  const sweep = markSweep(from, to, reflex);
  return markStrokes(
    {
      form: "angle",
      at: { x: spot.x, y: spot.y },
      from,
      sweep,
      strokes: lastMark.angle,
      radius: lastMark.radius,
      square: isRightAngle(sweep),
    },
    scale,
  );
}

/** One arrowhead, drawn as the filled triangle it is rather than two strokes. */
function arrowPath(tip: Position, back: Position, head: number, wing: number): string {
  const spot = (at: Position) => `${at.x} ${at.y}`;
  const point = { x: back.x - tip.x, y: back.y - tip.y };
  const far = Math.hypot(point.x, point.y) || 1;
  const runs = { x: (point.x / far) * head, y: (point.y / far) * head };
  const side = { x: -runs.y / head, y: runs.x / head };
  return `M ${spot(tip)} L ${spot({ x: tip.x + runs.x + side.x * wing, y: tip.y + runs.y + side.y * wing })} L ${spot({ x: tip.x + runs.x - side.x * wing, y: tip.y + runs.y - side.y * wing })} Z`;
}

/**
 * How a length is drawn out: the run between its ends with an arrowhead at
 * each, and the dotted lines back to the segment where it carries them. The
 * number either stands clear above the run or breaks it, and the run sits where
 * the number has been dragged to.
 */
export function dimensionOf(
  reading: SketchMeasurement,
  measuring: Measuring,
): { lines: string[]; heads: string[]; dotted: string[] } | null {
  const { settled, scale, boxes } = measuring;
  if (reading.measure !== "length" || !reading.bounds) return null;
  const along = settled.lines.get(reading.of[0]);
  if (!along) return null;
  const way = { x: along.b.x - along.a.x, y: along.b.y - along.a.y };
  const length = Math.hypot(way.x, way.y);
  if (length === 0) return null;
  const u = { x: way.x / length, y: way.y / length };
  const across = { x: -u.y, y: u.x };
  const box = boxes.get(reading.id) ?? readingBox(reading, measuring);
  // Where the middle of the number sits, and how far off the segment that is.
  const middle = { x: reading.x + box.width / 2 / scale, y: reading.y + box.height / 2 / scale };
  const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
  const number = (middle.x - mid.x) * across.x + (middle.y - mid.y) * across.y;
  // The arrows run where the number does, except in the full form, where the
  // number stands clear above them instead of being run through.
  const stand =
    reading.bounds === "full"
      ? (Math.abs(across.x) * box.width + Math.abs(across.y) * box.height) / 2 / scale +
        BREAK_GAP / scale
      : 0;
  const off = number - Math.sign(number || 1) * stand;
  const from = { x: along.a.x + across.x * off, y: along.a.y + across.y * off };
  const to = { x: along.b.x + across.x * off, y: along.b.y + across.y * off };
  const head = ARROW_HEAD / scale;
  const wing = ARROW_WING / scale;
  const spot = (at: Position) => `${at.x} ${at.y}`;
  const heads = [arrowPath(from, to, head, wing), arrowPath(to, from, head, wing)];
  const lines: string[] = [];
  if (reading.bounds === "full") {
    lines.push(`M ${spot(from)} L ${spot(to)}`);
  } else {
    // Broken by the number: the runs stop either side of the room it takes
    // along the dimension, so nothing is drawn under it.
    const gap =
      (Math.abs(u.x) * box.width + Math.abs(u.y) * box.height) / 2 / scale + BREAK_GAP / scale;
    const at = (middle.x - along.a.x) * u.x + (middle.y - along.a.y) * u.y;
    const stop = { x: from.x + u.x * (at - gap), y: from.y + u.y * (at - gap) };
    const start = { x: from.x + u.x * (at + gap), y: from.y + u.y * (at + gap) };
    if (at - gap > 0) lines.push(`M ${spot(from)} L ${spot(stop)}`);
    if (at + gap < length) lines.push(`M ${spot(start)} L ${spot(to)}`);
  }
  // The dotted lines run a little past the arrows, the way a drawn dimension is,
  // so the end of the line is clear of the head.
  const past = {
    x: across.x * Math.sign(off || 1) * (LEADER_PAST / scale),
    y: across.y * Math.sign(off || 1) * (LEADER_PAST / scale),
  };
  const dotted = reading.leaders
    ? [
        `M ${spot(along.a)} L ${spot({ x: from.x + past.x, y: from.y + past.y })}`,
        `M ${spot(along.b)} L ${spot({ x: to.x + past.x, y: to.y + past.y })}`,
      ]
    : [];
  return { lines, heads, dotted };
}
