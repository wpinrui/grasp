/**
 * Where GRASP's own cursor is, and whether there is one to draw.
 *
 * The position is written straight to the layers rather than held in state: a
 * pointer crossing the sheet fires a move every few milliseconds, and the sheet
 * guards every other thing it tracks against re-rendering on each one. Only
 * whether the cursor is on the sheet at all is state, and that changes twice a
 * visit.
 */

import {
  type PointerEvent,
  type RefCallback,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { HOST_MOVED } from "../../../../shared/embed";
import type { Position } from "../../sketch/model";
import { cursorDrawnFor, HOTSPOT } from "./cursorGeometry";

/** What the sheet answers when asked what is under a point in the window. */
type Reader = (event: { clientX: number; clientY: number }) => Position | null;

/** What the cursor is following, all of it written rather than rendered. */
interface Following {
  /** The layers, wherever they are drawn, however many the cursor takes. */
  layers: SVGSVGElement[];
  /**
   * Where in the window the pointer last was, which is where the layers go.
   * Kept whatever the tool in hand, so that letting go of the space bar after a
   * pan does not bring the cursor back where the pan began.
   */
  inWindow: { clientX: number; clientY: number } | null;
}

/** What a cursor follows before the pointer has been anywhere. */
function nothingYet(): Following {
  return { layers: [], inWindow: null };
}

/**
 * Put the layers where the pointer is. Runs on every move, so it does no work.
 *
 * In window coordinates, because the layers are drawn into the body rather than
 * into the sheet, so that nothing clips them.
 */
function place(one: Following) {
  const at = one.inWindow;
  if (!at) return;
  const put = `translate(${at.clientX - HOTSPOT.x}px, ${at.clientY - HOTSPOT.y}px)`;
  for (const layer of one.layers) layer.style.transform = put;
}

/**
 * The frame GRASP is in moving out from under a pointer that has not moved.
 *
 * Inside one document there is nothing to do: the layers are placed where the
 * pointer is in the window, so panning the view or resizing the window does not
 * move them, and where the sheet stops being under the pointer the browser
 * fires the boundary event the sheet already listens for. A frame is the
 * exception. Scrolled in a page, it moves and nothing inside it hears, and the
 * pointer's own place in the window is stale with it, so there is nothing left
 * to ask with. The page says so instead, and the cursor is put away until the
 * pointer moves. Bound only while there is a cursor to strand.
 */
function useHostMoved(drawn: boolean, away: () => void) {
  useEffect(() => {
    if (!drawn) return;
    const moved = (event: MessageEvent) => {
      if (event.data === HOST_MOVED) away();
    };
    window.addEventListener("message", moved);
    return () => window.removeEventListener("message", moved);
  }, [drawn, away]);
}

export function useToolCursor(tool: string, screenOf: Reader) {
  /** Whether the pointer is on paper GRASP would draw a cursor over. */
  const [onPaper, setOnPaper] = useState(false);
  const hasCursor = cursorDrawnFor(tool);

  const following = useRef<Following>(nothingYet());

  const away = useCallback(() => setOnPaper(false), []);

  // A tool that had no cursor a moment ago has one now, so its layers are new
  // and have yet to be put anywhere. Before the paint, so they are never seen
  // at the sheet's corner on the way.
  useLayoutEffect(() => place(following.current));
  useHostMoved(hasCursor && onPaper, away);

  /**
   * Takes each layer as it mounts and lets it go as it unmounts, so `place`
   * writes to what is on the sheet and to nothing else. It never changes, or
   * React would let every layer go and take it again on each render.
   */
  const hold = useCallback<RefCallback<SVGSVGElement>>((element) => {
    if (!element) return;
    following.current.layers.push(element);
    return () => {
      following.current.layers = following.current.layers.filter((one) => one !== element);
    };
  }, []);

  return {
    hold,
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
      following.current.inWindow = { clientX: event.clientX, clientY: event.clientY };
      place(following.current);
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
