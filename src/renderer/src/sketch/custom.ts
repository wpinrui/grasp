/**
 * Custom transforms: a relationship shown by example rather than named.
 *
 * Two points define one, a seed and an image built from it by any run of
 * constructions and transforms. Applying it to something else replays that
 * whole run with the seed standing where the new point is, so whatever the
 * example did to its point is what happens to every point it is applied to.
 *
 * The run is replayed as real objects, hidden, rather than collapsed into a
 * number. That is what keeps it live: change the mirror the example reflected
 * across and every image made by the transform moves.
 */

import { rewrite, rewriteArc, rewriteCircle, rewriteSpan, settleCopy } from "./iterate";
import {
  cornersOf,
  createArc,
  createCircle,
  createFill,
  createInterior,
  createLine,
  createPoint,
  familyOf,
  filledPath,
  imageOf,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  type Settled,
  type SketchObject,
  type SketchPoint,
  type SketchTransform,
  withDependents,
} from "./model";

/**
 * What the example actually does: everything the image is built from that hangs
 * off the seed, in the order it was built. Read backwards, since a parent
 * always comes before what hangs off it.
 */
export function chainOf(objects: SketchObject[], seed: string, image: string): SketchObject[] {
  const below = withDependents(objects, [seed]);
  if (!below.has(image) || image === seed) return [];
  const wanted = new Set<string>([image]);
  for (let nth = objects.length - 1; nth >= 0; nth -= 1) {
    const object = objects[nth];
    if (!wanted.has(object.id)) continue;
    for (const parent of familyOf(object) ?? []) if (below.has(parent)) wanted.add(parent);
  }
  return objects.filter((object) => wanted.has(object.id) && object.id !== seed);
}

/** Whether two points could define a transform: the second built from the first. */
export function canDefine(objects: SketchObject[], selection: string[]): boolean {
  if (selection.length !== 2) return false;
  const held = selection.map((id) => objects.find((object) => object.id === id));
  if (!held.every((object) => object !== undefined && isPoint(object))) return false;
  return chainOf(objects, selection[0], selection[1]).length > 0;
}

/**
 * The example replayed with the seed standing at one point: the image it comes
 * to, and everything built along the way, which is kept out of sight since it
 * is the working rather than the answer.
 */
function replay(
  chain: SketchObject[],
  image: string,
  seed: string,
  at: string,
  settled: Settled,
): { image: SketchPoint; along: SketchObject[] } | null {
  const stands = new Map<string, string>([[seed, at]]);
  const along: SketchObject[] = [];
  let landed: SketchPoint | null = null;
  for (const object of chain) {
    const to = (id: string) => stands.get(id) ?? id;
    let copy: SketchObject | null = null;
    if (isInterior(object)) {
      const round = filledPath(object);
      copy = round ? createFill(to(round)) : createInterior((cornersOf(object) ?? []).map(to));
    } else if (isArc(object)) {
      copy = createArc(rewriteArc(object.span, to));
    } else if (isCircle(object)) {
      copy = createCircle(rewriteCircle(object.span, to));
    } else if (isLine(object)) {
      copy = createLine(object.form, rewriteSpan(object.span, to));
    } else if (isPoint(object) && object.from) {
      const from = rewrite(object.from, to);
      const where = imageOf(from, settled);
      if (where) copy = createPoint(where, object.size, from);
    }
    // A chain with a hole in it images nothing, rather than something wrong.
    if (!copy) return null;
    stands.set(object.id, copy.id);
    settleCopy(copy, settled);
    if (object.id === image) {
      if (!isPoint(copy)) return null;
      landed = copy;
    } else {
      along.push({ ...copy, hidden: true });
    }
  }
  return landed ? { image: landed, along } : null;
}

/**
 * How a custom transform images one point: the whole example replayed with the
 * seed standing there. Handed to the same imager the basic transforms use, so
 * lines, circles and fills come back on the imaged points exactly as they do
 * for a rotation.
 */
export function customImager(
  transform: SketchTransform,
  objects: SketchObject[],
): (id: string, settled: Settled) => { image: SketchPoint; along: SketchObject[] } | null {
  const chain = chainOf(objects, transform.seed, transform.image);
  return (id, settled) =>
    chain.length === 0 ? null : replay(chain, transform.image, transform.seed, id, settled);
}
