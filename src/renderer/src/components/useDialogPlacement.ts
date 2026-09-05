/**
 * Where a dialog sits, and how much of the window it may have.
 *
 * A dialog floats over the workspace rather than blocking it, so nothing else
 * decides where it goes: it opens somewhere clear, it is dragged by its bar,
 * and from then on it stays where it was put. All of it has to stay inside the
 * window, though. What it is asking has to be readable and its buttons have to
 * be reachable, whatever size the window is now, and neither is true of a
 * dialog hanging off an edge.
 */

import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { inWindow } from "./inWindow";

/** Where a dialog opens: clear of the middle, so the sheet stays clickable. */
const OPENS_AT = { x: 0.68, y: 0.18 };

/** How near the window's edge a dialog is allowed to come, in pixels. */
const EDGE = 8;

/** How far a dialog opened beside a spot on the sheet stands clear of it. */
const CLEAR = { x: 36, y: 24 };

export interface Placement {
  box: RefObject<HTMLDivElement | null>;
  body: RefObject<HTMLDivElement | null>;
  /** Where the dialog is placed and how tall it may be, or nothing on a phone. */
  style: CSSProperties | undefined;
  /** Set while the window is too short for the dialog, so its body scrolls. */
  tall: boolean;
  startDrag: (event: PointerEvent<HTMLDivElement>) => void;
  onDrag: (event: PointerEvent<HTMLDivElement>) => void;
  endDrag: () => void;
}

interface Placing {
  /** The spot on the sheet the dialog was opened beside, where there was one. */
  opensAt?: { x: number; y: number };
  phone: boolean;
}

export function useDialogPlacement({ opensAt, phone }: Placing): Placement {
  const [at, setAt] = useState(() => opening(opensAt));
  const [tall, setTall] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const fit = useCallback(() => {
    const node = box.current;
    const sheet = body.current;
    if (phone || !node || !sheet) return;
    // The bar, the buttons and the border: everything the body is not. Those
    // are held at their own height by `flex-shrink: 0`, so this is the same
    // number whether or not the body is already scrolling, and capping the
    // dialog cannot go on to uncap it.
    const chrome = node.offsetHeight - sheet.offsetHeight;
    setTall(chrome + sheet.scrollHeight > room());
    setAt((was) => {
      const put = inWindow(was, { width: node.offsetWidth, height: node.offsetHeight }, EDGE);
      return put.x === was.x && put.y === was.y ? was : put;
    });
  }, [phone]);

  // After every render rather than off a size the browser reports, because what
  // changes the height here is the dialog's own contents, and a change to those
  // is a render.
  useLayoutEffect(fit);

  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  // Dragged by its bar, because it must be possible to get it off a point you
  // need to click. The close button sits on that bar and is not a handle: were
  // the press on it to capture the pointer for the bar, the click that follows
  // would be the bar's rather than the button's and the dialog would not shut.
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest(".dialog__close")) return;
    drag.current = { x: event.clientX - at.x, y: event.clientY - at.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDrag(event: PointerEvent<HTMLDivElement>) {
    // Nowhere to drag it to: the stylesheet places it against the top of what
    // is visible, and the inline position it would set is not read.
    if (phone) return;
    const node = box.current;
    if (!drag.current || !node) return;
    const wanted = { x: event.clientX - drag.current.x, y: event.clientY - drag.current.y };
    setAt(inWindow(wanted, { width: node.offsetWidth, height: node.offsetHeight }, EDGE));
  }

  return {
    box,
    body,
    style: phone ? undefined : written(at, tall),
    tall,
    startDrag,
    onDrag,
    endDrag: () => {
      drag.current = null;
    },
  };
}

/** How much of the window's height a dialog may take up. */
function room(): number {
  return window.innerHeight - EDGE * 2;
}

/** Where a dialog starts, before there is one to measure. */
function opening(opensAt?: { x: number; y: number }) {
  // Clear of the pointer, where it was asked for beside a spot on the sheet.
  if (opensAt) return { x: opensAt.x + CLEAR.x, y: opensAt.y + CLEAR.y };
  return {
    x: Math.round(window.innerWidth * OPENS_AT.x),
    y: Math.round(window.innerHeight * OPENS_AT.y),
  };
}

/**
 * The placement written onto the dialog, which is left off entirely on a phone:
 * there is nowhere to drag one to and a keyboard waiting to cover the bottom of
 * it, so the stylesheet pins it to the top of what is visible instead. Left off
 * rather than overridden, so that rule needs no importance to win.
 */
function written(at: { x: number; y: number }, tall: boolean): CSSProperties {
  return { left: `${at.x}px`, top: `${at.y}px`, maxHeight: tall ? `${room()}px` : undefined };
}
