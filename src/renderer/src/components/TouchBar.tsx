import type { ReactNode } from "react";
import "./TouchBar.css";

/**
 * The bar along the bottom of a phone.
 *
 * A touch screen has no keyboard to hold a key down on and no second button, so
 * the few things the sheet takes from those are drawn as keys instead. Panning
 * is not among them: two fingers do that, which is a gesture rather than a
 * control and wants nothing on screen.
 *
 * A key that can do nothing says so rather than going quiet when pressed, since
 * a finger gets no other feedback: there is no cursor to change and nothing to
 * hover.
 */
interface TouchBarProps {
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  /** Whether the sheet is holding to the length and angle steps. */
  snapping: boolean;
  onSnapping: (on: boolean) => void;
  onCancel: () => void;
}

function UndoIcon() {
  return <TouchIcon d="M7.5 5.5 L4 9 L7.5 12.5 M4 9 h7.5 a4 4 0 1 1 0 8 h-2.5" />;
}

function RedoIcon() {
  return <TouchIcon d="M12.5 5.5 L16 9 L12.5 12.5 M16 9 h-7.5 a4 4 0 1 0 0 8 h2.5" />;
}

/** The magnet the Snap panel is marked with, which this key stands in for. */
function SnapIcon() {
  return (
    <TouchIcon d="M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5 M5.4 3.4 L5.4 6.4 M14.6 3.4 L14.6 6.4" />
  );
}

function CancelIcon() {
  return <TouchIcon d="M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5" />;
}

function TouchIcon({ d }: { d: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

function Key({
  name,
  icon,
  on,
  enabled,
  onPress,
}: {
  name: string;
  icon: ReactNode;
  /** Set on a key that stays down, left off on one that just fires. */
  on?: boolean;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={`touchbar__key${on ? " touchbar__key--on" : ""}`}
      aria-label={name}
      aria-pressed={on === undefined ? undefined : on}
      disabled={!enabled}
      onClick={onPress}
    >
      {icon}
      <span className="touchbar__name">{name}</span>
    </button>
  );
}

export function TouchBar({
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  snapping,
  onSnapping,
  onCancel,
}: TouchBarProps) {
  return (
    <div className="touchbar">
      <Key name="Undo" icon={<UndoIcon />} enabled={canUndo} onPress={onUndo} />
      <Key name="Redo" icon={<RedoIcon />} enabled={canRedo} onPress={onRedo} />
      <Key
        name="Snap"
        icon={<SnapIcon />}
        on={snapping}
        enabled
        onPress={() => onSnapping(!snapping)}
      />
      <Key name="Cancel" icon={<CancelIcon />} enabled onPress={onCancel} />
    </div>
  );
}
