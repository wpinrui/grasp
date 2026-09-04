/**
 * How a length is drawn out as a dimension: the run between its ends with an
 * arrowhead at each, and the dotted lines back to the segment where it carries
 * them.
 *
 * The number either stands clear above the run or breaks it, and the run sits
 * where the number has been dragged to, so the drawing follows the reading
 * rather than the other way about.
 */

import type { Position, Settled, SketchMeasurement } from "../../sketch/model";
import { ARROW_HEAD, ARROW_WING, BREAK_GAP, LEADER_PAST } from "./sheet";

/** Where the figure settled, and the zoom the dimension is drawn at. */
export interface Drawing {
  settled: Settled;
  scale: number;
}

/** One arrowhead, drawn as the filled triangle it is rather than two strokes. */
function arrowPath(tip: Position, back: Position, scale: number): string {
  const head = ARROW_HEAD / scale;
  const wing = ARROW_WING / scale;
  const spot = (at: Position) => `${at.x} ${at.y}`;
  const point = { x: back.x - tip.x, y: back.y - tip.y };
  const far = Math.hypot(point.x, point.y) || 1;
  const runs = { x: (point.x / far) * head, y: (point.y / far) * head };
  const side = { x: -runs.y / head, y: runs.x / head };
  return `M ${spot(tip)} L ${spot({ x: tip.x + runs.x + side.x * wing, y: tip.y + runs.y + side.y * wing })} L ${spot({ x: tip.x + runs.x - side.x * wing, y: tip.y + runs.y - side.y * wing })} Z`;
}

/** The runs, the arrowheads and the dotted lines, or nothing to draw out. */
export function dimensionOf(
  reading: SketchMeasurement,
  box: { width: number; height: number },
  drawing: Drawing,
): { lines: string[]; heads: string[]; dotted: string[] } | null {
  const { settled, scale } = drawing;
  if (reading.measure !== "length" || !reading.bounds) return null;
  const along = settled.lines.get(reading.of[0]);
  if (!along) return null;
  const way = { x: along.b.x - along.a.x, y: along.b.y - along.a.y };
  const length = Math.hypot(way.x, way.y);
  if (length === 0) return null;
  const u = { x: way.x / length, y: way.y / length };
  const across = { x: -u.y, y: u.x };
  // Where the middle of the number sits, and how far off the segment that is.
  const middle = { x: reading.x + box.width / 2 / scale, y: reading.y + box.height / 2 / scale };
  const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
  const number = (middle.x - mid.x) * across.x + (middle.y - mid.y) * across.y;
  // The arrows run where the number does, except in the full form, where the
  // number stands clear above them instead of being run through.
  const stand =
    reading.bounds === "full"
      ? (Math.abs(across.x) * box.width + Math.abs(across.y) * box.height) / 2 / scale +
        BREAK_GAP / scale
      : 0;
  const off = number - Math.sign(number || 1) * stand;
  const from = { x: along.a.x + across.x * off, y: along.a.y + across.y * off };
  const to = { x: along.b.x + across.x * off, y: along.b.y + across.y * off };
  const spot = (at: Position) => `${at.x} ${at.y}`;
  const heads = [arrowPath(from, to, scale), arrowPath(to, from, scale)];
  const lines: string[] = [];
  if (reading.bounds === "full") {
    lines.push(`M ${spot(from)} L ${spot(to)}`);
  } else {
    // Broken by the number: the runs stop either side of the room it takes
    // along the dimension, so nothing is drawn under it.
    const gap =
      (Math.abs(u.x) * box.width + Math.abs(u.y) * box.height) / 2 / scale + BREAK_GAP / scale;
    const at = (middle.x - along.a.x) * u.x + (middle.y - along.a.y) * u.y;
    const stop = { x: from.x + u.x * (at - gap), y: from.y + u.y * (at - gap) };
    const start = { x: from.x + u.x * (at + gap), y: from.y + u.y * (at + gap) };
    if (at - gap > 0) lines.push(`M ${spot(from)} L ${spot(stop)}`);
    if (at + gap < length) lines.push(`M ${spot(start)} L ${spot(to)}`);
  }
  // The dotted lines run a little past the arrows, the way a drawn dimension is,
  // so the end of the line is clear of the head.
  const past = {
    x: across.x * Math.sign(off || 1) * (LEADER_PAST / scale),
    y: across.y * Math.sign(off || 1) * (LEADER_PAST / scale),
  };
  const dotted = reading.leaders
    ? [
        `M ${spot(along.a)} L ${spot({ x: from.x + past.x, y: from.y + past.y })}`,
        `M ${spot(along.b)} L ${spot({ x: to.x + past.x, y: to.y + past.y })}`,
      ]
    : [];
  return { lines, heads, dotted };
}
