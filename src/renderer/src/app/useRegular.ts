/**
 * The regular polygon in hand: the click that asked for one, and the drawing of
 * it once the box has said what shape.
 *
 * It belongs to the window rather than to the page, the way a relabel run does.
 * What lands on the page is worked out by `withRegular`, which knows nothing
 * about boxes or clicks, so what is built can be checked without either.
 */

import { useState } from "react";
import type { PointSize, Position } from "../sketch/model";
import { withRegular } from "../sketch/regular";
import type { Sketch } from "../sketch/useSketch";

/** A click asking for a regular polygon: where on the sheet, and where to ask. */
export interface RegularAsked {
  spot: Position;
  at: { x: number; y: number };
}

interface RegularContext {
  sketch: Sketch;
  /** How big a point comes out, which the corners are laid down at. */
  pointSize: PointSize;
}

export function useRegular({ sketch, pointSize }: RegularContext) {
  const [asked, setAsked] = useState<RegularAsked | null>(null);

  return {
    asked,

    /**
     * The sheet was clicked. A second click while the box is still up is left
     * alone: the box stands beside the spot it is about, and moving where the
     * shape would land without moving the box says nothing about either.
     */
    ask: (wanted: RegularAsked) => {
      if (!asked) setAsked(wanted);
    },

    drop: () => setAsked(null),

    /** The box was answered, so the shape lands where the click was. */
    draw: ({ sides, locked }: { sides: number; locked: boolean }) => {
      if (!asked) return;
      setAsked(null);
      sketch.commit(withRegular(sketch.read(), { at: asked.spot, sides, size: pointSize, locked }));
    },
  };
}

/** A regular polygon waiting to be drawn, as the window holds it. */
export type Regular = ReturnType<typeof useRegular>;
