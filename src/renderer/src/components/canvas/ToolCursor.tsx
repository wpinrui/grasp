import type { RefCallback } from "react";
import { createPortal } from "react-dom";
import { ARROW_PATH } from "../icons/frame";
import {
  ARROW_AT,
  BADGES,
  CURSOR_BOX,
  CURSORS,
  type Cursor,
  type Mark,
  OUTLINE_COLOUR,
  OUTLINE_WIDEN,
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

/**
 * How much a transform shrinks what it draws, so the outline can be widened to
 * suit. A stroke inside a scaled transform is scaled with everything else, so
 * a glyph drawn at 0.6 would take six tenths of a halo and all but lose it.
 */
function scaleOf(transform: string): number {
  return Number(/scale\(([\d.]+)/.exec(transform)?.[1] ?? 1) || 1;
}

/**
 * Every mark of a cursor: the arrow, then the tool's glyph beside it, then the
 * badge. The arrow is drawn for every tool, in that tool's own ink, because an
 * arrow is what a pointer looks like; the glyph is what says which tool it is.
 */
function marksOf(glyph: Cursor, badge: Cursor | undefined): Drawn[] {
  const at = glyph.at ?? ARROW_AT;
  return [
    { mark: { d: ARROW_PATH, w: 0, fill: true }, transform: ARROW_AT, ink: glyph.ink },
    ...glyph.marks.map((mark) => ({ mark, transform: at, ink: glyph.ink })),
    // An arming is drawn as that tool's own cursor: same glyph, same ink, same
    // place beside the arrow, which is what makes the two read as one family.
    ...(badge
      ? badge.marks.map((mark) => ({ mark, transform: badge.at ?? at, ink: badge.ink }))
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
 * the sheet takes `cursor: none` while one is up.
 *
 * It is drawn into the body rather than into the sheet. The sheet clips what it
 * holds, and a glyph sits beside the arrow rather than under it, so near an edge
 * the sheet would cut the glyph off while the arrow stayed whole. Nothing clips
 * the platform's own cursor, and nothing may clip this one. The body is also
 * where the difference blend still has the sheet in its backdrop, which is what
 * the outline is for.
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

  return createPortal(
    <>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: a cursor is not content; it is aria-hidden and has nothing to announce */}
      <svg className={`${layer} tool-cursor--outline`} {...shared}>
        {marks.map((one, nth) =>
          markOf({ ...one, ink: OUTLINE_COLOUR }, OUTLINE_WIDEN / scaleOf(one.transform), nth),
        )}
      </svg>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: as above */}
      <svg className={layer} {...shared}>
        {marks.map((one, nth) => markOf(one, 0, nth))}
      </svg>
    </>,
    document.body,
  );
}
