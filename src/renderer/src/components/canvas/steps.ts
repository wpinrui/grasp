/**
 * Where a click lands, and what the snapping steps hold it to.
 *
 * Two things settle a spot. What is already on the sheet comes first: a point,
 * a path or a crossing under the pointer is what a click lands on, whatever the
 * steps are set to. Where nothing is there, the steps have their say, holding
 * the run and the bearing from wherever the gesture started to whole numbers of
 * what the Snap panel is set to.
 *
 * All of it is worked out from the figure handed in, so the same pointer over
 * the same figure lands in the same place wherever it is asked from.
 */

import { armsAt, endsOf } from "../../sketch/measure";
import {
  alongPath,
  crossings,
  distance,
  distanceToPath,
  isArc,
  isCircle,
  isLine,
  isLocus,
  isPoint,
  objectAt,
  type PathGeometry,
  type Position,
  PX_PER_CM,
  pathIn,
  radiansOf,
  type SketchObject,
  slackAt,
  spotOnPath,
} from "../../sketch/model";
import type { Snapping } from "../SnapPanel";
import {
  ARROW_GRAB,
  CROSS_REACH,
  type Figure,
  type Handle,
  nearestArm,
  type Pending,
  type Snap,
  stepped,
  type Tracing,
  type Travel,
} from "./sheet";

/** The figure a click is aimed at, and what is half drawn over it. */
export interface Aiming extends Figure {
  /** How far off a path still counts as on it, at this zoom. */
  slack: number;
  snapping: Snapping;
  handles: Handle[];
  pending: Pending | null;
  tracing: Tracing | null;
  /** Shift takes over from the snapping while it is down. */
  shiftHeld: boolean;
  /**
   * The objects as they stand right now. `objects` is what the render this was
   * built in left; a drag moves them as it goes and has to read the live ones.
   */
  present: () => SketchObject[];
}

/** Where the gesture under way started from, if one has. */
function startedAt(aiming: Aiming): Position | undefined {
  const { pending, tracing } = aiming;
  return pending?.start ?? tracing?.spots[tracing.spots.length - 1];
}

/** The stretch of its domain a locus is drawn over. */
export function spanOfLocus(id: string, aiming: Aiming): [number, number] {
  const locus = aiming.objects.find((object) => object.id === id);
  return locus && isLocus(locus) ? locus.span : [0, 1];
}

/** The arrowhead nearest the pointer, if the pointer is on one. */
export function handleAt(at: Position, aiming: Aiming): Handle | null {
  const reach = ARROW_GRAB / aiming.scale;
  return aiming.handles.find((handle) => distance(handle.at, at) <= reach) ?? null;
}

/**
 * What a click at this spot would land on. A point already there wins, then the
 * crossing of two straight objects, then the one straight object under the
 * pointer, which a new point would belong to.
 */
export function snapAt(at: Position, aiming: Aiming): Snap | null {
  const { objects, settled, scale, slack } = aiming;
  const over = objectAt(at, { objects, scale, settled });
  if (over && isPoint(over)) {
    return { kind: "point", ids: [over.id], at: { x: over.x, y: over.y } };
  }
  // The paths the pointer is on, the newest first, as picking has them.
  const near: { id: string; along: PathGeometry }[] = [];
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (!isLine(object) && !isCircle(object) && !isArc(object)) continue;
    const along = pathIn(settled, object.id);
    if (along && distanceToPath(along, at) <= slack) near.push({ id: object.id, along });
  }
  if (near.length === 0) return null;
  for (let one = 0; one < near.length; one += 1) {
    for (let other = one + 1; other < near.length; other += 1) {
      // Two paths can meet twice, so the one being pointed at is the one the
      // click builds, and which of the two it is holds still as they move.
      const met = crossings(near[one].along, near[other].along);
      const pick = met.findIndex((spot) => distance(spot, at) <= CROSS_REACH / scale);
      if (pick !== -1) {
        return { kind: "cross", ids: [near[one].id, near[other].id], pick, at: met[pick] };
      }
    }
  }
  const first = near[0];
  return {
    kind: "line",
    ids: [first.id],
    at: spotOnPath(first.along, alongPath(first.along, at)),
  };
}

