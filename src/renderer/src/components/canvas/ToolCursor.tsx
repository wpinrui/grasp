import type { RefCallback } from "react";
import {
  ANCHOR,
  BADGE_TRANSFORM,
  BADGES,
  CURSOR_BOX,
  CURSORS,
  type Cursor,
  GLYPH_TRANSFORM,
  type Mark,
  OUTLINE_COLOUR,
  OUTLINE_WIDEN,
  SHIFT,
} from "./cursorGeometry";
import "./ToolCursor.css";

interface ToolCursorProps {
  /** The tool in hand, and for the Arrow what it is armed with. */
  tool: string;
  arrowKind?: string;
  /**
   * Takes each layer as it mounts. They are moved to the pointer directly
   * rather than through a render, so a pointer moving over the sheet costs
   * nothing.
   */
  hold: RefCallback<SVGSVGElement>;
  /** Whether the pointer is on the sheet. Off it, the cursor waits out of sight. */
  showing: boolean;
}

/** One mark of a cursor: where it sits, and what it is drawn in. */
interface Drawn {
  mark: Mark;
  transform: string;
  ink: string;
}

/** One mark, drawn once. The outline pass widens and recolours the same shape. */
function markOf({ mark, transform, ink }: Drawn, widen: number, key: number) {
  if ("ch" in mark) {
    return (
      <text
        key={key}
        x={mark.x}
        y={mark.y}
        transform={transform}
        textAnchor="middle"
        fontFamily="var(--font-label)"
        fontWeight="700"
        fontSize={mark.size}
        fill={ink}
        stroke={widen ? ink : "none"}
        strokeWidth={widen}
      >
        {mark.ch}
      </text>
    );
  }
  if ("r" in mark) {
    return (
      <circle
        key={key}
        cx={mark.cx}
        cy={mark.cy}
        r={mark.r}
        transform={transform}
        fill={mark.w ? "none" : ink}
        stroke={mark.w || widen ? ink : "none"}
        strokeWidth={(mark.w ?? 0) + widen}
      />
    );
  }
  return (
    <path
      key={key}
      d={mark.d}
      transform={transform}
      fill={mark.fill ? ink : "none"}
      stroke={ink}
      strokeWidth={mark.w + widen}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Every mark of a cursor, the crosshair first and the badge last. */
function marksOf(glyph: Cursor, badge: Cursor | undefined): Drawn[] {
  const turn = glyph.turn ? ` ${glyph.turn}` : "";
  return [
    ...ANCHOR.map((mark) => ({ mark, transform: SHIFT, ink: glyph.ink })),
    ...glyph.marks.map((mark) => ({
      mark,
      transform: `${SHIFT} ${GLYPH_TRANSFORM}${turn}`,
      ink: glyph.ink,
    })),
    ...(badge
      ? badge.marks.map((mark) => ({
          mark,
          transform: `${SHIFT} ${BADGE_TRANSFORM}`,
          ink: badge.ink,
        }))
      : []),
  ];
}

/**
 * The cursor for the tool in hand, drawn on the sheet rather than handed to the
 * browser as an image.
 *
 * A cursor image cannot blend with what is under it, so it cannot promise to be
 * visible on white paper, on black paper and on a red figure at once. The
 * outline pass is differenced against the sheet, so it is never the colour
 * beneath it; the glyph rides over it unblended, so the tool's hue is its true
 * hue rather than an inverted one. That is what two layers buy, and it is why
 * this is mounted on the sheet with `cursor: none` over it.
 */
export function ToolCursor({ tool, arrowKind, hold, showing }: ToolCursorProps) {
  const glyph = CURSORS[tool];
  if (!glyph) return null;

  // The prefix is the rule: no other tool has a badge to find.
  const marks = marksOf(glyph, BADGES[`${tool}.${arrowKind}`]);
  const layer = `tool-cursor${showing ? "" : " tool-cursor--away"}`;
  const shared = {
    ref: hold,
    width: CURSOR_BOX,
    height: CURSOR_BOX,
    viewBox: `0 0 ${CURSOR_BOX} ${CURSOR_BOX}`,
    "aria-hidden": true,
  } as const;

  return (
    <>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: a cursor is not content; it is aria-hidden and has nothing to announce */}
      <svg className={`${layer} tool-cursor--outline`} {...shared}>
        {marks.map((one, nth) => markOf({ ...one, ink: OUTLINE_COLOUR }, OUTLINE_WIDEN, nth))}
      </svg>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: as above */}
      <svg className={layer} {...shared}>
        {marks.map((one, nth) => markOf(one, 0, nth))}
      </svg>
    </>
  );
}
