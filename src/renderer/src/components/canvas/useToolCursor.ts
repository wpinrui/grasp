/**
 * Where GRASP's own cursor is, and whether there is one to draw.
 *
 * Kept out of the sheet because none of it is about the sheet: it is one
 * position in screen pixels and one question about the tool in hand. The sheet
 * only has to say when the pointer moved and when it left.
 */

import { type PointerEvent, useState } from "react";
import type { Position } from "../../sketch/model";
import { cursorDrawnFor } from "../ToolCursor";

export function useToolCursor(
  cursor: string,
  screenOf: (event: { clientX: number; clientY: number }) => Position | null,
) {
  /** In screen pixels from the sheet's top left, so it keeps its size at every zoom. */
  const [at, setAt] = useState<Position | null>(null);
  const drawn = cursorDrawnFor(cursor);

  return {
    /** Where to draw it, or null where there is nothing to draw. */
    at: drawn ? at : null,
    /** Whether the sheet should give up its own cursor to this one. */
    drawing: drawn && at !== null,
    /**
     * The pointer moved. A finger is not a pointer with a cursor, so it moves
     * nothing, and neither does a tool GRASP draws no cursor for.
     */
    follow(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== "touch" && drawn) setAt(screenOf(event));
    },
    /** The pointer left the sheet, and the cursor goes with it. */
    away() {
      setAt(null);
    },
  };
}
