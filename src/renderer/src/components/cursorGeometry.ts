/**
 * The tool cursors, as geometry. One entry per tool, plus one badge per Arrow
 * arming, all drawn on the same 46-unit box with the hotspot at 14 14.
 *
 * Everything here is traced from the toolbox icons in
 * src/renderer/src/components/icons/tools.tsx, so a cursor and its key in the
 * rail are the same drawing. Measure is the one exception: it takes its Length
 * variant's ruler, turned 45 degrees anticlockwise, because the
 * ruler-and-protractor icon has too much in it to read at cursor size.
 */

export interface Stroke {
  /** Path data, on the icons' own 20-unit box. */
  d: string;
  /** Stroke width, before a layer widens it. */
  w: number;
  /** Filled as well as stroked. */
  fill?: boolean;
}

/** A letter set the way GRASP sets a label, rather than a path. */
export interface Letter {
  ch: string;
  x: number;
  y: number;
  size: number;
}

export type Mark = Stroke | Letter;

/** The box, and where in it the click lands. */
export const CURSOR_BOX = 46;
export const HOTSPOT = { x: 14, y: 14 } as const;

/**
 * The three transforms, in the order they are applied. The shift is what keeps
 * the widest halo on the end of a crosshair arm inside the box.
 */
export const SHIFT = "translate(3 3)";
export const GLYPH_TRANSFORM = "translate(16 14) scale(0.85)";
export const BADGE_TRANSFORM = "translate(30.4 30.4) scale(0.45)";
/** Measure only. */
export const RULER_SPIN = "rotate(-45 10 10)";

/**
 * The stroke widths the marks are traced at, on the icons' own 20-unit box.
 * The glyphs are the toolbox icons' own width; the crosshair is finer, so it
 * points without competing with the glyph; the ruler is between the two,
 * having more lines in a smaller space than any other glyph.
 */
const GLYPH_STROKE = 1.6;
const ANCHOR_STROKE = 1.2;
const RULER_STROKE = 1.5;

/** The anchor: a gapped crosshair, its arms stopping short of the hotspot. */
export const ANCHOR: Stroke[] = [
  { d: "M11 1 L11 7", w: ANCHOR_STROKE },
  { d: "M11 15 L11 21", w: ANCHOR_STROKE },
  { d: "M1 11 L7 11", w: ANCHOR_STROKE },
  { d: "M15 11 L21 11", w: ANCHOR_STROKE },
];

/** One glyph per tool. */
export const GLYPH: Record<string, Mark[]> = {
  arrow: [
    { d: "M5 2.5 L15.5 11.2 L10.6 11.8 L13.3 16.8 L11.2 17.8 L8.6 12.8 L5 16 Z", w: 0, fill: true },
  ],
  point: [{ d: "M 6.6 10 a 3.4 3.4 0 1 0 6.8 0 a 3.4 3.4 0 1 0 -6.8 0", w: 0, fill: true }],
  compass: [
    { d: "M 3 10 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0", w: GLYPH_STROKE },
    { d: "M 8.3 10 a 1.7 1.7 0 1 0 3.4 0 a 1.7 1.7 0 1 0 -3.4 0", w: 0, fill: true },
  ],
  straightedge: [
    { d: "M3.9 16.1 L16.1 3.9", w: GLYPH_STROKE },
    { d: "M 2 16.1 a 1.9 1.9 0 1 0 3.8 0 a 1.9 1.9 0 1 0 -3.8 0", w: 0, fill: true },
    {
      d: "M 14.200000000000001 3.9 a 1.9 1.9 0 1 0 3.8 0 a 1.9 1.9 0 1 0 -3.8 0",
      w: 0,
      fill: true,
    },
  ],
  polygon: [{ d: "M6.4 5.2 L13.6 5.2 L17.2 15.6 L2.8 15.6 Z", w: GLYPH_STROKE }],
  text: [{ ch: "T", x: 10, y: 16.4, size: 18 }],
  measure: [
    { d: "M2.4 7 L17.6 7 L17.6 13 L2.4 13 Z", w: RULER_STROKE },
    { d: "M5.4 7 L5.4 10", w: RULER_STROKE },
    { d: "M8.2 7 L8.2 9", w: RULER_STROKE },
    { d: "M11 7 L11 10", w: RULER_STROKE },
    { d: "M13.8 7 L13.8 9", w: RULER_STROKE },
  ],
  marker: [
    { d: "M13.4 3.2 L16.8 6.6 L7.4 16 L3 17 L4 12.6 Z", w: GLYPH_STROKE },
    { d: "M11.6 5 L15 8.4", w: GLYPH_STROKE },
  ],
};

/**
 * One badge per Arrow arming, at the glyph's corner. Only the Arrow gets one:
 * its arming changes what a click can touch and nothing on the sheet says so,
 * where a drawing tool's variant only changes what the click makes.
 */
export const BADGE: Record<string, Mark[]> = {
  "arrow.points": [
    { d: "M 5.6 10 a 4.4 4.4 0 1 0 8.8 0 a 4.4 4.4 0 1 0 -8.8 0", w: 0, fill: true },
  ],
  "arrow.paths": [{ d: "M2.5 15 A 12.5 12.5 0 0 1 15 2.5", w: 2.6 }],
  "arrow.marks": [
    { d: "M2.5 17.5 L17.5 2.5", w: 2.4 },
    { d: "M6.5 9.5 L11.5 14.5", w: 2.4 },
  ],
  "arrow.text": [{ ch: "T", x: 10, y: 16.5, size: 20 }],
};

/** The custom property each glyph and each badge is drawn in. */
export const GLYPH_COLOUR: Record<string, string> = {
  arrow: "var(--color-tool-arrow)",
  point: "var(--color-tool-point)",
  compass: "var(--color-tool-compass)",
  straightedge: "var(--color-tool-straightedge)",
  polygon: "var(--color-tool-polygon)",
  text: "var(--color-tool-text)",
  measure: "var(--color-tool-measure)",
  marker: "var(--color-tool-marker)",
};

export const BADGE_COLOUR: Record<string, string> = {
  "arrow.points": "var(--color-tool-point)",
  "arrow.paths": "var(--color-tool-compass)",
  "arrow.marks": "var(--color-tool-marker)",
  "arrow.text": "var(--color-arrow-text)",
};

/**
 * The counter-outline: the colour it is drawn in, and how much wider than the
 * glyph it runs. It is differenced against the sheet, so the colour has to be
 * the one whose difference is a true inverse.
 */
export const OUTLINE_COLOUR = "var(--color-cursor-outline)";
export const OUTLINE_WIDEN = 3;
