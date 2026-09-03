/**
 * The arithmetic of moving the sheet under two fingers.
 *
 * Kept apart from the canvas because it is worth being sure of on its own: a
 * pan that follows one finger rather than both lurches whenever the two move
 * differently, and a pan measured in the wrong space drifts further the further
 * in the sheet is zoomed.
 */

import type { Position } from "./geometry";

/** Where a pan began: the fingers' centre then, and the view then. */
export interface PanFrom {
  view: Position;
  clientX: number;
  clientY: number;
}

/**
 * The point the fingers are around. Following this rather than any one of them
 * is what keeps the sheet still when only one finger moves: two fingers, one
 * moving, carries the sheet half as far as that finger went, and the other
 * finger's own travel counts for exactly as much.
 */
export function centreOf(places: Position[]): Position {
  if (places.length === 0) return { x: 0, y: 0 };
  const total = places.reduce((sum, at) => ({ x: sum.x + at.x, y: sum.y + at.y }), { x: 0, y: 0 });
  return { x: total.x / places.length, y: total.y / places.length };
}

/**
 * Where the view lands when the fingers have carried their centre to `at`.
 *
 * The travel is in screen pixels and the view is in sheet units, so it is
 * divided by the scale: a sheet at twice its size moves half as far under the
 * same finger. The sheet goes the way the fingers go, so the view goes the
 * other way.
 */
export function pannedView(from: PanFrom, at: Position, scale: number): Position {
  return {
    x: from.view.x - (at.x - from.clientX) / scale,
    y: from.view.y - (at.y - from.clientY) / scale,
  };
}

/** How far, in screen pixels, a pan has carried the sheet since it began. */
export function panTravel(from: PanFrom, at: Position): number {
  return Math.abs(at.x - from.clientX) + Math.abs(at.y - from.clientY);
}
