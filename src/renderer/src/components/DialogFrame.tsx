import { type CSSProperties, type ReactNode, useEffect } from "react";
import { usePhone } from "../phone";
import { CloseIcon } from "./icons";
import { useDialogPlacement } from "./useDialogPlacement";
import "./TransformDialog.css";

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
  const place = useDialogPlacement({ opensAt, phone: usePhone() });

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

  return (
    <div ref={place.box} className={`dialog${wide ? " dialog--wide" : ""}`} style={place.style}>
      <div
        className="dialog__bar"
        onPointerDown={place.startDrag}
        onPointerMove={place.onDrag}
        onPointerUp={place.endDrag}
      >
        <span className="dialog__title">{title}</span>
        <button type="button" className="dialog__close" aria-label="Close" onClick={onCancel}>
          <CloseIcon />
        </button>
      </div>

      <div
        ref={place.body}
        className={`dialog__body${place.tall ? " dialog__body--tall" : ""}`}
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
