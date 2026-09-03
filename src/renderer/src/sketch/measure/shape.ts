import {
  type ArcGeometry,
  type CircleGeometry,
  degreesOf,
  distance,
  distanceToPath,
  isLine,
  type LineGeometry,
  type Position,
  pathIn,
  type Settled,
  type SketchObject,
} from "../model";
import { TURN } from "./units";
/** How close to the rim a point has to be to count as on a circle. */
export function onCircle(round: CircleGeometry, spot: Position): boolean {
  return Math.abs(distance(round.at, spot) - round.radius) <= Math.max(1e-6, round.radius * 1e-6);
}

export function find(objects: SketchObject[], id: string): SketchObject | undefined {
  return objects.find((object) => object.id === id);
}

/** The whole line a straight object lies on, since a distance runs to that. */
export function wholeLine(along: LineGeometry): LineGeometry {
  return { a: along.a, b: along.b, form: "line" };
}

/** How far round an arc runs, in radians, and how long it is, in sheet pixels. */
export function arcSpread(arc: ArcGeometry): { angle: number; length: number } {
  if (arc.flat) {
    return { angle: 0, length: distance(arc.flat[0], arc.flat[1]) };
  }
  const angle = Math.abs(arc.sweep);
  return { angle, length: angle * arc.radius };
}

/** The counter-clockwise turn from one angle round to another, on screen. */
function ccw(from: number, to: number): number {
  return (((from - to) % TURN) + TURN) % TURN;
}

function angleAt(centre: Position, spot: Position): number {
  return Math.atan2(spot.y - centre.y, spot.x - centre.x);
}

/**
 * The stretch of a circle two or three points name: the minor arc between two,
 * and the one running from the first through the second to the third when there
 * are three. In radians.
 */
export function stretchOn(round: CircleGeometry, at: Position[]): number {
  const angles = at.map((spot) => angleAt(round.at, spot));
  const round_trip = ccw(angles[0], angles[angles.length - 1]);
  if (at.length === 2) return Math.min(round_trip, TURN - round_trip);
  return ccw(angles[0], angles[1]) <= round_trip ? round_trip : TURN - round_trip;
}

/** The angle at B, between BA and BC, from 0 to 180 degrees. */
export function cornerAngle(a: Position, b: Position, c: Position): number | null {
  const one = { x: a.x - b.x, y: a.y - b.y };
  const other = { x: c.x - b.x, y: c.y - b.y };
  const lengths = Math.hypot(one.x, one.y) * Math.hypot(other.x, other.y);
  if (lengths < 1e-9) return null;
  const cos = (one.x * other.x + one.y * other.y) / lengths;
  return degreesOf(Math.acos(Math.min(1, Math.max(-1, cos))));
}

/**
 * How near a point has to come to a straight object to be standing on it. A
 * crossing is exact to the arithmetic that built it; this is not slack enough
 * for a point that merely looks close.
 */
const ON_ARM = 1e-6;

/** The two ends of a straight object, or null when it has none to name. */
export function endsOf(object: SketchObject): [string, string] | null {
  if (!isLine(object) || object.span.kind !== "through") return null;
  return object.span.ends;
}

/** One straight object running out of a corner: which it is, and which way. */
export interface Arm {
  /** The straight object itself. Two arms share one where it runs out both ways. */
  side: string;
  /** Its far end, which is the point the arm runs to. */
  end: string;
  /** The way it runs out of the corner, in radians. */
  angle: number;
}

