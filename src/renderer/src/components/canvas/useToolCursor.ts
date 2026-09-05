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
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { HOST_MOVED } from "../../../../shared/embed";
import type { Position } from "../../sketch/model";
import { cursorDrawnFor, type Hotspot, hotspotFor } from "./cursorGeometry";

/** What the sheet answers when asked what is under a point in the window. */
type Reader = (event: { clientX: number; clientY: number }) => Position | null;

/** What the cursor is following, all of it written rather than rendered. */
interface Following {
  /** The layers on the sheet, however many the cursor is drawn in. */
  layers: SVGSVGElement[];
  /**
   * Where the pointer last was. Kept whatever the tool in hand, so that letting
   * go of the space bar after a pan does not bring the cursor back where the
   * pan began.
   */
  spot: Position | null;
  /**
   * Where in the window the pointer last was, kept beside where that put it on
   * the sheet. The sheet can move under a pointer that has not moved, and then
   * the window place still holds while the sheet place does not.
   */
  inWindow: { clientX: number; clientY: number } | null;
  /** The latest reading of the sheet, so the listeners below are bound once. */
  read: Reader;
  /** Where the tool in hand takes its click from. */
  hotspot: Hotspot;
}

/** What a cursor follows before the pointer has been anywhere. */
function nothingYet(read: Reader, hotspot: Hotspot): Following {
  return { layers: [], spot: null, inWindow: null, read, hotspot };
}

/** Put the layers where the pointer is. Runs on every move, so it does no work. */
function place(one: Following, at: Position | null) {
  if (!at) return;
  const put = `translate(${at.x - one.hotspot.x}px, ${at.y - one.hotspot.y}px)`;
  for (const layer of one.layers) layer.style.transform = put;
}

/**
 * The sheet moving out from under a pointer that has not moved. Panning the
 * view or resizing the window does it, and so does the page scrolling when
 * GRASP is framed in one.
 *
 * Where the pointer's own place in the window still holds, the sheet is asked
 * again what is under it. Where the frame itself moved, that place is stale
 * too and there is nothing left to ask with, so the page framing GRASP says so
 * and the cursor is put away, the platform's coming back until the pointer
 * moves. Bound only while there is a cursor to strand.
 */
function useResettle(following: RefObject<Following>, drawn: boolean, away: () => void) {
  useEffect(() => {
    if (!drawn) return;
    const again = () => {
      const one = following.current;
      const at = one.inWindow && one.read(one.inWindow);
      if (!at) {
        away();
        return;
      }
      one.spot = at;
      place(one, at);
    };
    const moved = (event: MessageEvent) => {
      if (event.data === HOST_MOVED) away();
    };
    window.addEventListener("scroll", again, { capture: true, passive: true });
    window.addEventListener("resize", again);
    window.addEventListener("message", moved);
    return () => {
      window.removeEventListener("scroll", again, { capture: true });
      window.removeEventListener("resize", again);
      window.removeEventListener("message", moved);
    };
  }, [following, drawn, away]);
}

export function useToolCursor(tool: string, screenOf: Reader) {
  /** Whether the pointer is on paper GRASP would draw a cursor over. */
  const [onPaper, setOnPaper] = useState(false);
  const hasCursor = cursorDrawnFor(tool);

  const following = useRef<Following>(nothingYet(screenOf, hotspotFor(tool)));
  following.current.read = screenOf;
  following.current.hotspot = hotspotFor(tool);

  const away = useCallback(() => setOnPaper(false), []);

  // A tool that had no cursor a moment ago has one now, so its layers are new
  // and have yet to be put anywhere. Before the paint, so they are never seen
  // at the sheet's corner on the way.
  useLayoutEffect(() => place(following.current, following.current.spot));
  useResettle(following, hasCursor && onPaper, away);

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
      following.current.spot = at;
      following.current.inWindow = { clientX: event.clientX, clientY: event.clientY };
      place(following.current, at);
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
