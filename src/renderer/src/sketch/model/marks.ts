import { nextId } from "./create";
import type { SketchPoint } from "./figures";
import {
  degreesOf,
  distance,
  isArcPath,
  isRound,
  type PathGeometry,
  type Position,
  pathIn,
  QUARTER_TURN,
  type Settled,
  slackAt,
  TURN,
} from "./geometry";
import { isMark } from "./guards";
import { alongPath, spotOnPath } from "./paths";
import type { SketchMark, SketchObject } from "./values";

/**
 * How big a mark is drawn, in screen pixels, so it stays the same size at every
 * zoom the way a point does.
 */
const TICK_HALF = 7.5;

const TICK_GAP = 5;

const ARROW_HALF = 6.9;

const ARROW_DEPTH = 6.25;

const ARROW_GAP = 6.25;

export const ANGLE_RADIUS = 20;

const ANGLE_GAP = 4.5;

/** The arcs never close right up on the corner, however hard they are dragged. */
export const LEAST_ANGLE_RADIUS = 8;

/** How near the pointer has to come to a mark to catch it. */
const MARK_REACH = 9;

/** The room left between two marks sharing a spot on a path. */
const GROUP_GAP = 5;

/**
 * Where a mark is drawn: a tick sits at a spot on its path and lies along it,
 * an angle mark turns about its corner from one arm to the other.
 */
export type MarkShape =
  | { form: "equal" | "parallel"; at: Position; way: Position; strokes: number }
  | {
      form: "angle";
      at: Position;
      from: number;
      sweep: number;
      strokes: number;
      /** How far out the innermost arc runs, in screen pixels. */
      radius: number;
      /** Drawn as the square a right angle is customarily drawn with. */
      square: boolean;
    };

/**
 * A right angle is ninety and nothing else. The slack is there for the floating
 * point arithmetic the angle came out of, not to round a hand-drawn corner up.
 */
const RIGHT_SLACK = 1e-6;

/** Whether a turn is a right angle, which is what draws as the square. */
export function isRightAngle(sweep: number): boolean {
  return Math.abs(Math.abs(degreesOf(sweep)) - QUARTER_TURN) <= RIGHT_SLACK;
}

/**
 * The turn from one arm to the other: the short way round for the angle itself,
 * and the long way for the reflex angle on the other side of it.
 */
export function markSweep(from: number, to: number, reflex: boolean): number {
  const short = turnBetweenAngles(from, to);
  if (!reflex) return short;
  return short > 0 ? short - TURN : short + TURN;
}

/** A vector cut down to length one, or pointing along x when it has none. */
function unitOf(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
}

/** Which way a path is running at a given point along it. */
export function tangentOnPath(path: PathGeometry, at: number): Position {
  if (isArcPath(path)) {
    if (path.flat) return unitOf(path.flat[1].x - path.flat[0].x, path.flat[1].y - path.flat[0].y);
    const angle = path.from + path.sweep * at;
    const way = path.sweep < 0 ? -1 : 1;
    return { x: -Math.sin(angle) * way, y: Math.cos(angle) * way };
  }
  if (isRound(path)) {
    const angle = path.ref + at * TURN;
    return { x: -Math.sin(angle), y: Math.cos(angle) };
  }
  return unitOf(path.b.x - path.a.x, path.b.y - path.a.y);
}

/** The turn from one angle to another, taken the short way round. */
function turnBetweenAngles(from: number, to: number): number {
  return ((((to - from) % TURN) + TURN + Math.PI) % TURN) - Math.PI;
}

/**
 * How far along the path a mark reaches, in screen pixels: the strokes it holds
 * and the gaps between them.
 */
function markWidth(mark: SketchMark): number {
  if (!("path" in mark)) return 0;
  const gap = mark.form === "equal" ? TICK_GAP : ARROW_GAP;
  const own = mark.form === "equal" ? 2 : ARROW_DEPTH;
  return (mark.strokes - 1) * gap + own;
}

/**
 * The marks sharing a spot on a path, in the order they were made. Two marks
 * put at the same point are one group: they are laid out side by side and the
 * pair sits centred on that point, so a side can say equal and parallel at once
 * without one being drawn over the other.
 */
function groupOf(mark: SketchMark, objects: SketchObject[]): SketchMark[] {
  if (!("path" in mark)) return [mark];
  const group = objects.filter(
    (other): other is SketchMark =>
      isMark(other) && "path" in other && other.path === mark.path && other.at === mark.at,
  );
  // Bars go on the fat side of an arrowhead, never the pointy one, so a side
  // that says equal and parallel at once reads the way it is drawn by hand.
  const arrow = group.find((other) => other.form === "parallel");
  if (!arrow) return group;
  const tailFirst = "flipped" in arrow ? arrow.flipped !== true : true;
  return [...group].sort((one, other) => {
    if (one.form === other.form) return 0;
    const bars = one.form === "equal" ? -1 : 1;
    return tailFirst ? bars : -bars;
  });
}

