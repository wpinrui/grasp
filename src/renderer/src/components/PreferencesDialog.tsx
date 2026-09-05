import type { CSSProperties, ReactNode } from "react";
import {
  ANGLE_UNITS,
  type Colours,
  canvasTokens,
  DEFAULT_PREFS,
  DISTANCE_UNITS,
  PLACES,
  type Prefs,
  SHEETS,
} from "../sketch/prefs";
import { DialogFrame } from "./DialogFrame";
import { Tooltip } from "./Tooltip";
import { FONTS, INKS, SIZES } from "./typeset";
import "./PreferencesDialog.css";

const ANGLE_NAMES: Record<(typeof ANGLE_UNITS)[number], string> = {
  degrees: "Degrees",
  radians: "Radians",
};

const KINDS: { key: keyof Colours; name: string }[] = [
  { key: "point", name: "Points" },
  { key: "path", name: "Paths" },
  { key: "fill", name: "Fills" },
  { key: "mark", name: "Marks" },
  { key: "label", name: "Labels" },
];

interface PreferencesDialogProps {
  prefs: Prefs;
  onChange: (prefs: Prefs) => void;
  /** Which of the two the change goes to. Neither leaves nothing to apply. */
  toSketch: boolean;
  toNew: boolean;
  onScope: (part: { toSketch?: boolean; toNew?: boolean }) => void;
  onApply: () => void;
  onCancel: () => void;
}

/**
 * Preferences: what GRASP does by default. Everything on one sheet rather than
 * behind tabs, so that Apply to at the foot plainly covers all of it.
 *
 * Nothing here says how a drawn object is drawn; that is the palette's. This
 * says what a new one comes out as, what a measurement is written in, and what
 * the sheet is.
 */
export function PreferencesDialog({
  prefs,
  onChange,
  toSketch,
  toNew,
  onScope,
  onApply,
  onCancel,
}: PreferencesDialogProps) {
  return (
    <DialogFrame
      title="Preferences"
      action="OK"
      canApply={toSketch || toNew}
      onApply={onApply}
      onCancel={onCancel}
      wide
      // The swatches are shown as they will be on the sheet that is chosen, so
      // picking a dark paper shows the inks in what they are worth on it.
      bodyStyle={canvasTokens(prefs.colours) as CSSProperties}
      extra={
        <button type="button" className="dialog__button" onClick={() => onChange(DEFAULT_PREFS)}>
          Reset All
        </button>
      }
    >
      <Group label="Units:">
        <Row name="Angle">
          <Picks
            options={ANGLE_UNITS.map((one) => ({ value: one, label: ANGLE_NAMES[one] }))}
            value={prefs.units.angle}
            onPick={(angle) =>
              onChange({ ...prefs, units: { ...prefs.units, angle: angle as "degrees" } })
            }
          />
          <Places
            value={prefs.units.anglePlaces}
            onPick={(anglePlaces) => onChange({ ...prefs, units: { ...prefs.units, anglePlaces } })}
          />
        </Row>
        <Row name="Distance">
          <Picks
            options={DISTANCE_UNITS.map((one) => ({ value: one, label: one }))}
            value={prefs.units.distance}
            onPick={(distance) =>
              onChange({ ...prefs, units: { ...prefs.units, distance: distance as "cm" } })
            }
          />
          <Places
            value={prefs.units.distancePlaces}
            onPick={(distancePlaces) =>
              onChange({ ...prefs, units: { ...prefs.units, distancePlaces } })
            }
          />
        </Row>
        {/* A ratio and the value of a point are numbers with nothing after them. */}
        <Row name="Others">
          <span className="prefs__none">no unit</span>
          <Places
            value={prefs.units.otherPlaces}
            onPick={(otherPlaces) => onChange({ ...prefs, units: { ...prefs.units, otherPlaces } })}
          />
        </Row>
      </Group>

      <Group label="Colour:">
        {KINDS.map((kind) => (
          <Row key={kind.key} name={kind.name}>
            <Swatches
              value={prefs.colours[kind.key]}
              options={INKS}
              onPick={(token) =>
                onChange({ ...prefs, colours: { ...prefs.colours, [kind.key]: token } })
              }
            />
          </Row>
        ))}
        <Row name="Sheet">
          <Swatches
            value={prefs.colours.sheet}
            options={SHEETS}
            onPick={(sheet) => onChange({ ...prefs, colours: { ...prefs.colours, sheet } })}
          />
        </Row>
      </Group>

      <Group label="Text:">
        <Row name="Face">
          <Picks
            options={FONTS.map((one) => ({ value: one, label: one }))}
            value={prefs.text.font}
            onPick={(font) => onChange({ ...prefs, text: { ...prefs.text, font } })}
          />
        </Row>
        <Row name="Size">
          <Picks
            options={SIZES.map((one) => ({ value: `${one}`, label: `${one}` }))}
            value={`${prefs.text.size}`}
            onPick={(size) => onChange({ ...prefs, text: { ...prefs.text, size: Number(size) } })}
          />
        </Row>
      </Group>

      <Group label="Measure:">
        <div className="dialog__row">
          <Check
            label="Move a new reading's number with the figure"
            on={prefs.tieReadings === true}
            onToggle={(on) => onChange({ ...prefs, tieReadings: on })}
          />
        </div>
      </Group>

      <Group label="View:">
        <div className="dialog__row">
          <Check
            label="Allow zooming"
            on={prefs.zoom === true}
            onToggle={(on) => onChange({ ...prefs, zoom: on })}
          />
        </div>
      </Group>

      <Group label="Apply all of the above to:">
        <div className="dialog__row">
          <Check label="This Sketch" on={toSketch} onToggle={(on) => onScope({ toSketch: on })} />
          <Check label="New Sketches" on={toNew} onToggle={(on) => onScope({ toNew: on })} />
        </div>
      </Group>
    </DialogFrame>
  );
}

/** One box to tick, which is how every yes or no on this sheet is asked. */
function Check({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label className="dialog__radio">
      <input type="checkbox" checked={on} onChange={(event) => onToggle(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="dialog__group">
      <legend className="dialog__legend">{label}</legend>
      {children}
    </fieldset>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="prefs__row">
      <span className="prefs__row-name">{name}</span>
      <div className="prefs__controls">{children}</div>
    </div>
  );
}

function Picks({
  options,
  value,
  onPick,
}: {
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <select
      className="prefs__select"
      value={value}
      onChange={(event) => onPick(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Places({ value, onPick }: { value: number; onPick: (places: number) => void }) {
  return (
    <select
      className="prefs__select prefs__select--places"
      aria-label="Decimal places"
      value={`${value}`}
      onChange={(event) => onPick(Number(event.target.value))}
    >
      {PLACES.map((places) => (
        <option key={places} value={places}>
          {places === 0 ? "whole numbers" : places === 1 ? "1 place" : `${places} places`}
        </option>
      ))}
    </select>
  );
}

function Swatches({
  value,
  options,
  onPick,
}: {
  value: string;
  options: { name: string; token: string }[];
  onPick: (token: string) => void;
}) {
  return (
    <div className="prefs__swatches">
      {options.map((one) => (
        <Tooltip key={one.token} says={one.name}>
          <button
            type="button"
            className={`prefs__swatch${value === one.token ? " prefs__swatch--on" : ""}`}
            style={{ background: `var(${one.token})` }}
            aria-label={one.name}
            onClick={() => onPick(one.token)}
          />
        </Tooltip>
      ))}
    </div>
  );
}
