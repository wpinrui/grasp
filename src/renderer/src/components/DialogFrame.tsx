import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePhone } from "../phone";
import { CloseIcon } from "./icons";
import "./TransformDialog.css";

/** Where a dialog opens: clear of the middle, so the sheet stays clickable. */
const OPENS_AT = { x: 0.68, y: 0.18 };

/** How near the window's edge a dialog is allowed to come, in pixels. */
const EDGE = 8;

/** The nearest spot to `at` that leaves the whole of the dialog in the window. */
function inside(at: { x: number; y: number }, node: HTMLElement) {
  return {
    x: Math.max(EDGE, Math.min(at.x, window.innerWidth - node.offsetWidth - EDGE)),
    y: Math.max(EDGE, Math.min(at.y, window.innerHeight - node.offsetHeight - EDGE)),
  };
}

interface DialogFrameProps {
  title: string;
  /** The action button's label, which is what the dialog is called. */
  action: string;
  canApply: boolean;
  onApply: () => void;
  onCancel: () => void;
  /** A further choice, shown beside Cancel. */
  extra?: ReactNode;
  /**
   * Where it opens, in screen pixels. Set where the dialog answers a question
   * about one spot on the sheet, so it comes up by the thing it is asking
   * about rather than over on the right. It is only where it starts: the bar
   * drags it from there like any other.
   */
  at?: { x: number; y: number };
  /** Set where the buttons need more room than the usual width leaves. */
  wide?: boolean;
  /** Colours the body is to be read against, where they are not the usual ones. */
  bodyStyle?: CSSProperties;
  /**
   * Set while another dialog is open over this one, so Escape and Enter belong
   * to the one on top rather than answering both at once.
   */
  quiet?: boolean;
  children: ReactNode;
}

/**
 * The chrome every dialog shares: a bar it drags by, Escape and Enter, and the
 * two buttons. It floats over the workspace rather than blocking it, because
 * the sheet underneath has to stay clickable while it is open.
 */
export function DialogFrame({
  title,
  action,
  canApply,
  onApply,
  onCancel,
  extra,
  at: opensAt,
  wide,
  bodyStyle,
  quiet,
  children,
}: DialogFrameProps) {
  const phone = usePhone();
  const [at, setAt] = useState(() =>
    opensAt
      ? // Clear of the pointer. Anywhere that leaves it hanging off an edge is
        // pulled back in below, once there is a dialog to measure.
        { x: opensAt.x + 36, y: opensAt.y + 24 }
      : {
          x: Math.round(window.innerWidth * OPENS_AT.x),
          y: Math.round(window.innerHeight * OPENS_AT.y),
        },
  );
  /** Set while the window is too short for the dialog, so its body scrolls. */
  const [tall, setTall] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  /**
   * Keep the whole of the dialog inside the window. What it asks has to be
   * readable and its buttons reachable, wherever it opened, wherever it has
   * been dragged to and whatever size the window is now. Where the window is
   * too short to hold it at all, the body gives way and scrolls, so the title
   * and the buttons are never what goes.
   */
  const fit = useCallback(() => {
    const node = box.current;
    const sheet = body.current;
    if (phone || !node || !sheet) return;
    // The bar, the buttons and the border: everything the body is not. Read
    // this way round the height wanted is the same whether or not the body is
    // already scrolling, so capping it cannot go on to uncap itself.
    const chrome = node.offsetHeight - sheet.offsetHeight;
    setTall(chrome + sheet.scrollHeight > window.innerHeight - EDGE * 2);
    setAt((was) => {
      const put = inside(was, node);
      return put.x === was.x && put.y === was.y ? was : put;
    });
  }, [phone]);

  // After every render rather than off a size the browser reports, because what
  // changes height here is the dialog's own contents and each of those is one.
  useLayoutEffect(fit);

  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  useEffect(() => {
    if (quiet) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
      else if (event.key === "Enter" && canApply) onApply();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canApply, onApply, onCancel, quiet]);

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
    if (!drag.current || !box.current) return;
    setAt(
      inside({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }, box.current),
    );
  }

  return (
    <div
      ref={box}
      className={`dialog${wide ? " dialog--wide" : ""}${tall ? " dialog--tall" : ""}`}
      // A touch screen has nowhere to drag a dialog to and a keyboard waiting to
      // cover the bottom of it, so the stylesheet places it against the top of
      // what is visible instead. Left off rather than overridden, so that rule
      // needs no importance to win.
      style={phone ? undefined : { left: `${at.x}px`, top: `${at.y}px` }}
    >
      <div
        className="dialog__bar"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <span className="dialog__title">{title}</span>
        <button type="button" className="dialog__close" aria-label="Close" onClick={onCancel}>
          <CloseIcon />
        </button>
      </div>

      <div
        ref={body}
        className={`dialog__body${tall ? " dialog__body--tall" : ""}`}
        style={bodyStyle}
      >
        {children}
      </div>

      <div className="dialog__buttons">
        <button type="button" className="dialog__button" onClick={onCancel}>
          Cancel
        </button>
        {extra}
        <button
          type="button"
          className="dialog__button dialog__button--go"
          disabled={!canApply}
          onClick={onApply}
        >
          {action}
        </button>
      </div>
    </div>
  );
}
