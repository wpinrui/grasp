/**
 * What the Measure tool would write, and where it hangs.
 *
 * A reading lands beside what it reads rather than at the pointer, so the
 * figure is not covered by the number taken off it. Working out where "beside"
 * is takes the figure, the zoom and about how big the number will come out, so
 * all of that is handed in rather than read off the window.
 */

import { armsAt, endsOf, frameOf, spotOf } from "../../sketch/measure";
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
  type LineGeometry,
  type MeasureKind,
  markReach,
  markSweep,
  objectAt,
  type Position,
  radiusOf,
  type SketchMark,
  type SketchMeasurement,
  type SketchObject,
  type SketchPoint,
  slackAt,
} from "../../sketch/model";
import {
  ANGLE_READING_OFF,
  type Figure,
  type LastMark,
  middleOf,
  READING_CHAR,
  READING_HEIGHT,
  READING_OFF,
  READING_POINTS,
  type Written,
} from "./sheet";

/** The figure a reading is taken off, and what settles how it comes out. */
export interface Measuring extends Figure {
  /** What the Measure tool is armed with, or null while it is not up. */
  measure: string | null;
  /** The words a reading comes out as, which is how wide it is going to be. */
  saying: (made: SketchMeasurement) => string;
  lastMark: LastMark;
  /** How far out a new angle mark sits, clear of what is at the corner already. */
  clearOf: (corner: string) => number;
  /**
   * Whether a number this tool writes comes out tied to what it reads, which
   * Preferences says. It is settled here rather than by a pass over the page
   * because only this knows a number was written by the tool just now: a pasted
   * copy of one carries every mark of having been, fresh id and all.
   */
  tieReadings: boolean;
}

/** About how big a reading comes out on screen, before it has been drawn. */
export function readingBox(
  made: SketchMeasurement,
  measuring: Pick<Measuring, "saying">,
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
  taken: { measure: MeasureKind; of: string[]; at: Position },
  measuring: Measuring,
): SketchMeasurement {
  const { measure, of, at } = taken;
  const made = { ...createMeasurement(measure, of, at), size: READING_POINTS, bare: true };
  const box = readingBox(made, measuring);
  const { scale } = measuring;
  return { ...made, x: at.x - box.width / 2 / scale, y: at.y - box.height / 2 / scale };
}

/**
 * The same reading, tied to what it reads where Preferences asks for that. It
 * is tied where it has been hung, so the number comes out where it was asked
 * for and goes wherever the figure goes from there.
 *
 * It happens here, at the last moment before the reading is handed back, rather
 * than as a pass over the page: only the tool knows a reading was written by
 * the tool just now, since a pasted copy of one carries every other mark of
 * having been, and only here has every kind finished moving its number.
 */
export function tiedToFigure(written: Written | null, measuring: Measuring): Written | null {
  if (!written || !measuring.tieReadings) return written;
  const { objects, settled } = measuring;
  const frame = frameOf(written.reading, objects, settled);
  if (!frame) return written;
  return { ...written, reading: { ...written.reading, tied: spotOf(frame, written.reading) } };
}

/** The two straight objects at a corner, as the three points of its angle. */
function cornerArms(corner: string, measuring: Measuring): [string, string, string] | null {
  const arms = armsAt(corner, measuring.objects, measuring.settled);
  return arms.length === 2 ? [arms[0].end, corner, arms[1].end] : null;
}

/** The point under the pointer, which is what an angle is marked at. */
export function pointUnder(
  at: Position,
  measuring: Pick<Measuring, "objects" | "scale">,
): SketchPoint | null {
  const { objects, scale } = measuring;
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const point = objects[index];
    if (!isPoint(point)) continue;
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
  measuring: Pick<Measuring, "objects" | "settled" | "lastMark" | "clearOf">,
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
  hung: { reading: SketchMeasurement; mark: SketchMark; reflex: boolean },
  measuring: Pick<Measuring, "settled" | "scale" | "saying">,
): Position | null {
  const { reading, mark, reflex } = hung;
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
 * between, and the mark it has to be given first.
 */
export function angleWritten(
  angle: {
    corner: string;
    arms: [string, string];
    /** Whatever was under the pointer, where a click is what asked. */
    hit: SketchObject | null;
    /** Set where a drag or the dialog named the arms itself. */
    named?: boolean;
  },
  measuring: Measuring,
): Written | null {
  const { corner, arms, hit, named = false } = angle;
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
  const made = { ...newReading({ measure: "angle", of: at3, at: spot }, measuring), reflex };
  const hangs = angleReadingSpot({ reading: made, mark, reflex }, measuring);
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
  const middle = middleOf(ring);
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
  const made = newReading({ measure: "length", of: [hit.id], at: mid }, measuring);
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
    const middle = corners ? middleOf(corners) : round?.at;
    if (!middle) return null;
    return {
      reading: newReading({ measure: "area", of: [hit.id], at: middle }, measuring),
      mark: null,
    };
  }
  if (isCircle(hit)) {
    const round = settled.circles.get(hit.id);
    if (!round) return null;
    return {
      reading: newReading({ measure: "area", of: [hit.id], at: round.at }, measuring),
      mark: null,
    };
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
  return angleWritten({ corner, arms: [at3[0], at3[2]], hit }, measuring);
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
  if (measure === "length") return tiedToFigure(lengthFrom(hit, measuring), measuring);
  if (measure === "area") return tiedToFigure(areaFrom(hit, measuring), measuring);
  if (measure === "angle") return tiedToFigure(angleFrom(hit, measuring), measuring);
  return null;
}