/** What an angle step is counted from: the nearest arm, or the horizontal. */
function baseAngle(bearing: number, aiming: Aiming): number {
  const { objects, settled, pending, tracing } = aiming;
  const arms = pending
    ? armsAt(pending.startId, objects, settled).map((arm) => arm.angle)
    : tracing && tracing.spots.length >= 2
      ? [
          Math.atan2(
            tracing.spots[tracing.spots.length - 2].y - tracing.spots[tracing.spots.length - 1].y,
            tracing.spots[tracing.spots.length - 2].x - tracing.spots[tracing.spots.length - 1].x,
          ),
        ]
      : [];
  return nearestArm(arms, bearing) ?? 0;
}

/** The whole numbers around one, since the nearest may miss the path. */
function nearWhole(value: number): number[] {
  const whole = Math.round(value);
  return [whole - 1, whole, whole + 1];
}

/**
 * The spots along a path that the steps say a click may land on: where the
 * whole-step rings about the start cross it, and where the whole-step
 * directions out of the start cross it. Only rings and directions either side of
 * where the pointer is, since the rest are too far away to have been meant.
 */
function stepsAlong(
  run: { along: PathGeometry; from: Position; at: Position },
  aiming: Aiming,
): Position[] {
  const { along, from, at } = run;
  const { snapping } = aiming;
  const spots: Position[] = [];
  if (snapping.length && snapping.lengthCm > 0) {
    const step = snapping.lengthCm * PX_PER_CM;
    for (const whole of nearWhole(distance(from, at) / step)) {
      if (whole <= 0) continue;
      spots.push(...crossings({ at: from, radius: whole * step, ref: 0 }, along));
    }
  }
  if (snapping.angle && snapping.angleDegrees > 0) {
    const step = radiansOf(snapping.angleDegrees);
    const bearing = Math.atan2(at.y - from.y, at.x - from.x);
    const base = baseAngle(bearing, aiming);
    for (const whole of nearWhole((bearing - base) / step)) {
      const angle = base + whole * step;
      const out = { x: from.x + Math.cos(angle), y: from.y + Math.sin(angle) };
      spots.push(...crossings({ a: from, b: out, form: "ray" }, along));
    }
  }
  return spots;
}

/**
 * Where on a snapped object the click actually lands.
 *
 * A point and a crossing are single spots: landing on one settles it, and the
 * steps have nothing left to say. A path is not. Landing on a path only says the
 * point is somewhere on it, and how far along is still free, so that is what the
 * steps spend. Each step that is switched on offers its own spots along the
 * path, and the click takes whichever of them the pointer is nearest, so having
 * both on offers more places to land rather than fewer.
 */
function alongWithSteps(
  landing: { found: Snap; from: Position | undefined; at: Position },
  aiming: Aiming,
): Position {
  const { found, from, at } = landing;
  if (found.kind !== "line" || !from) return found.at;
  const along = pathIn(aiming.settled, found.ids[0]);
  if (!along) return found.at;
  const spots = stepsAlong({ along, from, at }, aiming);
  if (spots.length === 0) return found.at;
  return spots.reduce((near, spot) => (distance(spot, at) < distance(near, at) ? spot : near));
}

/**
 * The pointer held to whole steps of length and of angle, where those are
 * switched on. An angle is measured from the straight object already at the
 * corner where there is one, so the number the sheet reads out while the object
 * is being drawn is the number being held.
 */
function heldToSteps(from: Position, at: Position, aiming: Aiming): Position {
  const { snapping } = aiming;
  if (!snapping.length && !snapping.angle) return at;
  let reach = distance(from, at);
  let angle = Math.atan2(at.y - from.y, at.x - from.x);
  if (snapping.length && snapping.lengthCm > 0) {
    const step = snapping.lengthCm * PX_PER_CM;
    reach = Math.max(step, Math.round(reach / step) * step);
  }
  if (snapping.angle && snapping.angleDegrees > 0) {
    const step = radiansOf(snapping.angleDegrees);
    const base = baseAngle(angle, aiming);
    angle = base + Math.round((angle - base) / step) * step;
  }
  return { x: from.x + Math.cos(angle) * reach, y: from.y + Math.sin(angle) * reach };
}

