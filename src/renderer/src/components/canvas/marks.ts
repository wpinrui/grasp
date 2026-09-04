/**
 * The markings on a figure: finding the one under the pointer, and drawing the
 * arcs an angle would land as while it is still being asked about.
 *
 * A mark is shaped against the figure it marks and drawn at the zoom the sheet
 * is at, so both are handed in rather than read off the window.
 */

import {
  isMark,
  isRightAngle,
  markStrokes,
  markSweep,
  nearMark,
  type Position,
  type Settled,
  type SketchMark,
  type SketchPoint,
} from "../../sketch/model";
import type { Figure, LastMark } from "./sheet";

/** Where the figure settled, the zoom, and what a new mark is set to. */
export interface Marking {
  settled: Settled;
  scale: number;
  lastMark: LastMark;
}

/** The mark under this spot, the topmost first, or nothing there. */
export function markUnder(at: Position, where: Figure): SketchMark | null {
  const { objects } = where;
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isMark(object) && nearMark(object, at, where)) return object;
  }
  return null;
}

/** The arcs an angle would land as, drawn while it is being asked about. */
export function arcsBetween(
  angle: { corner: string; arms: [string, string]; reflex: boolean },
  marking: Marking,
): string[] {
  const { corner, arms, reflex } = angle;
  const { settled, scale, lastMark } = marking;
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
