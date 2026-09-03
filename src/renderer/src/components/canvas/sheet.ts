/**
 * The numbers and shapes the sheet is drawn by: how far a press may wander
 * before it is a drag, how far the zoom goes, what a snap is, and the handful
 * of pure functions that go with them.
 *
 * Nothing here reads the component. Everything takes what it works on, so each
 * one can be read, and changed, without holding the whole canvas in mind.
 */

import {
  distance,
  type Position,
  type Rect,
  type SketchMark,
  type SketchMeasurement,
} from "../../sketch/model";

/** Pointer travel on screen, in pixels, that turns a click into a drag. */
export const DRAG_THRESHOLD = 3;

/** How many fingers on the sheet mean panning rather than drawing. */
export const PAN_FINGERS = 2;

/** The room left between one angle mark at a corner and the next one out. */
export const ANGLE_ROOM = 9;

/**
 * How far out of a corner a press has to get before it is pointing at one of
 * the angles there. Short of this it is a press on the corner and nothing more,
 * and the corner is asked about rather than one of its angles guessed at from a
 * direction that was never aimed: three pixels, which is what tells a drag from
 * a click everywhere else, cannot pick out one wedge from five.
 */
export const ANGLE_AIM = 16;

/**
 * What tells a press that meant to draw the whole object in one go from a click
 * that happened to wander. Drawing in one go is a press, a pull and a release,
 * which takes both a moment and some distance; a click is quick and goes
 * nowhere much, however much the hand shakes on the button. Both have to be
 * passed, so a click that drifts a few pixels leaves the object half drawn for
 * a second click to finish, which is what was meant by it.
 */
export const DRAW_HOLD = 250;
export const DRAW_REACH = 10;

/** What the Measure tool writes: the reading, and the mark it had to make. */
export interface Written {
  reading: SketchMeasurement;
  /** The angle mark an angle had to be given before it could be read. */
  mark: SketchMark | null;
}

/**
 * Whether two of those would write the same thing in the same place. A reading
 * is minted fresh every time one is worked out, so its id says nothing; what
 * makes it the same reading is what it measures, which way round, and where it
 * lands. Compared so that holding the pointer still leaves the ghost alone
 * rather than replacing it on every move.
 */
export function sameReading(one: Written | null, other: Written | null): boolean {
  if (!one || !other) return one === other;
  const a = one.reading;
  const b = other.reading;
  return (
    a.measure === b.measure &&
    a.of.length === b.of.length &&
    a.of.every((id, nth) => id === b.of[nth]) &&
    (a.reflex === true) === (b.reflex === true) &&
    a.x === b.x &&
    a.y === b.y &&
    (one.mark === null) === (other.mark === null)
  );
}

/** The arrowheads on a dimension, and the room left round the number in one. */
export const ARROW_HEAD = 9;
export const ARROW_WING = 3;
export const BREAK_GAP = 5;
/** How far a dotted line runs past the arrow it leads to. */
export const LEADER_PAST = 4;

/**
 * Whether a reading has anything to be set: a length is drawn out as a
 * dimension, an angle is read one way round or the other, an area is neither.
 */
/**
 * Every reading has a panel: how far it is written out is on all of them, and a
 * length and an angle carry more besides.
 */
export function hasPanel(_reading: SketchMeasurement): boolean {
  return true;
}

/** How far a reading lands clear of what it was taken off, in screen pixels. */
export const READING_OFF = 18;
/** An angle needs less: it is already standing off the corner by its arcs. */
export const ANGLE_READING_OFF = 6;
/** The size a reading is written at: 12 point, which is 16 pixels. */
export const READING_POINTS = 12;
/**
 * About how big the number comes out, in screen pixels, so it can be placed
 * clear of the figure before it has been drawn and measured. A digit in Times
 * at 16px is about half its size across, and the line it sits on is about a
 * third again as tall.
 */
export const READING_CHAR = 8;
export const READING_HEIGHT = 25;

/** How far out a guide's arc is drawn, and how far past it the number sits. */
export const GUIDE_RADIUS = 26;
export const GUIDE_OFF = 26;
/** How far a length stands off the line it measures. */
export const GUIDE_LIFT = 15;

/** One thing a guide writes on the sheet, and which way round it is written. */
export interface GuideText {
  at: Position;
  /** Degrees: a length lies along its own line, everything else is level. */
  turn: number;
  /** How far off its spot it is drawn, in screen pixels down the page. */
  dy: number;
  text: string;
}

