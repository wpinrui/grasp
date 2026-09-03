import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePhone } from "../phone";
import { CloseIcon } from "./icons";
import "./TransformDialog.css";

/** Where a dialog opens: clear of the middle, so the sheet stays clickable. */
const OPENS_AT = { x: 0.68, y: 0.18 };

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
      ? {
          // Clear of the pointer, and never off the far edge of the window.
          x: Math.max(8, Math.min(opensAt.x + 36, window.innerWidth - 260)),
          y: Math.max(8, Math.min(opensAt.y + 24, window.innerHeight - 220)),
        }
      : {
          x: Math.round(window.innerWidth * OPENS_AT.x),
          y: Math.round(window.innerHeight * OPENS_AT.y),
        },
  );
  const drag = useRef<{ x: number; y: number } | null>(null);

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
  // need to click.
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX - at.x, y: event.clientY - at.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setAt({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y });
  }

  return (
    <div
      className={`dialog${wide ? " dialog--wide" : ""}`}
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

      <div className="dialog__body" style={bodyStyle}>
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
