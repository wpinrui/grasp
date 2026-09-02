import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import type { LinePattern, LineWidth } from "../sketch/model";
import "./Palette.css";

/** How each weight is drawn in its own button, in pixels. */
export const WEIGHT_SAMPLE: Record<LineWidth, number> = {
  hairline: 1,
  thin: 1.75,
  medium: 3,
  thick: 4.5,
};

/** How each pattern is drawn in its own button. */
export const PATTERN_SAMPLE: Record<LinePattern, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "0.1 3.5",
};

/** Shut whatever is open as soon as a press lands outside it. */
export function useAway(anchor: RefObject<HTMLDivElement | null>, open: boolean, shut: () => void) {
  const close = useRef(shut);
  close.current = shut;
  useEffect(() => {
    if (!open) return;
    function away(event: PointerEvent) {
      if (!anchor.current?.contains(event.target as Node)) close.current();
    }
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [anchor, open]);
}

interface PickerProps {
  label: string;
  value: string;
  disabled: boolean;
  wide?: boolean;
  /** Set the box in the face it names, so it is a specimen of itself. */
  face?: string;
  options: { value: string; label: string; face?: string }[];
  onPick: (value: string) => void;
}

/**
 * A dropdown the bar opens itself. A native select will not do: the press that
 * opens one has to be let through, and letting it through takes the caret out
 * of the caption the palette is set on, which is the thing being set.
 */
export function Picker({ label, value, disabled, wide, face, options, onPick }: PickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useAway(anchor, open, () => setOpen(false));
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={`palette__picker${wide ? " palette__picker--wide" : ""}`} ref={anchor}>
      <button
        type="button"
        className={`palette__box${open ? " palette__box--on" : ""}`}
        aria-label={label}
        disabled={disabled}
        style={face ? { fontFamily: `"${face}", serif` } : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="palette__value">{value}</span>
        <span className="palette__caret palette__caret--down" />
      </button>
      {open && (
        <div className="palette__list">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`palette__option${option.value === value ? " palette__option--on" : ""}`}
              style={option.face ? { fontFamily: `"${option.face}", serif` } : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                onPick(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A run of controls too big for a bar: it opens above the bar instead. There is
 * only ever room for two rows, and the notation and the symbols each need more.
 */
export function Popout({
  name,
  sample,
  disabled,
  children,
}: {
  name: string;
  sample: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useAway(anchor, open, () => setOpen(false));

  // A run that goes dead while it is open takes its panel down with it.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="palette__opener-anchor" ref={anchor}>
      <button
        type="button"
        className={`palette__opener${open ? " palette__opener--on" : ""}`}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="palette__sample">{sample}</span>
        {name}
        <span className="palette__caret palette__caret--up" />
      </button>
      {open && <div className="palette__panel">{children}</div>}
    </div>
  );
}

/** A sample of a stroke, drawn the way the button would set it. */
export function Rule({ width, dash }: { width: number; dash?: string }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
      <line
        x1="2"
        y1="6"
        x2="24"
        y2="6"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap={dash === PATTERN_SAMPLE.dotted ? "round" : "butt"}
      />
    </svg>
  );
}
