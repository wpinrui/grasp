/** The box and the stroke every tool icon is drawn in, and the arrow they share. */

export const ARROW_PATH = "M5 2.5 L15.5 11.2 L10.6 11.8 L13.3 16.8 L11.2 17.8 L8.6 12.8 L5 16 Z";

/** The magnet snapping is marked with, on the panel and on the touch bar. */
export const MAGNET_PATH = "M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5";
export const MAGNET_PRONGS = ["M5.4 3.4 L5.4 6.2", "M14.6 3.4 L14.6 6.2"];

/**
 * A single stroked mark on the same box the tools are drawn on, for the chrome
 * icons that are one path and nothing else.
 */
export function MarkSvg({ d, size = "1em" }: { d: string; size?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function ToolSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * What a tool's outline is stroked at. Named because the cursor for each tool
 * is the same drawing at another size and has to match: see
 * `canvas/cursorGeometry.ts`.
 */
export const TOOL_STROKE = 1.6;

/**
 * Every cursor is the arrow, drawn in the tool's own ink, with that tool's
 * glyph beside it. The arrow is what a pointer looks like everywhere else, and
 * the glyph is what says which tool it is holding.
 *
 * Everything is drawn inset by `PAD`, because a glyph may sit above or left of
 * the arrow and the box has no room outside itself: a shape placed at a
 * negative coordinate is simply not drawn.
 */
export const PAD = 10;

/** The arrow itself, at its own size, and the tip the click lands on. */
export const ARROW_FROM = PAD + 3;
export const ARROW_POINT = { x: 5, y: 2.5 };
export const ARROW_AT = `translate(${ARROW_FROM} ${ARROW_FROM}) scale(1)`;

/**
 * Where each tool's glyph sits beside the arrow, placed by hand: the icons are
 * padded differently and drawn at different weights, so no single rule puts
 * them all where they belong. A turn is about the glyph's own middle, so it
 * spins in place rather than swinging away.
 */
export const GLYPH_AT: Record<string, string> = {
  point: `translate(${PAD + 9.08} ${PAD - 2.75}) scale(0.715)`,
  compass: `translate(${PAD + 11.88} ${PAD - 4.2}) scale(0.7)`,
  straightedge: `translate(${PAD + 14.54} ${PAD + 10.96}) scale(0.755) rotate(-23 10 10)`,
  polygon: `translate(${PAD + 13.79} ${PAD - 5.47}) scale(0.79)`,
  text: `translate(${PAD + 11.8} ${PAD - 1.82}) scale(0.59)`,
  // Flat. The ruler icon is drawn turned in the toolbox, and the 45 it was
  // placed with was undoing that rather than adding to it.
  measure: `translate(${PAD + 12.45} ${PAD - 4.09}) scale(0.705)`,
  marker: `translate(${PAD + 16.38} ${PAD + 11.89}) scale(0.75) rotate(-15 9.9 10.1)`,
};

/**
 * The same drawing, fitted into an icon's own 20-unit box, so a flyout key and
 * the cursor it stands for are one drawing rather than two that have to be
 * kept in step by hand. One fit for every arming, so the keys are a row of the
 * same size rather than each fitted to its own glyph.
 */
/**
 * How much of the icon's box the fit takes, and where it starts. The content
 * runs from the arrow's left edge to the far side of the widest glyph, and
 * from the highest glyph down, so it is measured off `PAD` rather than written
 * out: moving the inset moves the keys with the cursors.
 */
const FIT = 0.657;
export const ARMING_FIT = `translate(${(1 - 18 * FIT).toFixed(2)} ${(1 - (PAD - 0.4) * FIT).toFixed(2)}) scale(${FIT})`;

export const STRAIGHT = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
} as const;
