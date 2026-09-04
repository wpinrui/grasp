/**
 * What lighting an object up should actually light.
 *
 * An angle is three points and nothing else, which lights three dots and leaves
 * the reader to work out which angle was meant; the arms are what say that, so
 * they are lit too. It is the same for an angle mark, which knows its own two
 * sides.
 */

import { isLine, isMark, isMeasurement, type SketchObject } from "../../sketch/model";

/** The object asked for, and whatever else has to be lit for it to read. */
export function litWith(id: string, everything: SketchObject[]): string[] {
  const object = everything.find((candidate) => candidate.id === id);
  if (!object) return [id];
  if (isMark(object) && !("path" in object)) return [id, ...object.sides];
  if (!isMeasurement(object) || object.measure !== "angle" || object.of.length !== 3) {
    return [id];
  }
  const [one, corner, other] = object.of;
  const sides = everything
    .filter((side) => {
      const ends = isLine(side) && side.span.kind === "through" ? side.span.ends : null;
      if (!ends?.includes(corner)) return false;
      return ends.includes(one) || ends.includes(other);
    })
    .map((side) => side.id);
  return [id, ...sides];
}
