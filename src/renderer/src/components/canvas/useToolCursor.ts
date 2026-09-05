/**
 * Where GRASP's own cursor is, and whether there is one to draw.
 *
 * The position is written straight to the element rather than held in state: a
 * pointer crossing the sheet fires a move every few milliseconds, and the sheet
 * guards every other thing it tracks against re-rendering on each one. Only
 * whether the cursor is on the sheet at all is state, and that changes twice a
 * visit.
 */

import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import type { Position } from "../../sketch/model";
import { cursorDrawnFor, HOTSPOT } from "./cursorGeometry";

export function useToolCursor(
  tool: string,
  screenOf: (event: { clientX: number; clientY: number }) => Position | null,
) {
  const box = useRef<HTMLDivElement>(null);
  /**
   * Where the pointer last was. Kept whatever the tool in hand, so that letting
   * go of the space bar after a pan does not bring the cursor back where the
   * pan began.
   */
  const spot = useRef<Position | null>(null);
  /** Whether the pointer is on paper GRASP would draw a cursor over. */
  const [onPaper, setOnPaper] = useState(false);
  const hasCursor = cursorDrawnFor(tool);

  /** Put the box where the pointer is. Runs on every move, so it does no work. */
  function place() {
    const element = box.current;
    const at = spot.current;
    if (!element || !at) return;
    element.style.transform = `translate(${at.x - HOTSPOT.x}px, ${at.y - HOTSPOT.y}px)`;
  }

  // A tool that had no cursor a moment ago has one now, so the box is new and
  // has yet to be put anywhere. Before the paint, so it is never seen at the
  // sheet's corner on the way.
  useLayoutEffect(place);

  return {
    /** The box both layers ride in, moved by `follow` below. */
    box,
    /**
     * Whether the cursor is drawn, which is also when the sheet gives up its
     * own. A tool with none keeps the stylesheet's, and so does a pointer that
     * has not reached the sheet yet.
     */
    showing: hasCursor && onPaper,
    /**
     * The pointer moved. A finger is not a pointer with a cursor, so it draws
     * none.
     *
     * Neither does anything but bare paper. The figure is drawn in a layer that
     * takes no pointer events, so the only thing on the sheet the pointer can
     * be over is the sheet itself; everything else with a box there, a caption,
     * a reading, a label, a panel, carries a cursor of its own saying what it
     * is for, and two cursors at once says less than either.
     */
    follow(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType === "touch") return;
      const at = screenOf(event);
      if (event.target !== event.currentTarget || !at) {
        setOnPaper(false);
        return;
      }
      // Kept even where this tool draws nothing, so the next one that does
      // starts where the pointer actually is.
      spot.current = at;
      place();
      if (!onPaper) setOnPaper(true);
    },
    /** The pointer left the sheet, and the cursor goes with it. */
    away(event?: PointerEvent<HTMLDivElement>) {
      // A finger lifting off a hybrid screen is not the mouse leaving.
      if (event?.pointerType === "touch") return;
      setOnPaper(false);
    },
  };
}
