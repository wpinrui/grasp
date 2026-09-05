import {
  type CSSProperties,
  cloneElement,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./Tooltip.css";

/** Which side of the thing it names the tooltip hangs off. */
export type TooltipSide = "top" | "bottom" | "left" | "right";

/** How far the tooltip stands off what it names, in pixels. */
const GAP = 6;

/** The least room left between the tooltip and the edge of the window. */
const EDGE = 6;

interface TooltipChipProps {
  /** What it says. */
  says: string;
  /** The key that does the same thing, drawn as a chip after the words. */
  keys?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The tooltip itself: what a thing is called, and the key that reaches it.
 *
 * Placed by whoever puts it up, in screen pixels, so a rail that scrolls and
 * clips what leaves it can still hang one off its edge. Most of the app wants
 * `Tooltip` below instead, which finds the place on its own.
 */
export function TooltipChip({ says, keys, className, style, ref }: TooltipChipProps) {
  return (
    <div ref={ref} className={`tooltip${className ? ` ${className}` : ""}`} style={style}>
      <span className="tooltip__name">{says}</span>
      {keys && <span className="tooltip__key">{keys}</span>}
    </div>
  );
}

/** Where the chip goes, given what it names, how big the chip is and which side. */
function place(
  of: DOMRect,
  chip: { width: number; height: number },
  side: TooltipSide,
): { top: number; left: number } {
  const middleX = of.left + of.width / 2 - chip.width / 2;
  const middleY = of.top + of.height / 2 - chip.height / 2;
  const wanted =
    side === "top"
      ? { top: of.top - chip.height - GAP, left: middleX }
      : side === "bottom"
        ? { top: of.bottom + GAP, left: middleX }
        : side === "left"
          ? { top: middleY, left: of.left - chip.width - GAP }
          : { top: middleY, left: of.right + GAP };
  // Never off the edge of the window, whichever side it was asked for.
  return {
    top: Math.max(EDGE, Math.min(wanted.top, window.innerHeight - chip.height - EDGE)),
    left: Math.max(EDGE, Math.min(wanted.left, window.innerWidth - chip.width - EDGE)),
  };
}

interface TooltipProps {
  says: string;
  keys?: string;
  /** Where it opens. Above, which is out of the pointer's way, unless told otherwise. */
  side?: TooltipSide;
  /** Set while something else is showing in its place, so it stays down. */
  quiet?: boolean;
  /** The one thing it names. It takes the hover, and keeps whatever else it had. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}

/**
 * GRASP's own hover tooltip, in place of the browser's `title`.
 *
 * `title` is drawn by the browser, in the browser's colours, after a wait
 * nothing here can set, and a touch screen never shows it at all. This is the
 * same chip the toolbox has always shown, hung off whatever it is given.
 *
 * It rides on the window rather than inside what it names, so a panel that
 * clips its contents or a tab that slides mid-drag cannot take it with them.
 */
export function Tooltip({ says, keys, side = "top", quiet, children }: TooltipProps) {
  /** What it names, while the pointer is on it. Null with the pointer away. */
  const [of, setOf] = useState<DOMRect | null>(null);
  /** Where the chip sits, once it has been measured. */
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  const chip = useRef<HTMLDivElement>(null);

  // Measured before the paint, so the chip is never seen anywhere but its place.
  useLayoutEffect(() => {
    const element = chip.current;
    if (!of || !element) {
      setSpot(null);
      return;
    }
    setSpot(place(of, element.getBoundingClientRect(), side));
  }, [of, side]);

  const held = children.props;
  const shown = of !== null && !quiet;

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          held.onMouseEnter?.(event);
          setOf(event.currentTarget.getBoundingClientRect());
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          held.onMouseLeave?.(event);
          setOf(null);
        },
        // The keyboard reaches it too: a tooltip only a pointer can open is one
        // half the people using GRASP never see.
        onFocus: (event: FocusEvent<HTMLElement>) => {
          held.onFocus?.(event);
          setOf(event.currentTarget.getBoundingClientRect());
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
          held.onBlur?.(event);
          setOf(null);
        },
      })}
      {shown &&
        createPortal(
          <TooltipChip
            ref={chip}
            says={says}
            keys={keys}
            // Off the screen until it has been measured, which is the same
            // frame: the layout effect above runs before anything is painted.
            style={spot ?? { top: -9999, left: -9999 }}
          />,
          document.body,
        )}
    </>
  );
}
