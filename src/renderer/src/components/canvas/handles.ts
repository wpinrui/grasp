/**
 * The arrowheads a locus is dragged by, and the ring drawn where a click would
 * land.
 *
 * A segment fixes both ends of the domain, a ray fixes only the end it starts
 * from, and a line fixes neither, so how many arrowheads a locus carries is
 * settled by what it runs along rather than by the locus itself.
 */

import {
  distance,
  isLine,
  isLocus,
  type LocusShape,
  radiusOf,
  type Settled,
  type SketchLocus,
  type SketchObject,
  type SketchPoint,
} from "../../sketch/model";
import { type Figure, type Handle, SNAP_RING, type Snap } from "./sheet";

/** Where an end of a locus is, and which way it carries on from there. */
function handleFor(
  locus: SketchLocus,
  shape: LocusShape,
  end: 0 | 1,
  where: { objects: SketchObject[]; settled: Settled },
): Handle | null {
  const { objects, settled } = where;
  const domain = objects.find((object) => object.id === locus.domain);
  const along = settled.lines.get(locus.domain);
  if (!domain || !isLine(domain) || !along) return null;
  const length = distance(along.a, along.b);
  if (length < 1) return null;
  const path = { x: (along.b.x - along.a.x) / length, y: (along.b.y - along.a.y) / length };
  const handle = { locus: locus.id, end, step: 1 / length };
  if (shape.kind === "points" && shape.at.length > 1) {
    // A point locus carries its arrowhead at the end of the curve, pointing the
    // way the curve was going.
    const tip = end === 1 ? shape.at[shape.at.length - 1] : shape.at[0];
    const back = end === 1 ? shape.at[shape.at.length - 2] : shape.at[1];
    const reach = distance(back, tip);
    const way =
      reach < 0.001
        ? { x: path.x * (end === 1 ? 1 : -1), y: path.y * (end === 1 ? 1 : -1) }
        : { x: (tip.x - back.x) / reach, y: (tip.y - back.y) / reach };
    return { ...handle, at: tip, way };
  }
  // Anything else has no one end of its own, so the arrowhead sits on the
  // domain, at the far end of the stretch the driver runs over.
  const t = locus.span[end];
  return {
    ...handle,
    at: {
      x: along.a.x + (along.b.x - along.a.x) * t,
      y: along.a.y + (along.b.y - along.a.y) * t,
    },
    way: { x: path.x * (end === 1 ? 1 : -1), y: path.y * (end === 1 ? 1 : -1) },
  };
}

/** Every arrowhead on the page. */
export function handlesOn(where: { objects: SketchObject[]; settled: Settled }): Handle[] {
  const { objects, settled } = where;
  return objects.flatMap((object) => {
    if (!isLocus(object)) return [];
    const shape = settled.loci.get(object.id);
    const domain = objects.find((candidate) => candidate.id === object.domain);
    if (!shape || !domain || !isLine(domain) || domain.form === "segment") return [];
    const ends: (0 | 1)[] = domain.form === "ray" ? [1] : [0, 1];
    return ends.flatMap((end) => {
      const handle = handleFor(object, shape, end, where);
      return handle ? [handle] : [];
    });
  });
}

/** The ring at a snap: around the dot it found, or a fixed one on a path. */
export function snapRadius(
  found: Snap,
  where: Pick<Figure, "scale"> & { ends: Map<string, SketchPoint> },
): number {
  const point = found.kind === "point" ? where.ends.get(found.ids[0]) : undefined;
  return (point ? radiusOf(point) + 5.5 : SNAP_RING) / where.scale;
}
