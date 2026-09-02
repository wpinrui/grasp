import { useEffect, useState } from "react";
import type { ParameterUnit } from "../sketch/model";
import { DialogFrame } from "./DialogFrame";
import "./ParameterDialog.css";

interface ParameterDialogProps {
  /** What it opens holding, for a parameter being changed rather than made. */
  start?: { value: number; unit: ParameterUnit; places: number };
  /** How angles and distances are written now, so the choices say the units. */
  angleUnit: string;
  distanceUnit: string;
  onApply: (value: number, unit: ParameterUnit, places: number) => void;
  onCancel: () => void;
}

/**
 * How far the number was typed out. It is both the precision the parameter is
 * written to and the step the + and - keys move it by, so one thing typed says
 * both: 5 counts in ones, 5.0 in tenths, 5.00 in hundredths.
 */
function placesIn(typed: string): number {
  const point = typed.indexOf(".");
  return point === -1 ? 0 : typed.length - point - 1;
}

/** The step those places make, as it is written in the note under the field. */
function stepFor(places: number): string {
  return places === 0 ? "1" : `0.${"0".repeat(places - 1)}1`;
}

const UNITS: { unit: ParameterUnit; label: string }[] = [
  { unit: "none", label: "None" },
  { unit: "angle", label: "Angle" },
  { unit: "distance", label: "Distance" },
];

/**
 * New Parameter: a number the sketch simply holds, which everything else can be
 * built on and then varied.
 *
 * The reference app leaves the rule tying the decimal places to the keyboard
 * step buried in its help. Here the dialog says it as you type, because it is
 * the one thing about a parameter that is not obvious from looking at it.
 */
export function ParameterDialog({
  start,
  angleUnit,
  distanceUnit,
  onApply,
  onCancel,
}: ParameterDialogProps) {
  const [typed, setTyped] = useState(() => (start ? start.value.toFixed(start.places) : "1.0"));
  const [unit, setUnit] = useState<ParameterUnit>(start?.unit ?? "none");

  // Opening on an existing parameter shows what that one holds.
  useEffect(() => {
    if (start) setTyped(start.value.toFixed(start.places));
  }, [start]);

  const value = Number(typed);
  const good = typed.trim() !== "" && Number.isFinite(value);
  const places = placesIn(typed.trim());

  const named = (of: ParameterUnit) =>
    of === "angle" ? ` (${angleUnit})` : of === "distance" ? ` (${distanceUnit})` : "";

  return (
    <DialogFrame
      title={start ? "Parameter" : "New Parameter"}
      action={start ? "Change" : "Add"}
      canApply={good}
      onApply={() => good && onApply(value, unit, places)}
      onCancel={onCancel}
    >
      <label className="parameter__row">
        <span className="parameter__name">Value</span>
        <input
          className="parameter__number"
          // biome-ignore lint/a11y/noAutofocus: the value is the whole point of the dialog
          autoFocus
          value={typed}
          inputMode="decimal"
          aria-label="Value"
          onChange={(event) => setTyped(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
      </label>

      <div className="parameter__row">
        <span className="parameter__name">Units</span>
        <div className="parameter__units">
          {UNITS.map((choice) => (
            <button
              key={choice.unit}
              type="button"
              className={`parameter__unit${unit === choice.unit ? " parameter__unit--on" : ""}`}
              onClick={() => setUnit(choice.unit)}
            >
              {choice.label}
              <span className="parameter__unit-said">{named(choice.unit)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Said out loud rather than left in the manual: how far it is written
          out is also how far the keys move it. */}
      <p className="parameter__note">
        {good
          ? `Written to ${places === 0 ? "whole numbers" : `${places} decimal place${places === 1 ? "" : "s"}`}. + and − step it by ${stepFor(places)}.`
          : "Type a number."}
      </p>
    </DialogFrame>
  );
}
