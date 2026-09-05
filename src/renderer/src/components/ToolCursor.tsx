import type { Position } from "../sketch/model";
import {
  ANCHOR,
  BADGE,
  BADGE_COLOUR,
  BADGE_TRANSFORM,
  CURSOR_BOX,
  GLYPH,
  GLYPH_COLOUR,
  GLYPH_TRANSFORM,
  HOTSPOT,
  type Mark,
  OUTLINE_COLOUR,
  OUTLINE_WIDEN,
  RULER_SPIN,
  SHIFT,
} from "./cursorGeometry";
import "./ToolCursor.css";

/** Whether a tool has a cursor of its own drawn for it. */
export function cursorDrawnFor(tool: string): boolean {
  return tool in GLYPH;
}

interface ToolCursorProps {
  /** The tool in hand, and for the Arrow what it is armed with. */
  tool: string;
  arrowKind?: string;
  /**
   * Where the pointer is, in screen pixels from the sheet's top left. Screen
   * pixels rather than the sheet's own, so the cursor keeps its size at every
   * zoom, the way a label does. Null with the pointer off the sheet.
   */
  at: Position | null;
}

/** One mark of a cursor: where it sits, and what it is drawn in. */
interface Drawn {
  mark: Mark;
  transform: string;
  ink: string;
}

/** One mark, drawn once: the outline pass widens and recolours the same path. */
function drawn({ mark, transform, ink }: Drawn, widen: number, key: number) {
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
 * The cursor for the tool in hand, drawn on the sheet rather than handed to the
 * browser as an image.
 *
 * A cursor image cannot blend with what is under it, so it cannot promise to be
 * visible on white paper, on black paper and on a red figure at once. The
 * outline pass is differenced against the sheet, so it is never the colour
 * beneath it; the glyph rides over it unblended, so the tool's hue is its true
 * hue rather than an inverted one. That is what two layers buy, and it is why
 * this is mounted on the sheet with `cursor: none` over it.
 *
 * A tool with no glyph draws nothing and keeps whatever the stylesheet gives
 * it: the hand keeps the platform's grab, and the Text tool over something that
 * can be named keeps its pointer.
 */
export function ToolCursor({ tool, arrowKind, at }: ToolCursorProps) {
  const glyph = GLYPH[tool];
  if (!at || !glyph) return null;

  const badgeKey = tool === "arrow" ? `arrow.${arrowKind}` : "";
  // Measure takes its Length variant's ruler rather than the tool's own icon,
  // the ruler-and-protractor having too much in it to read at cursor size.
  const spin = tool === "measure" ? ` ${RULER_SPIN}` : "";
  const marks: Drawn[] = [
    ...ANCHOR.map((mark) => ({ mark: mark as Mark, transform: SHIFT, ink: GLYPH_COLOUR[tool] })),
    ...glyph.map((mark) => ({
      mark,
      transform: `${SHIFT} ${GLYPH_TRANSFORM}${spin}`,
      ink: GLYPH_COLOUR[tool],
    })),
    ...(BADGE[badgeKey] ?? []).map((mark) => ({
      mark,
      transform: `${SHIFT} ${BADGE_TRANSFORM}`,
      ink: BADGE_COLOUR[badgeKey] ?? GLYPH_COLOUR[tool],
    })),
  ];

  const box = {
    left: `${at.x - HOTSPOT.x}px`,
    top: `${at.y - HOTSPOT.y}px`,
    width: `${CURSOR_BOX}px`,
    height: `${CURSOR_BOX}px`,
  };
  const viewBox = `0 0 ${CURSOR_BOX} ${CURSOR_BOX}`;

  return (
    <>
      <svg className="tool-cursor tool-cursor--outline" style={box} viewBox={viewBox} aria-hidden>
        {marks.map((one, nth) => drawn({ ...one, ink: OUTLINE_COLOUR }, OUTLINE_WIDEN, nth))}
      </svg>
      <svg className="tool-cursor" style={box} viewBox={viewBox} aria-hidden>
        {marks.map((one, nth) => drawn(one, 0, nth))}
      </svg>
    </>
  );
}
