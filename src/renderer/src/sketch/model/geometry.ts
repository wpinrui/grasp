import type { Quantity } from "../expression";
import type { LineForm, SketchPoint } from "./figures";

/** Slack around an object that a click still counts as a hit. */
const PICK_SLACK = 5;

/** Far enough that a ray or a line always leaves any rectangle we clip to. */
export const FAR = 1e9;

/** How close two places count as the same, as a fraction of what is being measured. */
export const NEARLY = 1e-6;

/** Below this a direction is too short to tell which way it points. */
export const TINY = 1e-9;

export interface Position {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far, in sheet pixels, a click still counts as on an object. */
export function slackAt(scale: number): number {
  return PICK_SLACK / scale;
}

/** Where a line runs, and how far along it it actually exists. */
export interface LineGeometry {
  a: Position;
  b: Position;
  form: LineForm;
}

/**
 * The positions a locus was worked out to, one entry per sample: places for a
 * driven point, stretches for a driven straight object, corner lists for a
 * driven fill.
 */
export type LocusShape =
  | { kind: "points"; at: Position[] }
  | { kind: "lines"; at: LineGeometry[] }
  | { kind: "circles"; at: CircleGeometry[] }
  | { kind: "arcs"; at: ArcGeometry[] }
  | { kind: "shapes"; at: Position[][] };

/** Where a circle runs. `ref` is the way round it a point at 0 sits. */
export interface CircleGeometry {
  at: Position;
  radius: number;
  ref: number;
}

/**
 * Where an arc runs: round its circle from `from`, sweeping the given angle.
 * A negative sweep runs counter-clockwise on screen, where y counts downward.
 * `flat` is set instead when its three points went straight, and it is drawn
 * as the run between the two of them.
 */
export interface ArcGeometry {
  at: Position;
  radius: number;
  from: number;
  sweep: number;
  flat?: [Position, Position];
}

/** Something a point can be put on and slide along. */
export type PathGeometry = LineGeometry | CircleGeometry | ArcGeometry;

export function isRound(path: PathGeometry): path is CircleGeometry {
  return "ref" in path;
}

export function isArcPath(path: PathGeometry): path is ArcGeometry {
  return "sweep" in path;
}

/** Half a turn in degrees, which is what turns one measure of angle into the other. */
export const HALF_TURN = 180;

/** A quarter turn in degrees, which is the right angle a mark is drawn square for. */
export const QUARTER_TURN = 90;

/** An angle in degrees, as radians. */
export function radiansOf(degrees: number): number {
  return (degrees * Math.PI) / HALF_TURN;
}

/** An angle in radians, as degrees. */
export function degreesOf(radians: number): number {
  return (radians * HALF_TURN) / Math.PI;
}

/** A whole turn. */
export const TURN = Math.PI * 2;

/** Everything the page's geometry is worked out into, in one pass. */
export interface Settled {
  /**
   * What every number on the sheet comes to, in the sheet's own terms:
   * centimetres and degrees, whatever units are being written. A transform can
   * follow one, so they settle alongside the geometry rather than after it.
   */
  values: Map<string, Quantity | null>;
  points: Map<string, SketchPoint>;
  lines: Map<string, LineGeometry>;
  circles: Map<string, CircleGeometry>;
  arcs: Map<string, ArcGeometry>;
  /** Each interior's corners, in order, once they are all known. */
  shapes: Map<string, Position[]>;
  loci: Map<string, LocusShape>;
}

/** Where a path runs, whichever kind of path it is. */
export function pathIn(settled: Settled, id: string): PathGeometry | undefined {
  return settled.lines.get(id) ?? settled.circles.get(id) ?? settled.arcs.get(id);
}

/** How many positions a new locus draws, and how far + and - can push it. */
export const POINT_SAMPLES = 60;

export const SHAPE_SAMPLES = 20;

export const MIN_SAMPLES = 5;

export const MAX_SAMPLES = 200;

export const SAMPLE_STEP = 5;

/** Where a point on screen lands on the sheet. */
export function toSheet(
  bounds: DOMRect,
  pointer: { clientX: number; clientY: number },
  at: { view: Position; scale: number },
): Position {
  return {
    x: at.view.x + (pointer.clientX - bounds.left) / at.scale,
    y: at.view.y + (pointer.clientY - bounds.top) / at.scale,
  };
}

export function union(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The direction from a to b, at length one, or null when there is none. */
export function unit(a: Position, b: Position): Position | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length < TINY ? null : { x: dx / length, y: dy / length };
}

/** Whether a spot is inside a shape, by counting crossings to its left. */
export function insideShape(corners: Position[], at: Position): boolean {
  let inside = false;
  for (let index = 0, last = corners.length - 1; index < corners.length; last = index++) {
    const one = corners[index];
    const other = corners[last];
    const straddles = one.y > at.y !== other.y > at.y;
    if (!straddles) continue;
    const cut = one.x + ((at.y - one.y) / (other.y - one.y)) * (other.x - one.x);
    if (at.x < cut) inside = !inside;
  }
  return inside;
}

/** A shape's edges, as the segments its outline is made of. */
export function edgesOf(corners: Position[]): LineGeometry[] {
  return corners.map((corner, index) => ({
    a: corner,
    b: corners[(index + 1) % corners.length],
    form: "segment" as const,
  }));
}

/**
 * The stretch of a straight object that lies inside a rectangle, or null when
 * none of it does. A segment is cut at both ends, a ray only at the first and a
 * line at neither, which is the whole of what tells the three apart: this both
 * draws them and decides whether a marquee has caught one.
 */
export function clipToRect(line: LineGeometry, rect: Rect): [Position, Position] | null {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  if (dx === 0 && dy === 0) return null;
  let near = line.form === "line" ? -FAR : 0;
  let far = line.form === "segment" ? 1 : FAR;
  const edges: [number, number][] = [
    [-dx, line.a.x - rect.x],
    [dx, rect.x + rect.width - line.a.x],
    [-dy, line.a.y - rect.y],
    [dy, rect.y + rect.height - line.a.y],
  ];
  for (const [towards, room] of edges) {
    if (towards === 0) {
      // Parallel to this edge, so it is either wholly inside it or wholly out.
      if (room < 0) return null;
      continue;
    }
    const t = room / towards;
    if (towards < 0) near = Math.max(near, t);
    else far = Math.min(far, t);
    if (near > far) return null;
  }
  return [
    { x: line.a.x + dx * near, y: line.a.y + dy * near },
    { x: line.a.x + dx * far, y: line.a.y + dy * far },
  ];
}

/** How far a point sits from a straight object, respecting where it stops. */
export function distanceToLine(line: LineGeometry, at: Position): number {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return distance(line.a, at);
  let t = ((at.x - line.a.x) * dx + (at.y - line.a.y) * dy) / span;
  if (line.form !== "line" && t < 0) t = 0;
  if (line.form === "segment" && t > 1) t = 1;
  return distance({ x: line.a.x + dx * t, y: line.a.y + dy * t }, at);
}

/** Whether three points lie on one straight line, near enough to read a ratio along. */
export function inLine(a: Position, b: Position, c: Position): boolean {
  const across = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const span = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
  return span > 0 && Math.abs(across) <= span * NEARLY;
}