/** One angle a half-drawn figure makes: the arc drawn in it, and its size. */
export interface GuideAngle {
  arc: string;
  text: GuideText;
}

/** Where a drag has come from and got to, which is what it says about itself. */
export interface Travel {
  from: Position;
  to: Position;
}

/** What a half-drawn object says about itself while it is being placed. */
export interface Guide {
  length: GuideText;
  corners: GuideAngle[];
  area?: GuideText;
  /**
   * A run drawn faintly so a length has a line to sit on: how far a drag has
   * gone, or the radius of a circle being drawn out. Either way it is there to
   * be read rather than to be part of the figure.
   */
  travel?: Travel;
  /**
   * Where the horizontal an angle is being read off runs from, when it is being
   * read off the horizontal rather than off something that is drawn already.
   * The line itself is faint: it is a datum, not part of the figure.
   */
  datum?: Position;
}

/** How far the zoom goes, as screen pixels per sheet pixel. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

/**
 * Where minus and plus land. The wheel is free to leave the zoom on any number
 * it likes, so the buttons step to round ones instead of
 * multiplying from wherever they were left, and 100% is never out of reach.
 */
export const ZOOM_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/** Clear of the stop it is sitting on, so a press always moves. */
export const STOP_SLACK = 1.001;

export function stopAbove(scale: number): number {
  return ZOOM_STOPS.find((stop) => stop > scale * STOP_SLACK) ?? MAX_SCALE;
}

export function stopBelow(scale: number): number {
  return ZOOM_STOPS.filter((stop) => stop * STOP_SLACK < scale).pop() ?? MIN_SCALE;
}

/**
 * Zoom per unit of wheel travel, so a notch of a mouse wheel is about a sixth
 * of a step and a trackpad glides.
 */
export const WHEEL_ZOOM = 0.0015;

/** How near a crossing counts as being on it, in screen pixels. */
export const CROSS_REACH = 9;

/** The ring drawn where a click would land on a straight object. */
export const SNAP_RING = 8;

/** How wide a caption comes out when it was asked for rather than dragged. */
export const CAPTION_WIDTH = 220;

/** The least a caption can be dragged out to, in screen pixels. */
export const MIN_CAPTION_WIDTH = 48;

/** The angles Shift holds a new object to, as a fraction of a turn. */
export const SHIFT_STEP = Math.PI / 12;

/**
 * What a click with a plotting tool would land on: a point already there, the
 * crossing of two straight objects, or one straight object the new point would
 * belong to. `at` is where the point would go, which is not the pointer: on a
 * straight object it is the nearest spot on it.
 */
export type Snap =
  | { kind: "point"; ids: [string]; at: Position }
  | { kind: "line"; ids: [string]; at: Position }
  | { kind: "cross"; ids: [string, string]; pick: number; at: Position };

/** The direction from one spot to another, held to the nearest 15 degrees. */
export function stepped(from: Position, to: Position): Position {
  const reach = distance(from, to);
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / SHIFT_STEP) * SHIFT_STEP;
  return { x: from.x + Math.cos(angle) * reach, y: from.y + Math.sin(angle) * reach };
}

/** Enough of a snap to tell whether it has changed since the last move. */
export function snapKey(snap: Snap | null): string {
  return snap ? `${snap.kind}:${snap.ids.join(",")}:${snap.at.x},${snap.at.y}` : "";
}

/** The arrowhead on the open end of a locus: how big it draws, and how near
 * the pointer has to be to take hold of it, both in screen pixels. */
export const ARROW_SIZE = 10;
export const ARROW_GRAB = 11;

/** The least of its domain a locus can be pulled back to. */
export const LEAST_SPAN = 0.05;

/** One end of a locus that can be dragged, and which way it points. */
export interface Handle {
  locus: string;
  end: 0 | 1;
  at: Position;
  /** The way the arrowhead points, at length one. */
  way: Position;
  /** Domain travelled per sheet pixel dragged along that way. */
  step: number;
}

/** Whether two rectangles overlap at all. Touching counts. */
export function overlaps(one: Rect, other: Rect): boolean {
  return (
    one.x <= other.x + other.width &&
    other.x <= one.x + one.width &&
    one.y <= other.y + other.height &&
    other.y <= one.y + one.height
  );
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