/** Where a mark lands once the figure it marks has settled. */
/** The settled page a mark is shaped against, and the zoom it is drawn at. */
export interface MarkedOn {
  settled: Settled;
  objects?: SketchObject[];
  scale?: number;
}

export function markShape(mark: SketchMark, on: MarkedOn): MarkShape | null {
  const { settled, objects = [], scale = 1 } = on;
  if ("path" in mark) {
    const path = pathIn(settled, mark.path);
    if (!path) return null;
    const way = tangentOnPath(path, mark.at);
    const spot = spotOnPath(path, mark.at);
    // Where it sits in its group, measured from the group's left hand end.
    const group = groupOf(mark, objects);
    const widths = group.map(markWidth);
    const whole = widths.reduce((sum, width) => sum + width, 0) + (group.length - 1) * GROUP_GAP;
    const before = widths
      .slice(
        0,
        Math.max(
          0,
          group.findIndex((other) => other.id === mark.id),
        ),
      )
      .reduce((sum, width) => sum + width + GROUP_GAP, 0);
    const off = (before + markWidth(mark) / 2 - whole / 2) / scale;
    return {
      form: mark.form,
      at: { x: spot.x + way.x * off, y: spot.y + way.y * off },
      way: mark.flipped ? { x: -way.x, y: -way.y } : way,
      strokes: mark.strokes,
    };
  }
  const corner = settled.points.get(mark.corner);
  const arms = mark.arms.map((id) => settled.points.get(id));
  if (!corner || arms.some((arm) => arm === undefined)) return null;
  const [one, other] = arms as SketchPoint[];
  const from = Math.atan2(one.y - corner.y, one.x - corner.x);
  const to = Math.atan2(other.y - corner.y, other.x - corner.x);
  const sweep = markSweep(from, to, mark.reflex === true);
  return {
    form: "angle",
    at: { x: corner.x, y: corner.y },
    from,
    sweep,
    strokes: mark.strokes,
    radius: mark.radius ?? ANGLE_RADIUS,
    square: mark.square ?? isRightAngle(sweep),
  };
}

/** 0, 1, ... n - 1. */
function runOf(count: number): number[] {
  return Array.from({ length: count }, (_, nth) => nth);
}

/**
 * The strokes a mark is drawn with, each an SVG path in sheet coordinates:
 * bars across the path, arrowheads along it, or arcs about the corner.
 */
export function markStrokes(shape: MarkShape, scale: number): string[] {
  const spot = (at: Position) => `${at.x} ${at.y}`;
  if (shape.form === "angle") {
    const way = shape.sweep < 0 ? 0 : 1;
    // A reflex angle goes round the long way, so its arcs are the big ones.
    const large = Math.abs(shape.sweep) > Math.PI ? 1 : 0;
    // The square a right angle is drawn with: out along one arm, across the
    // corner of the wedge, and back down the other. Off a right angle it comes
    // out as the kite the same three points make, which is what a marker forced
    // to the square on a wider angle should look like.
    if (shape.square) {
      return runOf(shape.strokes).map((nth) => {
        const radius = (shape.radius + nth * ANGLE_GAP) / scale;
        const middle = shape.from + shape.sweep / 2;
        const out = (angle: number, reach: number) => ({
          x: shape.at.x + Math.cos(angle) * reach,
          y: shape.at.y + Math.sin(angle) * reach,
        });
        const one = out(shape.from, radius);
        const other = out(shape.from + shape.sweep, radius);
        const far = out(middle, radius * Math.SQRT2);
        return `M ${spot(one)} L ${spot(far)} L ${spot(other)}`;
      });
    }
    return runOf(shape.strokes).map((nth) => {
      const radius = (shape.radius + nth * ANGLE_GAP) / scale;
      const start = {
        x: shape.at.x + Math.cos(shape.from) * radius,
        y: shape.at.y + Math.sin(shape.from) * radius,
      };
      const end = {
        x: shape.at.x + Math.cos(shape.from + shape.sweep) * radius,
        y: shape.at.y + Math.sin(shape.from + shape.sweep) * radius,
      };
      return `M ${spot(start)} A ${radius} ${radius} 0 ${large} ${way} ${spot(end)}`;
    });
  }
  const way = shape.way;
  const across = { x: -way.y, y: way.x };
  const gap = (shape.form === "equal" ? TICK_GAP : ARROW_GAP) / scale;
  const half = (shape.form === "equal" ? TICK_HALF : ARROW_HALF) / scale;
  const depth = ARROW_DEPTH / scale;
  return runOf(shape.strokes).map((nth) => {
    const off = (nth - (shape.strokes - 1) / 2) * gap;
    const centre = { x: shape.at.x + way.x * off, y: shape.at.y + way.y * off };
    if (shape.form === "equal") {
      const one = { x: centre.x - across.x * half, y: centre.y - across.y * half };
      const other = { x: centre.x + across.x * half, y: centre.y + across.y * half };
      return `M ${spot(one)} L ${spot(other)}`;
    }
    // An arrowhead points the way the path runs, so a pair of parallel sides
    // reads as going the same way rather than as two loose chevrons.
    const tip = { x: centre.x + way.x * (depth / 2), y: centre.y + way.y * (depth / 2) };
    const back = { x: tip.x - way.x * depth, y: tip.y - way.y * depth };
    const one = { x: back.x + across.x * half, y: back.y + across.y * half };
    const other = { x: back.x - across.x * half, y: back.y - across.y * half };
    return `M ${spot(one)} L ${spot(tip)} L ${spot(other)}`;
  });
}

