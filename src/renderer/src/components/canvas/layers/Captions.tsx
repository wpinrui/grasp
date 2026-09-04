/**
 * The small captions a dialog puts beside the points it is holding, and the box
 * a caption is being dragged out to before there is one.
 *
 * Both ride above the sheet as HTML, so they keep their size at any zoom, and
 * both are gone the moment the thing they are about is.
 */

import type { Position, Rect, View } from "../../../sketch/model";

/** Where the page sits on screen, which is what places anything above it. */
function onScreen(at: Position, view: View, scale: number) {
  return { left: `${(at.x - view.x) * scale}px`, top: `${(at.y - view.y) * scale}px` };
}

interface MarkCaptionsProps {
  /** The ids a dialog has taken, each with the caption drawn by it. */
  marks: { id: string; label: string }[];
  /** Where a mark's caption sits, or nothing where the thing is not there. */
  spotOf: (id: string) => Position | null;
  view: View;
  scale: number;
}

export function MarkCaptions({ marks, spotOf, view, scale }: MarkCaptionsProps) {
  return (
    <>
      {marks.map((mark) => {
        const at = spotOf(mark.id);
        if (!at) return null;
        return (
          <span key={mark.id} className="canvas__caption" style={onScreen(at, view, scale)}>
            {mark.label}
          </span>
        );
      })}
    </>
  );
}

interface BoxingProps {
  /** The box being dragged out, or nothing while none is. */
  boxing: Rect | null;
  view: View;
  scale: number;
}

export function Boxing({ boxing, view, scale }: BoxingProps) {
  if (!boxing) return null;
  return (
    <div
      className="caption-box"
      style={{
        ...onScreen(boxing, view, scale),
        width: `${boxing.width * scale}px`,
        height: `${boxing.height * scale}px`,
      }}
    />
  );
}
