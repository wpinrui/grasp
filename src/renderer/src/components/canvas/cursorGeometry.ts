/**
 * The cursors GRASP draws for itself: one per tool, plus a badge for each of
 * the Arrow's armings, all on the same 46-unit box with the hotspot at the
 * crosshair's centre.
 *
 * Every glyph is the tool's own icon, read from `components/icons/tools.tsx`
 * (and `icons/frame.tsx` for the Arrow, which the chrome shares) rather than
 * copied, so a cursor and its key in the rail cannot come apart.
 * Measure is the one that is not the tool's own icon: it takes its Length
 * variant's ruler, turned 45 degrees, the ruler-and-protractor having too much
 * in it to read at 20 units across.
 *
 * The badges are not traces. Each is its arming's motif redrawn at badge size,
 * where the icon's own proportions would be a smudge.
 */

import { ARROW_PATH, STRAIGHT, TOOL_STROKE } from "../icons/frame";
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

/**
 * The stroke widths the marks are drawn at. The glyphs keep their icon's own,
 * read from the icons rather than repeated here; only the crosshair is chosen
 * here, drawn finer so that it points without competing with the glyph.
 */
const RULER_STROKE = Number(STRAIGHT.strokeWidth);
const ANCHOR_STROKE = 1.2;

/** The box a cursor is drawn on. */
export const CURSOR_BOX = 46;

/**
 * How far in from the corner everything sits. It is what keeps the widest halo
 * on the end of a crosshair arm, half of `ANCHOR_STROKE` plus the outline's
 * widening, inside the box.
 */
const SHIFT_BY = 3;
export const SHIFT = `translate(${SHIFT_BY} ${SHIFT_BY})`;

/** Where the crosshair's arms point, on the icons' box. */
const ANCHOR_CENTRE = 11;

/** Where in the box the click lands: the crosshair's centre, once shifted. */
export const HOTSPOT = { x: ANCHOR_CENTRE + SHIFT_BY, y: ANCHOR_CENTRE + SHIFT_BY } as const;

export const GLYPH_TRANSFORM = "translate(16 14) scale(0.85)";

/**
 * The Arrow is drawn at cursor size from near the corner of the box, since it
 * is the one glyph that is already a cursor: an arrow beside a crosshair says
 * the same thing twice, and the crosshair is the louder of the two.
 *
 * Its point is the first point of `ARROW_PATH`, so the tip of the drawn arrow
 * is where the click lands, the way an arrow cursor has always worked.
 */
const ARROW_SCALE = 1.3;
const ARROW_FROM = 4;
const ARROW_POINT = { x: 5, y: 2.5 };
export const ARROW_AT = `translate(${ARROW_FROM} ${ARROW_FROM}) scale(${ARROW_SCALE})`;
export const ARROW_TIP: Hotspot = {
  x: ARROW_FROM + ARROW_POINT.x * ARROW_SCALE,
  y: ARROW_FROM + ARROW_POINT.y * ARROW_SCALE,
};
export const BADGE_TRANSFORM = "translate(30.4 30.4) scale(0.45)";

/** The anchor: a gapped crosshair, its arms stopping short of the hotspot. */
export const ANCHOR: Stroke[] = [
  { d: "M11 1 L11 7", w: ANCHOR_STROKE },
  { d: "M11 15 L11 21", w: ANCHOR_STROKE },
  { d: "M1 11 L7 11", w: ANCHOR_STROKE },
  { d: "M15 11 L21 11", w: ANCHOR_STROKE },
];

/** Where in the box the click lands. */
export interface Hotspot {
  readonly x: number;
  readonly y: number;
}

/** One cursor: what it is drawn from, in what ink, and any turn of its own. */
export interface Cursor {
  marks: Mark[];
  /** The custom property it is drawn in. */
  ink: string;
  /** Applied after the glyph transform. Measure's ruler is the only one. */
  turn?: string;
  /**
   * For a glyph that points with its own outline: where it sits, and where its
   * point is. A cursor with this is drawn without the crosshair, the crosshair
   * being what points for the ones without.
   */
  points?: { transform: string; hotspot: Hotspot };
}

/** One per tool. A tool absent from here keeps whatever cursor the sheet gives it. */
export const CURSORS: Record<string, Cursor> = {
  arrow: {
    marks: [{ d: ARROW_PATH, w: 0, fill: true }],
    ink: "var(--color-tool-arrow)",
    points: { transform: ARROW_AT, hotspot: ARROW_TIP },
  },
  point: {
    marks: [POINT_DOT],
    ink: "var(--color-tool-point)",
  },
  compass: {
    marks: [{ ...COMPASS_RING, w: TOOL_STROKE }, COMPASS_HUB],
    ink: "var(--color-tool-compass)",
  },
  straightedge: {
    marks: [{ d: STRAIGHTEDGE_RULE, w: TOOL_STROKE }, ...STRAIGHTEDGE_ENDS],
    ink: "var(--color-tool-straightedge)",
  },
  polygon: {
    marks: [{ d: TRAPEZIUM, w: TOOL_STROKE }],
    ink: "var(--color-tool-polygon)",
  },
  text: {
    marks: [TEXT_T],
    ink: "var(--color-tool-text)",
  },
  measure: {
    marks: [
      { d: RULER_BODY, w: RULER_STROKE },
      ...RULER_TICKS.map((tick) => ({ d: tick, w: RULER_STROKE })),
    ],
    ink: "var(--color-tool-measure)",
    turn: "rotate(-45 10 10)",
  },
  marker: {
    marks: [
      { d: MARKER_BODY, w: TOOL_STROKE },
      { d: MARKER_NIB, w: TOOL_STROKE },
    ],
    ink: "var(--color-tool-marker)",
  },
};

/**
 * One badge per Arrow arming but the plain one, which picks up anything and so
 * has nothing to say. Only the Arrow is badged at all: its arming changes what
 * a click can touch and nothing on the sheet says so, where a drawing tool's
 * variant only changes what the click makes.
 */
export const BADGES: Record<string, Cursor> = {
  "arrow.points": {
    marks: [{ cx: 10, cy: 10, r: 4.4 }],
    ink: "var(--color-tool-point)",
  },
  "arrow.paths": {
    marks: [{ d: "M2.5 15 A 12.5 12.5 0 0 1 15 2.5", w: 2.6 }],
    ink: "var(--color-tool-compass)",
  },
  "arrow.marks": {
    marks: [
      { d: "M2.5 17.5 L17.5 2.5", w: 2.4 },
      { d: "M6.5 9.5 L11.5 14.5", w: 2.4 },
    ],
    ink: "var(--color-tool-marker)",
  },
  "arrow.text": {
    marks: [{ ch: "T", x: 10, y: 16.5, size: 20 }],
    ink: "var(--color-arrow-text)",
  },
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

/** Where a tool's click lands: its own point, or the crosshair's centre. */
export function hotspotFor(tool: string): Hotspot {
  return CURSORS[tool]?.points?.hotspot ?? HOTSPOT;
}
