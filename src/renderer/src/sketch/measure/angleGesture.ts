import {
  distance,
  distanceToPath,
  isPoint,
  type Position,
  pathIn,
  type Settled,
  type SketchObject,
} from "../model";
import { armsAt } from "./shape";

/** Resolve both the sides of infinite objects and the sweep traced between them. */
export function angleGesture(
  from: string,
  to: string,
  trail: Position[],
  objects: SketchObject[],
  settled: Settled,
) {
  if (from === to || trail.length < 2) return null;
  const first = pathIn(settled, from);
  const last = pathIn(settled, to);
  if (!first || !last) return null;
  for (const corner of objects.filter((object) => isPoint(object) && !object.hidden)) {
    const at = settled.points.get(corner.id);
    if (!at || distanceToPath(first, at) > 1e-6 || distanceToPath(last, at) > 1e-6) continue;
    const start = trail[0];
    const end = trail[trail.length - 1];
    if (distance(start, at) < 1e-6 || distance(end, at) < 1e-6) continue;
    const bearing = (spot: Position) => Math.atan2(spot.y - at.y, spot.x - at.x);
    const gap = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const arms = armsAt(corner.id, objects, settled);
    const nearest = (spot: Position) =>
      [...arms].sort(
        (a, b) => Math.abs(gap(a.angle, bearing(spot))) - Math.abs(gap(b.angle, bearing(spot))),
      )[0];
    const a = nearest(start);
    const b = nearest(end);
    if (!a || !b || a.end === b.end) continue;
    const turn = Math.abs(gap(a.angle, b.angle));
    if (turn < 1e-9 || Math.abs(turn - Math.PI) < 1e-9) continue;
    let sweep = gap(a.angle, bearing(start));
    for (let index = 1; index < trail.length; index += 1)
      sweep += gap(bearing(trail[index - 1]), bearing(trail[index]));
    sweep += gap(bearing(end), b.angle);
    return {
      corner: corner.id,
      arms: [a.end, b.end] as [string, string],
      reflex: Math.abs(sweep) > Math.PI,
    };
  }
  return null;
}
