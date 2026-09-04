/**
 * Where the sheet is being looked at, and the three ways that changes:
 * scrolling, zooming, and reading a pointer's place off the element.
 *
 * The scroll and wheel handlers fire outside the render that made them, so what
 * they need is read off refs rather than off a closure that has gone stale.
 * Scrolling is also reported back by the element it happens in, so a position
 * the sheet has just written is not read again as if a person had scrolled to it.
 */

import type { MouseEvent, PointerEvent, RefObject, UIEvent, WheelEvent } from "react";
import { useRef } from "react";
import { type Position, type Rect, toSheet, type View } from "../../sketch/model";
import { clampScale, WHEEL_ZOOM } from "./sheet";

/** What the sheet hands the view: where it is, and what it is drawn in. */
export interface Viewing {
  view: View;
  onView: (view: View) => void;
  /** The element the sheet is drawn in, which a pointer is placed against. */
  sheet: RefObject<HTMLDivElement | null>;
  /** How much sheet is on screen, which is what the zoom buttons hold still. */
  viewport: { width: number; height: number };
  /** What the scrollbars run over. */
  area: Rect;
  /** Whether the wheel zooms, from Preferences. */
  zoomable: boolean;
}

export function useView({ view, onView, sheet, viewport, area, zoomable }: Viewing) {
  const scale = view.scale;
  const areaNow = useRef(area);
  areaNow.current = area;
  const viewNow = useRef(view);
  viewNow.current = view;
  const scaleNow = useRef(scale);
  scaleNow.current = scale;
  /** Where the sheet last put the scrollbars, so its own writes read as its own. */
  const wrote = useRef({ x: 0, y: 0 });

  /** A scroll position worth acting on, or nothing where the sheet wrote it. */
  function scrolledTo(at: number, axis: "x" | "y"): number | null {
    if (Math.abs(at - wrote.current[axis]) < 0.5) return null;
    wrote.current[axis] = at;
    return at;
  }

  function handleScrollX(event: UIEvent<HTMLDivElement>) {
    const at = scrolledTo(event.currentTarget.scrollLeft, "x");
    if (at === null) return;
    onView({ ...viewNow.current, x: areaNow.current.x + at / scaleNow.current });
  }

  function handleScrollY(event: UIEvent<HTMLDivElement>) {
    const at = scrolledTo(event.currentTarget.scrollTop, "y");
    if (at === null) return;
    onView({ ...viewNow.current, y: areaNow.current.y + at / scaleNow.current });
  }

  /** Where in the sheet element a pointer is, in screen pixels. */
  function screenOf(event: { clientX: number; clientY: number }): Position | null {
    const bounds = sheet.current?.getBoundingClientRect();
    return bounds ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : null;
  }

  /** Where on the sheet a pointer is, in the sheet's own pixels. */
  function positionOf(
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ): Position | null {
    const bounds = sheet.current?.getBoundingClientRect();
    return bounds ? toSheet(bounds, event, { view, scale }) : null;
  }

  /** Zoom, holding the sheet still under one point of the canvas. */
  function zoomAround(next: number, at: Position) {
    const scaled = clampScale(next);
    const was = scaleNow.current;
    const held = { x: viewNow.current.x + at.x / was, y: viewNow.current.y + at.y / was };
    onView({ x: held.x - at.x / scaled, y: held.y - at.y / scaled, scale: scaled });
  }

  /** Minus, plus and the readout all hold the middle of the canvas still. */
  function zoomTo(next: number) {
    zoomAround(next, { x: viewport.width / 2, y: viewport.height / 2 });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!zoomable) return;
    const at = screenOf(event);
    if (!at) return;
    zoomAround(scaleNow.current * Math.exp(-event.deltaY * WHEEL_ZOOM), at);
  }

  return {
    handleScrollX,
    handleScrollY,
    handleWheel,
    positionOf,
    scaleNow,
    viewNow,
    wrote,
    zoomTo,
  };
}
