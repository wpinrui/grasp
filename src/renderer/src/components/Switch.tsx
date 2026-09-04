import "./Switch.css";

interface SwitchProps {
  /** What it turns on, which is what a screen reader reads it as. */
  name: string;
  on: boolean;
  onChange: (on: boolean) => void;
}

/**
 * A setting that stays on, rather than a choice being ticked off. It is a
 * switch and not a checkbox for that reason, and it is here rather than in
 * each panel because four of them wanted the same one.
 */
export function Switch({ name, on, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      className={`switch${on ? " switch--on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch__knob" />
    </button>
  );
}