/**
 * Where a click would go and what it would use. Shift holds the direction from
 * the first click to the nearest 15 degrees, and takes over from the snapping
 * while it is down, so the angle is what you asked for.
 */
export function aimAt(at: Position, aiming: Aiming): { found: Snap | null; spot: Position } {
  const from = startedAt(aiming);
  if (from && aiming.shiftHeld) return { found: null, spot: stepped(from, at) };
  // What is already on the sheet comes first: a point, a path or a crossing
  // under the pointer is what a click lands on, whatever the steps are set to.
  const found = aiming.snapping.objects ? snapAt(at, aiming) : null;
  if (found) return { found, spot: alongWithSteps({ found, from, at }, aiming) };
  return { found: null, spot: from ? heldToSteps(from, at, aiming) : at };
}

/** Whether a drag has hold of any geometry, rather than writing alone. */
function carriesGeometry(ids: string[], aiming: Aiming): boolean {
  const present = aiming.present();
  return ids.some((id) => {
    const object = present.find((candidate) => candidate.id === id);
    return object !== undefined && isPoint(object);
  });
}

/**
 * How far a drag actually moves what it has hold of: the pointer's travel held
 * to whole steps of length and of angle, both counted from where the drag
 * started, the angle from the horizontal. A move can come to nothing, so unlike
 * a line being drawn it is not held to at least one step.
 *
 * The steps hold geometry. Writing dragged on its own goes exactly where it is
 * put, and a drag carrying both counts as geometry so that it all moves together.
 */
export function heldMove(ids: string[], by: Position, aiming: Aiming): Position {
  const { snapping } = aiming;
  // The steps hold a move only when asked to. Off, a drag goes exactly where it
  // is put, whatever the steps are set to.
  if (!snapping.moving) return by;
  if (!snapping.length && !snapping.angle) return by;
  if (!carriesGeometry(ids, aiming)) return by;
  let reach = Math.hypot(by.x, by.y);
  let angle = Math.atan2(by.y, by.x);
  if (snapping.length && snapping.lengthCm > 0) {
    const step = snapping.lengthCm * PX_PER_CM;
    reach = Math.round(reach / step) * step;
  }
  if (snapping.angle && snapping.angleDegrees > 0) {
    const step = radiansOf(snapping.angleDegrees);
    angle = Math.round(angle / step) * step;
  }
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
}

/**
 * What a move writes on the sheet: from where the first point it carries
 * started to where that point has got to. A drag carrying no geometry says
 * nothing, the way it is held to no steps.
 */
export function travelOf(
  move: { ids: string[]; from: Position[]; went: Position },
  aiming: Aiming,
): Travel | null {
  const { ids, from, went } = move;
  if (!carriesGeometry(ids, aiming)) return null;
  const start = from[0];
  return { from: start, to: { x: start.x + went.x, y: start.y + went.y } };
}

/**
 * The path under the pointer, which is what a tick rides and what a point put
 * on it slides along. The topmost first, the way picking has them.
 */
export function pathUnder(
  at: Position,
  where: Pick<Aiming, "objects" | "settled" | "scale">,
  straightOnly = false,
): SketchObject | null {
  const { objects, settled, scale } = where;
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (straightOnly ? !isLine(object) : !isLine(object) && !isCircle(object) && !isArc(object)) {
      continue;
    }
    const along = pathIn(settled, object.id);
    if (along && distanceToPath(along, at) <= slackAt(scale)) return object;
  }
  return null;
}

/**
 * The point two straight objects meet at, and the far end of each. Null where
 * they do not meet, or meet twice, since neither says an angle.
 */
export function cornerBetween(
  one: string,
  other: string,
  objects: SketchObject[],
): { corner: string; arms: [string, string] } | null {
  const first = objects.find((object) => object.id === one);
  const second = objects.find((object) => object.id === other);
  if (!first || !second) return null;
  const a = endsOf(first);
  const b = endsOf(second);
  if (!a || !b) return null;
  const shared = a.filter((end) => b.includes(end));
  if (shared.length !== 1) return null;
  const corner = shared[0];
  return {
    corner,
    arms: [a[0] === corner ? a[1] : a[0], b[0] === corner ? b[1] : b[0]] as [string, string],
  };
}