/** Every straight object running out of a corner, sorted by the way it runs. */
export function armsAt(corner: string, objects: SketchObject[], settled: Settled): Arm[] {
  const at = settled.points.get(corner);
  if (!at) return [];
  const arms: Arm[] = [];
  const add = (side: string, end: string) => {
    const spot = settled.points.get(end);
    if (!spot || (spot.x === at.x && spot.y === at.y)) return;
    arms.push({ side, end, angle: Math.atan2(spot.y - at.y, spot.x - at.x) });
  };
  for (const object of objects) {
    const ends = endsOf(object);
    if (!ends) continue;
    // An end of the object: it runs out of the corner one way, to its far end.
    if (ends.includes(corner)) {
      add(object.id, ends[0] === corner ? ends[1] : ends[0]);
      continue;
    }
    // Not an end but standing on it, which is what a crossing is: the object
    // runs out of the corner both ways, and each way is an arm of its own.
    // Counting only the ends would leave a crossing looking like no corner at
    // all, so nothing there could be marked or measured.
    const along = pathIn(settled, object.id);
    if (!along || !isLine(object)) continue;
    if (distanceToPath(along, at) > ON_ARM) continue;
    add(object.id, ends[0]);
    add(object.id, ends[1]);
  }
  return arms.sort((one, other) => one.angle - other.angle);
}

/**
 * Which angle a drag out of the corner asks for: the two arms the drag fell
 * between, in the order the turn runs from the first to the second, and whether
 * that turn is the long way round. Null when there is no angle there to mark.
 */

/**
 * Every angle at a corner: one for each pair of arms running out of it, with
 * the turn between them in degrees. A corner with two arms makes one angle, and
 * that is the only case where clicking it says which angle was meant.
 */
export function anglesAt(
  corner: string,
  objects: SketchObject[],
  settled: Settled,
): { arms: [string, string]; sides: [string, string]; turn: number }[] {
  const arms = armsAt(corner, objects, settled);
  const out: { arms: [string, string]; sides: [string, string]; turn: number }[] = [];
  for (let i = 0; i < arms.length; i += 1) {
    for (let j = i + 1; j < arms.length; j += 1) {
      // The two ways out of one object are the same straight line, and the
      // straight angle between them is not an angle anybody marks.
      if (arms[i].side === arms[j].side) continue;
      let turn = Math.abs(arms[i].angle - arms[j].angle);
      if (turn > Math.PI) turn = Math.PI * 2 - turn;
      out.push({
        arms: [arms[i].end, arms[j].end],
        sides: [arms[i].side, arms[j].side],
        turn: degreesOf(turn),
      });
    }
  }
  return out;
}

export function angleWanted(
  arms: Arm[],
  bearing: number,
): { arms: [string, string]; sides: [string, string]; reflex: boolean } | null {
  if (arms.length < 2) return null;
  const turn = (from: number, to: number) => {
    const gap = (to - from) % (Math.PI * 2);
    return gap < 0 ? gap + Math.PI * 2 : gap;
  };
  // The drag lands in the wedge between one arm and the next one round.
  let found = arms.length - 1;
  for (let index = 0; index < arms.length; index += 1) {
    const next = arms[(index + 1) % arms.length];
    if (turn(arms[index].angle, bearing) < turn(arms[index].angle, next.angle)) {
      found = index;
      break;
    }
  }
  const one = arms[found];
  const other = arms[(found + 1) % arms.length];
  const sweep = turn(one.angle, other.angle);
  return {
    arms: [one.end, other.end],
    sides: [one.side, other.side],
    reflex: sweep > Math.PI,
  };
}

/**
 * The three points an angle between two straight objects runs through: the far
 * end of the first, the corner they share, and the far end of the second. Null
 * when they share no end, which is when there is no angle to measure.
 */
export function cornerOf(one: SketchObject, other: SketchObject): [string, string, string] | null {
  const first = endsOf(one);
  const second = endsOf(other);
  if (!first || !second) return null;
  const shared = first.filter((end) => second.includes(end));
  if (shared.length !== 1) return null;
  const corner = shared[0];
  const from = first.find((end) => end !== corner);
  const to = second.find((end) => end !== corner);
  return from && to ? [from, corner, to] : null;
}

/** The area a ring of corners encloses, by the shoelace sum. */
export function shoelace(corners: Position[]): number {
  let twice = 0;
  for (let index = 0; index < corners.length; index += 1) {
    const one = corners[index];
    const next = corners[(index + 1) % corners.length];
    twice += one.x * next.y - next.x * one.y;
  }
  return Math.abs(twice) / 2;
}
