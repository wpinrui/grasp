/**
 * The cursors GRASP draws for itself: the arrow every one of them is, in the
 * tool's own ink, with that tool's glyph beside it.
 *
 * Every glyph is the tool's own icon, read from `components/icons` rather than
 * copied, so a cursor and its key in the rail cannot come apart. Where each one
 * sits beside the arrow is read from there too, since the flyout keys are drawn
 * from the same placings.
 *
 * Measure is the one that is not the tool's own icon: it takes its Length
 * variant's ruler, the ruler-and-protractor having too much in it to read at
 * cursor size.
 *
 * What the Arrow is armed to pick up is said with the whole cursor of the tool
 * that makes that kind of thing, rather than with a motif of its own.
 */

import { ARROW_FROM, ARROW_POINT, GLYPH_AT, STRAIGHT, TOOL_STROKE } from "../icons/frame";

import {
  COMPASS_HUB,
  COMPASS_RING,
  MARKER_BODY,
  MARKER_NIB,
  POINT_DOT,
  RULER_BODY,
  RULER_TICKS,
  STRAIGHTEDGE_ENDS,
  STRAIGHTEDGE_RULE,
  TEXT_T,
  TRAPEZIUM,
} from "../icons/tools";

/** A stroked or filled path, on the icons' own 20-unit box. */
export interface Stroke {
  d: string;
  /** Stroke width, before a layer widens it. Zero where the path is only filled. */
  w: number;
  fill?: boolean;
}

/** A circle, which several icons are drawn with rather than a path. */
export interface Dot {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Stroked at this width, or filled where it is left off. */
  w?: number;
}

/** A letter set the way GRASP sets a label, rather than a shape. */
export interface Letter {
  readonly ch: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export type Mark = Stroke | Dot | Letter;

/** The stroke width the ruler is drawn at, read from the icon rather than repeated. */
const RULER_STROKE = Number(STRAIGHT.strokeWidth);

/** The box a cursor is drawn on. */
export const CURSOR_BOX = 46;

/** One cursor: what its glyph is drawn from, in what ink, and where it sits. */
export interface Cursor {
  marks: Mark[];
  /** The custom property it is drawn in. */
  ink: string;
  /**
   * Where the glyph sits beside the arrow. The Arrow itself has none: it is
   * the arrow, and what it is armed with is said by its badge.
   */
  at?: string;
}

/** One per tool. A tool absent from here keeps whatever cursor the sheet gives it. */
export const CURSORS: Record<string, Cursor> = {
  arrow: {
    marks: [],
    ink: "var(--color-tool-arrow)",
  },
  point: {
    marks: [POINT_DOT],
    ink: "var(--color-tool-point)",
    at: GLYPH_AT.point,
  },
  compass: {
    marks: [{ ...COMPASS_RING, w: TOOL_STROKE }, COMPASS_HUB],
    ink: "var(--color-tool-compass)",
    at: GLYPH_AT.compass,
  },
  straightedge: {
    marks: [{ d: STRAIGHTEDGE_RULE, w: TOOL_STROKE }, ...STRAIGHTEDGE_ENDS],
    ink: "var(--color-tool-straightedge)",
    at: GLYPH_AT.straightedge,
  },
  polygon: {
    marks: [{ d: TRAPEZIUM, w: TOOL_STROKE }],
    ink: "var(--color-tool-polygon)",
    at: GLYPH_AT.polygon,
  },
  text: {
    marks: [TEXT_T],
    ink: "var(--color-tool-text)",
    at: GLYPH_AT.text,
  },
  measure: {
    marks: [
      { d: RULER_BODY, w: RULER_STROKE },
      ...RULER_TICKS.map((tick) => ({ d: tick, w: RULER_STROKE })),
    ],
    ink: "var(--color-tool-measure)",
    at: GLYPH_AT.measure,
  },
  marker: {
    marks: [
      { d: MARKER_BODY, w: TOOL_STROKE },
      { d: MARKER_NIB, w: TOOL_STROKE },
    ],
    ink: "var(--color-tool-marker)",
    at: GLYPH_AT.marker,
  },
};

/**
 * What the Arrow is armed to pick up, said with the cursor of the tool that
 * makes that kind of thing: the same glyph, in the same ink, in the same place
 * beside the arrow. Only the arrow itself stays the Arrow's own blue, since it
 * is the Arrow that is in hand.
 *
 * There is none for the plain Arrow, which picks up anything and so has
 * nothing to say. Only the Arrow is armed at all: its arming changes what a
 * click can touch and nothing on the sheet says so, where a drawing tool's
 * variant only changes what the click makes.
 */
export const BADGES: Record<string, Cursor> = {
  "arrow.points": CURSORS.point as Cursor,
  "arrow.paths": CURSORS.straightedge as Cursor,
  "arrow.marks": CURSORS.marker as Cursor,
  "arrow.text": CURSORS.text as Cursor,
};

/**
 * The counter-outline: what it is drawn in, and how much wider than the glyph
 * it runs. It is differenced against the sheet, so the colour has to be the one
 * whose difference is a true inverse.
 */
export const OUTLINE_COLOUR = "var(--color-cursor-outline)";
export const OUTLINE_WIDEN = 3;

/**
 * Whether GRASP draws this tool's cursor itself. A tool with none keeps what
 * the stylesheet gives it: the hand keeps the platform's grab, and the Text
 * tool over something that can be named keeps its pointer.
 */
export function cursorDrawnFor(tool: string): boolean {
  // Its own key, not an inherited one: `"toString" in CURSORS` is true, and
  // what it answers with is a function rather than a cursor.
  return Object.hasOwn(CURSORS, tool);
}

/** Where in the box the click lands. */
export interface Hotspot {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the click lands: the tip of the arrow, which every cursor is drawn
 * from, so it does not move as the tool in hand changes.
 */
export const HOTSPOT: Hotspot = {
  x: ARROW_FROM + ARROW_POINT.x,
  y: ARROW_FROM + ARROW_POINT.y,
};
