import type { MouseEvent, ReactNode } from "react";
import type { Position } from "../sketch/model";
import { Tooltip } from "./Tooltip";
import "./MarkPanel.css";

// A press must not reach the sheet: that would count as a click on the canvas,
// which is what closes the panel.
const hold = (event: MouseEvent) => event.preventDefault();

interface PanelShellProps {
  /** Where the panel sits, in screen pixels from the sheet's top left. */
  at: Position;
  /** The tool colour the strip is tinted with, as a CSS colour. */
  colour: string;
  children: ReactNode;
}

/**
 * The floating strip a mark or a reading opens in. It rides above the sheet in
 * screen pixels, so it keeps its size at every zoom the way a label does, and
 * it follows what it is about when the figure moves.
 */
export function PanelShell({ at, colour, children }: PanelShellProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only swallows presses so the sheet never sees them; the buttons inside take the focus
    <div
      className="mark-panel"
      style={{ left: `${at.x}px`, top: `${at.y}px`, color: colour }}
      onMouseDown={hold}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface PanelButtonProps {
  /** What the button is, read out by a screen reader. */
  label: string;
  /**
   * What the tooltip says, where that is not the label. Null on the count
   * buttons, which say what they are by the strokes drawn on them.
   */
  tip?: string | null;
  /** Whether it reads as the one that is on. */
  on?: boolean;
  disabled?: boolean;
  /** Set on the one that takes the thing away, which is drawn apart from the rest. */
  away?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** One press in a panel strip. */
export function PanelButton({
  label,
  tip,
  on,
  disabled,
  away,
  onClick,
  children,
}: PanelButtonProps) {
  const key = (
    <button
      type="button"
      className={`mark-panel__button${on ? " mark-panel__button--on" : ""}${
        away ? " mark-panel__button--away" : ""
      }`}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
  const says = tip === undefined ? label : tip;
  return says === null ? key : <Tooltip says={says}>{key}</Tooltip>;
}

/** The hairline between two groups of presses. */
export function PanelSplit() {
  return <span className="mark-panel__split" />;
}
