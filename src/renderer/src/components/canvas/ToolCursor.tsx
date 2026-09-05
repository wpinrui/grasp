import type { Ref } from "react";
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
   * The box both layers ride in. It is moved to the pointer directly rather
   * than through a render, so a pointer moving over the sheet costs nothing.
   */
  box: Ref<HTMLDivElement>;
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
    ...(badge?.marks ?? []).map((mark) => ({
      mark,
      transform: `${SHIFT} ${BADGE_TRANSFORM}`,
      ink: badge?.ink ?? glyph.ink,
    })),
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
export function ToolCursor({ tool, arrowKind, box, showing }: ToolCursorProps) {
  const glyph = CURSORS[tool];
  if (!glyph) return null;

  // The prefix is the rule: no other tool has a badge to find.
  const marks = marksOf(glyph, BADGES[`${tool}.${arrowKind}`]);
  const size = { width: `${CURSOR_BOX}px`, height: `${CURSOR_BOX}px` };
  const viewBox = `0 0 ${CURSOR_BOX} ${CURSOR_BOX}`;

  return (
    <div
      ref={box}
      className={`tool-cursor${showing ? "" : " tool-cursor--away"}`}
      style={size}
      aria-hidden
    >
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the box around both layers is aria-hidden; a cursor is not content and has nothing to announce */}
      <svg className="tool-cursor__layer tool-cursor__layer--outline" viewBox={viewBox}>
        {marks.map((one, nth) => markOf({ ...one, ink: OUTLINE_COLOUR }, OUTLINE_WIDEN, nth))}
      </svg>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: as above */}
      <svg className="tool-cursor__layer" viewBox={viewBox}>
        {marks.map((one, nth) => markOf(one, 0, nth))}
      </svg>
    </div>
  );
}
