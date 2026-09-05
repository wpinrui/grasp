import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onAPhone } from "../phone";
import "./Tooltip.css";

/** Which side of the thing it names the tooltip hangs off. */
export type TooltipSide = "top" | "bottom" | "left" | "right";

/** Where the chip sits on the screen, in pixels. */
export interface Spot {
  top: number;
  left: number;
}

/** How far the tooltip stands off what it names, in pixels. */
const GAP = 6;

/** The least room left between the tooltip and the edge of the window. */
const EDGE = 6;

/**
 * Where the chip waits until it has been measured. Off any screen, so the one
 * layout pass before it is placed cannot show it in the wrong spot.
 */
const PARKED: Spot = { top: -9999, left: -9999 };

interface ChipProps {
  says: string;
  keys?: string;
  style?: CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

/** The chip itself: what a thing is called, and the key that reaches it. */
function Chip({ says, keys, style, ref }: ChipProps) {
  return (
    <div ref={ref} className="tooltip" style={style}>
      <span className="tooltip__name">{says}</span>
      {keys && <span className="tooltip__key">{keys}</span>}
    </div>
  );
}

/**
 * Where the chip goes, given the box it names, the chip's own size, and the
 * side asked for. Never off the edge of the window, whichever side that was.
 */
export function place(
  of: { top: number; bottom: number; left: number; right: number; width: number; height: number },
  chip: { width: number; height: number },
  side: TooltipSide,
): Spot {
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
  /** The one thing it names. */
  children: ReactNode;
}

/**
 * GRASP's own hover tooltip, in place of the browser's `title`.
 *
 * `title` is drawn by the browser, in the browser's colours, after a wait
 * nothing here can set, and a touch screen never shows it at all. This is the
 * same chip the toolbox has always shown, hung off whatever it is given.
 *
 * The hover is taken by a wrapper rather than by what it names, because a
 * disabled control dispatches no mouse events at all: listeners on the control
 * itself would show nothing on a greyed key, which is the one place a tooltip
 * saying why it is greyed is worth most, and would never hear the pointer leave
 * a key that greys out under it, leaving the chip stranded on the sheet.
 *
 * The chip rides on the window rather than inside what it names, so a panel
 * that clips its contents or a tab that slides mid-drag cannot take it along.
 *
 * A finger opens nothing. A touch screen fires mouse events after a tap out of
 * politeness to pages written before it, and a chip that answers those would
 * stand over the sheet until the next tap somewhere else.
 */
export function Tooltip({ says, keys, side = "top", quiet, children }: TooltipProps) {
  // The pointer and the keyboard are held apart: one flag for both would let
  // the pointer sweeping away take down a chip the keyboard is still on, and
  // let a key greying out under the pointer blur itself and take the chip with
  // it, which is the state this whole wrapper exists to keep showing.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Where the chip sits, once it has been measured. */
  const [spot, setSpot] = useState<Spot | null>(null);
  const of = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  /**
   * Whether the pointer is still down from a press on this. A press focuses
   * what it lands on, so without this the focus would put straight back up the
   * chip the press just took down.
   */
  const pressed = useRef(false);
  // Asked at each render rather than subscribed to: the answer is wanted on
  // the hover, and a hover is a render.
  const phone = onAPhone();
  const shown = (hovered || focused) && !quiet && !phone;

  // Measured before the paint, so the chip is never seen anywhere but its
  // place. Both boxes are read here rather than remembered from the hover: what
  // it says can change while it is up, and so can where what it names sits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the words are not read here, but they are what changes the chip's width, so a change to them is a reason to measure again
  useLayoutEffect(() => {
    const anchor = of.current;
    const element = chip.current;
    if (!shown || !anchor || !element) {
      setSpot(null);
      return;
    }
    setSpot(place(anchor.getBoundingClientRect(), element.getBoundingClientRect(), side));
  }, [shown, side, says, keys]);

  return (
    <>
      {/* Wraps rather than clones: see above. It shrinks to what it holds, so
          it sits in a row of keys exactly as the key it wraps would. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it listens for the pointer without being a control; what it wraps carries the role, the label and the keyboard */}
      <span
        ref={of}
        className="tooltip__of"
        onMouseEnter={
          phone
            ? undefined
            : () => {
                pressed.current = false;
                setHovered(true);
              }
        }
        onMouseLeave={
          phone
            ? undefined
            : () => {
                pressed.current = false;
                setHovered(false);
              }
        }
        // The keyboard reaches it too: a tooltip only a pointer can open is one
        // half the people using GRASP never see. A press focuses as well, and
        // that focus is not the keyboard asking for anything.
        onFocus={() => {
          if (!pressed.current) setFocused(true);
        }}
        onBlur={() => {
          pressed.current = false;
          setFocused(false);
        }}
        // A press is usually what moves things about, and a chip measured
        // against where a key used to be is worse than no chip.
        onPointerDown={() => {
          pressed.current = true;
          setHovered(false);
          setFocused(false);
        }}
      >
        {children}
      </span>
      {shown &&
        createPortal(
          <Chip ref={chip} says={says} keys={keys} style={spot ?? PARKED} />,
          document.body,
        )}
    </>
  );
}