/** How far out an angle mark's outermost arc runs, in screen pixels. */
export function markReach(mark: SketchMark): number {
  if ("path" in mark) return 0;
  return (mark.radius ?? ANGLE_RADIUS) + (mark.strokes - 1) * ANGLE_GAP;
}

/** Whether a spot catches a mark, which is how the Marker tool picks one up. */
export function nearMark(mark: SketchMark, at: Position, on: MarkedOn): boolean {
  const { scale = 1 } = on;
  const shape = markShape(mark, on);
  if (!shape) return false;
  if (shape.form !== "angle") {
    const spread = ((shape.strokes - 1) / 2) * (TICK_GAP / scale);
    return distance(shape.at, at) <= MARK_REACH / scale + spread;
  }
  // The mark is the arcs, not the wedge they are drawn across. The band they
  // run in is one thing to click, so no single arc has to be hit on its own,
  // but the middle of the wedge and the corner it turns about belong to the
  // figure underneath: a mark that caught its whole sector would swallow every
  // press on the point it turns about, and a corner wearing a few marks could
  // not be pressed at all.
  const spread = (shape.strokes - 1) * ANGLE_GAP;
  // The square a right angle wears runs out to the far corner of its wedge.
  const far = shape.square ? shape.radius * Math.SQRT2 : shape.radius;
  const out = distance(shape.at, at);
  if (out < (shape.radius - MARK_REACH) / scale) return false;
  if (out > (far + spread + MARK_REACH) / scale) return false;
  const turn = turnBetweenAngles(shape.from, Math.atan2(at.y - shape.at.y, at.x - shape.at.x));
  return shape.sweep < 0 ? turn <= 0 && turn >= shape.sweep : turn >= 0 && turn <= shape.sweep;
}

/** What a tick is: which path it rides, where along it, and how it is drawn. */
export interface TickWanted {
  form: "equal" | "parallel";
  path: string;
  /** The fraction of the way along the path it sits. */
  at: number;
  strokes: number;
  flipped: boolean;
}

/** A tick riding a path, put down a given fraction of the way along it. */
export function createTick(wanted: TickWanted): SketchMark {
  return { id: nextId("mark"), kind: "mark", ...wanted };
}

/** What an angle mark is: the corner, its two arms, and how it is drawn. */
export interface AngleMarkWanted {
  corner: string;
  arms: [string, string];
  /** The two straight objects the arms run along. */
  sides: [string, string];
  strokes: number;
  /** Whether it marks the angle the long way round. */
  reflex: boolean;
  /** How far the arcs stand from the corner, in sheet units. */
  radius: number;
}

/** A mark on one of the angles the sides make where they meet. */
export function createAngleMark(wanted: AngleMarkWanted): SketchMark {
  return {
    id: nextId("mark"),
    kind: "mark",
    form: "angle",
    ...wanted,
  };
}

/**
 * Where along a segment a mark should land: the midpoint when the click comes
 * near it, since that is where a tick belongs, and otherwise where the click
 * landed. No midpoint is constructed; the mark simply rides the middle.
 */
export function markAlong(path: PathGeometry, at: Position, scale: number): number {
  const along = alongPath(path, at);
  if (isRound(path) || isArcPath(path) || path.form !== "segment") return along;
  const middle = spotOnPath(path, 0.5);
  return distance(middle, at) <= slackAt(scale) * 2 ? 0.5 : along;
}
