/**
 * Putting a tied reading where its figure has got to.
 *
 * The arrows on a length and the arc on an angle are worked out from the figure
 * every time it is drawn, so they follow it about. A number does not: it sits
 * where it was put, which is what leaves it behind when the figure moves. A
 * reading that has been tied holds its place in the frame of what it reads
 * instead, and this is the pass that works its place on the sheet back out of
 * that, so everything downstream of the page goes on reading a plain `x` and
 * `y` and knows nothing about the tie.
 */

import { frameOf, spotIn, spotOf } from "./measure";
import { isMeasurement, type Settled, type SketchObject } from "./model";

/**
 * The page with a number the Measure tool has just written tied to what it
 * reads, which is what Preferences asks for by turning the chain on for new
 * readings. It is tied at the spot the tool chose, so the number comes out
 * where it was asked for and follows the figure from there.
 *
 * Only what the tool wrote: a reading from the Measure menu lands in a row up
 * in the corner of the view rather than beside a figure, so it has no figure to
 * be tied to.
 */
export function readingsTied(
  objects: SketchObject[],
  settled: Settled,
  already: Set<string>,
): SketchObject[] {
  let tied = false;
  const next = objects.map((object) => {
    if (!isMeasurement(object) || !object.bare || object.tied || already.has(object.id)) {
      return object;
    }
    const frame = frameOf(object, objects, settled);
    if (!frame) return object;
    tied = true;
    return { ...object, tied: spotOf(frame, object) };
  });
  return tied ? next : objects;
}

/** The page with every tied reading moved to where its figure now is. */
export function readingsPlaced(objects: SketchObject[], settled: Settled): SketchObject[] {
  let moved = false;
  const next = objects.map((object) => {
    if (!isMeasurement(object) || !object.tied) return object;
    const frame = frameOf(object, objects, settled);
    if (!frame) return object;
    const at = spotIn(frame, object.tied);
    if (at.x === object.x && at.y === object.y) return object;
    moved = true;
    return { ...object, x: at.x, y: at.y };
  });
  return moved ? next : objects;
}
