import { previewEvents, useHoverPreview } from "./HoverPreview";
import "./Switch.css";

interface SwitchProps {
  /** What it turns on, which is what a screen reader reads it as. */
  name: string;
  on: boolean;
  onPreview?: (on: boolean) => void;
  onChange: (on: boolean) => void;
}

/**
 * A setting that stays on, rather than a choice being ticked off. It is a
 * switch and not a checkbox for that reason, and it is here rather than in
 * each panel because four of them wanted the same one.
 */
export function Switch({ name, on, onChange, onPreview }: SwitchProps) {
  const { clear } = useHoverPreview();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      className={`switch${on ? " switch--on" : ""}`}
      {...previewEvents(() => onPreview?.(!on), clear)}
      onClick={() => onChange(!on)}
    >
      <span className="switch__knob" />
    </button>
  );
}
