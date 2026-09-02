import { useEffect, useState } from "react";
import "./SnapPanel.css";

/** What the sheet is snapping to, and how far apart the steps are. */
export interface Snapping {
  /** Points, paths and crossings on the sheet. This always wins over the rest. */
  objects: boolean;
  length: boolean;
  /** The step a length is held to, in centimetres. */
  lengthCm: number;
  angle: boolean;
  /** The step an angle is held to, in degrees. */
  angleDegrees: number;
  /**
   * Whether the steps hold a drag of what is already drawn, as well as an
   * object being drawn. Off leaves a move free, and takes away the run, the
   * length and the angle a move reads out, there being no step to read.
   */
  moving: boolean;
}

interface SnapPanelProps {
  snapping: Snapping;
  onChange: (part: Partial<Snapping>) => void;
}

/** The only thing a step cannot be: nothing, since nothing has no steps in it. */
const LEAST = 0;

function Switch({
  name,
  on,
  onChange,
}: {
  name: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={name}
      className={`snap__switch${on ? " snap__switch--on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="snap__switch-knob" />
    </button>
  );
}

/**
 * A step to hold something to. What is being typed is held here as it is typed,
 * so a number can be got to one character at a time: reaching 0.1 means passing
 * through "0", which is not a step anything could be held to, and a box that
 * refuses what it is handed halfway through is a box that cannot be typed in.
 * The number goes out only once what is in the box is one, and what is in the
 * box goes back to the last good number when it is left with anything else.
 */
function Step({
  name,
  unit,
  value,
  step,
  disabled,
  onChange,
}: {
  name: string;
  unit: string;
  value: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [typed, setTyped] = useState(`${value}`);
  // What is held elsewhere wins whenever it changes, so Enable all and a fresh
  // sketch both show up here.
  useEffect(() => setTyped(`${value}`), [value]);

  return (
    <label className="snap__step">
      <input
        type="number"
        className="snap__number"
        value={typed}
        min={step}
        step={step}
        disabled={disabled}
        aria-label={name}
        onChange={(event) => {
          setTyped(event.target.value);
          const wanted = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(wanted) && wanted > LEAST) {
            onChange(wanted);
          }
        }}
        onBlur={() => setTyped(`${value}`)}
      />
      <span className="snap__unit">{unit}</span>
    </label>
  );
}

/**
 * What a drawing tool holds itself to. Snapping to what is already on the sheet
 * is one thing, and it comes first: a point, a path or a crossing under the
 * pointer is what a click lands on however the steps are set. Only where there
 * is nothing to land on do the steps take over, holding a length to whole
 * centimetres and a direction to whole degrees.
 *
 * The steps are measured from where the object being drawn started, and an
 * angle from the straight object already at that corner where there is one, so
 * what the sheet reads out while it is being drawn is the number being held.
 */
export function SnapPanel({ snapping, onChange }: SnapPanelProps) {
  const all = snapping.objects && snapping.length && snapping.angle && snapping.moving;

  return (
    <div className="snap">
      <div className="snap__row">
        <span className="snap__name">Snap to objects</span>
        <Switch
          name="Snap to objects"
          on={snapping.objects}
          onChange={(on) => onChange({ objects: on })}
        />
      </div>

      <div className="snap__row">
        <span className="snap__name">Snap length</span>
        <Step
          name="Length step in centimetres"
          unit="cm"
          value={snapping.lengthCm}
          step={0.5}
          disabled={!snapping.length}
          onChange={(lengthCm) => onChange({ lengthCm })}
        />
        <Switch
          name="Snap length"
          on={snapping.length}
          onChange={(on) => onChange({ length: on })}
        />
      </div>

      <div className="snap__row">
        <span className="snap__name">Snap angle</span>
        <Step
          name="Angle step in degrees"
          unit="°"
          value={snapping.angleDegrees}
          step={5}
          disabled={!snapping.angle}
          onChange={(angleDegrees) => onChange({ angleDegrees })}
        />
        <Switch name="Snap angle" on={snapping.angle} onChange={(on) => onChange({ angle: on })} />
      </div>

      <div className="snap__row">
        <span className="snap__name">Snap while moving</span>
        <Switch
          name="Snap while moving"
          on={snapping.moving}
          onChange={(on) => onChange({ moving: on })}
        />
      </div>

      <div className="snap__row snap__row--all">
        <button
          type="button"
          className="snap__action"
          onClick={() => onChange({ objects: !all, length: !all, angle: !all, moving: !all })}
        >
          {all ? "Disable all" : "Enable all"}
        </button>
      </div>
    </div>
  );
}
