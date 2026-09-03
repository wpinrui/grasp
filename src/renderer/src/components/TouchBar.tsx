import type { ReactNode } from "react";
import { CancelIcon, RedoIcon, SnapKeyIcon, UndoIcon } from "./icons";
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
        icon={<SnapKeyIcon />}
        on={snapping}
        enabled
        onPress={() => onSnapping(!snapping)}
      />
      <Key name="Cancel" icon={<CancelIcon />} enabled onPress={onCancel} />
    </div>
  );
}
