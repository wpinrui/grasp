import { inLine } from "./builds";
import type { Quantity } from "./expression";
import { isLine, isMark, type MarkedAngle, type MarkedRatio, type SketchObject } from "./model";
/**
 * What the selection would be marked as: the angle, the ratio, the vector, the
 * mirror or the distances a future transform would follow.
 *
 * A mark is read off the selection in whichever of its forms fits, newest first,
 * so the same entry works whether the corner was picked as three points, as two
 * straight objects meeting, or as an angle already marked on the sheet.
 */

import type { Building } from "./builds";

/** The last thing of a kind that was picked, which is what a Mark entry takes. */
function lastOf<T extends SketchObject>(
  page: Building,
  is: (object: SketchObject) => object is T,
): T | null {
  for (let nth = page.selected.length - 1; nth >= 0; nth -= 1) {
    const object = page.selected[nth];
    if (is(object)) return object;
  }
  return null;
}

/** Every number selected whose quantity is the kind wanted, in pick order. */
function readingsWhere(page: Building, wants: (held: Quantity) => boolean): string[] {
  return page.selected
    .filter((object) => {
      const held = page.geometry.values.get(object.id);
      return held ? wants(held) : false;
    })
    .map((object) => object.id);
}

/** The straight object a mirror would be marked from. */
export function markableMirror(page: Building): string | null {
  return lastOf(page, isLine)?.id ?? null;
}

/** Two points, the first the tail of the vector and the second its head. */
export function markableVector(page: Building): [string, string] | null {
  const points = page.chosenPoints;
  if (points.length < 2) return null;
  return [points[points.length - 2].id, points[points.length - 1].id];
}

/**
 * The angle the selection would mark. An angle marker and two straight
 * objects meeting at a point both come down to three points, so they are
 * turned into those here rather than carried as their own kind of mark.
 */
export function markableAngle(page: Building): MarkedAngle | null {
  const marker = lastOf(page, isMark);
  if (marker && "corner" in marker) {
    return { kind: "points", a: marker.arms[0], corner: marker.corner, b: marker.arms[1] };
  }
  const reading = readingsWhere(page, (held) => held.angle === 1 && held.length === 0);
  if (reading.length > 0) return { kind: "value", of: reading[reading.length - 1] };
  // Two straight objects sharing an end: the shared end is the corner, and
  // each object's far end is a point on its arm.
  const lines = page.selected.filter(isLine).filter((line) => line.span.kind === "through");
  if (lines.length >= 2) {
    const [one, other] = lines.slice(-2);
    const ends = one.span.kind === "through" ? one.span.ends : null;
    const theirs = other.span.kind === "through" ? other.span.ends : null;
    if (ends && theirs) {
      const corner = ends.find((end) => theirs.includes(end));
      if (corner) {
        const a = ends.find((end) => end !== corner);
        const b = theirs.find((end) => end !== corner);
        if (a && b) return { kind: "points", a, corner, b };
      }
    }
  }
  const points = page.chosenPoints;
  if (points.length >= 3) {
    const [a, corner, b] = points.slice(-3);
    return { kind: "points", a: a.id, corner: corner.id, b: b.id };
  }
  return null;
}

/** The ratio the selection would mark, in whichever of its three forms fits. */
export function markableRatio(page: Building): MarkedRatio | null {
  const segments = page.selected.filter(isLine).filter((line) => line.form === "segment");
  if (segments.length >= 2) {
    const [top, bottom] = segments.slice(-2);
    return { kind: "segments", top: top.id, bottom: bottom.id };
  }
  const reading = readingsWhere(page, (held) => held.angle === 0 && held.length === 0);
  if (reading.length > 0) return { kind: "value", of: reading[reading.length - 1] };
  const points = page.chosenPoints;
  if (points.length >= 3) {
    const [a, b, c] = points.slice(-3);
    if (inLine(a, b, c)) return { kind: "points", a: a.id, b: b.id, c: c.id };
  }
  return null;
}

/** One distance for a polar translation, or two for a rectangular one. */
export function markableDistances(page: Building): string[] {
  const readings = readingsWhere(page, (held) => held.length === 1 && held.angle === 0);
  return readings.slice(-2);
}
