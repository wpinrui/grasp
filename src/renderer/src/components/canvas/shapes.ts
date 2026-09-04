/**
 * The path strings the sheet is drawn with: an arc, the fill cut out of one,
 * and the arrowhead a locus is dragged by.
 *
 * All of them are worked out from geometry that has already settled, so nothing
 * here reads the sheet, and the same shape comes out of the same numbers.
 */

import { type ArcGeometry, spotOnPath } from "../../sketch/model";
import { ARROW_SIZE, type Handle } from "./sheet";

/** An arc as a path: the straight case is a line, the rest is an SVG arc. */
export function arcPath(arc: ArcGeometry): string {
  if (arc.flat) {
    return `M ${arc.flat[0].x} ${arc.flat[0].y} L ${arc.flat[1].x} ${arc.flat[1].y}`;
  }
  const start = spotOnPath(arc, 0);
  const end = spotOnPath(arc, 1);
  const large = Math.abs(arc.sweep) > Math.PI ? 1 : 0;
  // A sweep the positive way is clockwise on screen, which is what SVG calls
  // its sweep flag.
  const way = arc.sweep > 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 ${large} ${way} ${end.x} ${end.y}`;
}

/** An arc's fill: out to its centre, or cut off by its chord. */
export function wedgePath(arc: ArcGeometry, wedge: "sector" | "segment"): string {
  const shape = arcPath(arc);
  return wedge === "sector" ? `${shape} L ${arc.at.x} ${arc.at.y} Z` : `${shape} Z`;
}

/** The arrowhead on the end of a locus, which keeps its size on screen. */
export function arrowPoints(handle: Handle, scale: number): string {
  const size = ARROW_SIZE / scale;
  const back = {
    x: handle.at.x - handle.way.x * size,
    y: handle.at.y - handle.way.y * size,
  };
  const side = { x: -handle.way.y * size * 0.42, y: handle.way.x * size * 0.42 };
  return [
    `${handle.at.x},${handle.at.y}`,
    `${back.x + side.x},${back.y + side.y}`,
    `${back.x - side.x},${back.y - side.y}`,
  ].join(" ");
}
