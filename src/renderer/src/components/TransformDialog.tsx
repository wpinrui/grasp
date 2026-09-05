import type { TransformKind, TransformValues, TranslateValues } from "../sketch/transforms";
import { DialogFrame } from "./DialogFrame";
import "./TransformDialog.css";

const TITLES: Record<TransformKind, string> = {
  translate: "Translate",
  rotate: "Rotate",
  dilate: "Dilate",
  reflect: "Reflect",
};

interface TransformDialogProps {
  kind: TransformKind;
  values: TransformValues;
  onChange: (values: TransformValues) => void;
  /** What the sketch has marked, which says whether a Marked choice can be taken. */
  marked: { angle: boolean; ratio: boolean; distances: number };
  /** False while a field is empty, not a number, or an end is unpicked. */
  canApply: boolean;
  /** Whether the point to turn about, or the mirror, has been picked yet. */
  centred: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function TransformDialog({
  kind,
  values,
  onChange,
  marked,
  canApply,
  centred,
  onApply,
  onCancel,
}: TransformDialogProps) {
  const translate = values.translate;
  const setTranslate = (next: Partial<TranslateValues>) =>
    onChange({ ...values, translate: { ...translate, ...next } });

  return (
    <DialogFrame
      title={TITLES[kind]}
      action={TITLES[kind]}
      canApply={canApply}
      onApply={onApply}
      onCancel={onCancel}
    >
      {kind === "translate" && (
        <>
          <Group label="Translation Vector:">
            <div className="dialog__row">
              <Radio
                name="vector"
                label="Polar"
                checked={translate.mode === "polar"}
                onSelect={() => setTranslate({ mode: "polar" })}
              />
              <Radio
                name="vector"
                label="Rectangular"
                checked={translate.mode === "rectangular"}
                onSelect={() => setTranslate({ mode: "rectangular" })}
              />
              <Radio
                name="vector"
                label="Marked"
                checked={translate.mode === "marked"}
                onSelect={() => setTranslate({ mode: "marked" })}
              />
            </div>
          </Group>

          {translate.mode === "polar" && (
            <>
              <Group label="By:">
                <div className="dialog__row">
                  <Radio
                    name="by"
                    label="Fixed Distance"
                    checked={!translate.markedDistance}
                    onSelect={() => setTranslate({ markedDistance: false })}
                  />
                  <Radio
                    name="by"
                    label="Marked Distance"
                    checked={translate.markedDistance}
                    disabled={marked.distances === 0}
                    onSelect={() => setTranslate({ markedDistance: true })}
                  />
                </div>
                {translate.markedDistance ? (
                  <Picked filled={marked.distances > 0} what="distance" />
                ) : (
                  <Field
                    value={translate.distance}
                    unit="cm"
                    onChange={(distance) => setTranslate({ distance })}
                  />
                )}
              </Group>
              <Group label="At:">
                <div className="dialog__row">
                  <Radio
                    name="at"
                    label="Fixed Angle"
                    checked={!translate.markedAngle}
                    onSelect={() => setTranslate({ markedAngle: false })}
                  />
                  <Radio
                    name="at"
                    label="Marked Angle"
                    checked={translate.markedAngle}
                    disabled={!marked.angle}
                    onSelect={() => setTranslate({ markedAngle: true })}
                  />
                </div>
                {translate.markedAngle ? (
                  <Picked filled={marked.angle} what="angle" />
                ) : (
                  <Field
                    value={translate.angle}
                    unit="°"
                    onChange={(angle) => setTranslate({ angle })}
                  />
                )}
              </Group>
            </>
          )}

          {translate.mode === "rectangular" && (
            <>
              <Group label="By:">
                <div className="dialog__row">
                  <Radio
                    name="pair"
                    label="Fixed Distances"
                    checked={!translate.markedPair}
                    onSelect={() => setTranslate({ markedPair: false })}
                  />
                  <Radio
                    name="pair"
                    label="Marked Distances"
                    checked={translate.markedPair}
                    disabled={marked.distances < 2}
                    onSelect={() => setTranslate({ markedPair: true })}
                  />
                </div>
              </Group>
              {translate.markedPair ? (
                <Group label="Across and up:">
                  <Picked filled={marked.distances >= 2} what="pair of distances" />
                </Group>
              ) : (
                <>
                  <Group label="Horizontal:">
                    <Field
                      value={translate.horizontal}
                      unit="cm"
                      onChange={(horizontal) => setTranslate({ horizontal })}
                    />
                  </Group>
                  <Group label="Vertical:">
                    <Field
                      value={translate.vertical}
                      unit="cm"
                      onChange={(vertical) => setTranslate({ vertical })}
                    />
                  </Group>
                </>
              )}
            </>
          )}

          {translate.mode === "marked" && (
            <>
              <Group label="From:">
                <Picked filled={translate.from !== null} />
              </Group>
              <Group label="To:">
                <Picked filled={translate.to !== null} />
              </Group>
            </>
          )}
        </>
      )}

      {kind === "rotate" && (
        <Group label="Rotate By:">
          <div className="dialog__row">
            <Radio
              name="by"
              label="Fixed Angle"
              checked={!values.rotate.marked}
              onSelect={() => onChange({ ...values, rotate: { ...values.rotate, marked: false } })}
            />
            <Radio
              name="by"
              label="Marked Angle"
              checked={values.rotate.marked}
              disabled={!marked.angle}
              onSelect={() => onChange({ ...values, rotate: { ...values.rotate, marked: true } })}
            />
          </div>
          {values.rotate.marked ? (
            <Picked filled={marked.angle} what="angle" />
          ) : (
            <Field
              value={values.rotate.degrees}
              unit="degrees"
              onChange={(degrees) => onChange({ ...values, rotate: { ...values.rotate, degrees } })}
            />
          )}
        </Group>
      )}

      {kind === "dilate" && (
        <Group label="Dilate By:">
          <div className="dialog__row">
            <Radio
              name="by"
              label="Fixed Ratio"
              checked={!values.dilate.marked}
              onSelect={() => onChange({ ...values, dilate: { ...values.dilate, marked: false } })}
            />
            <Radio
              name="by"
              label="Marked Ratio"
              checked={values.dilate.marked}
              disabled={!marked.ratio}
              onSelect={() => onChange({ ...values, dilate: { ...values.dilate, marked: true } })}
            />
          </div>
          {values.dilate.marked ? (
            <Picked filled={marked.ratio} what="ratio" />
          ) : (
            /* New over old, written as a fraction the way the reference does. */
            <div className="dialog__ratio">
              <Field
                value={values.dilate.top}
                onChange={(top) => onChange({ ...values, dilate: { ...values.dilate, top } })}
              />
              <div className="dialog__rule" />
              <Field
                value={values.dilate.bottom}
                onChange={(bottom) => onChange({ ...values, dilate: { ...values.dilate, bottom } })}
              />
            </div>
          )}
        </Group>
      )}

      {kind === "reflect" && (
        <fieldset className="dialog__group">
          <legend className="dialog__legend">Mirror:</legend>
          <p className="dialog__picked">
            {centred
              ? "Across the object marked MIRROR on the sheet"
              : "Click a straight object to use as the mirror"}
          </p>
        </fieldset>
      )}

      {(kind === "rotate" || kind === "dilate") && (
        <p className="dialog__about">
          {centred
            ? "About the point marked CENTER on the sheet"
            : `Click a point to use as the ${kind === "rotate" ? "rotation" : "dilation"} center`}
        </p>
      )}
    </DialogFrame>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="dialog__group">
      <legend className="dialog__legend">{label}</legend>
      {children}
    </fieldset>
  );
}

interface RadioProps {
  name: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

function Radio({ name, label, checked, disabled, onSelect }: RadioProps) {
  return (
    <label className={`dialog__radio${disabled ? " dialog__radio--off" : ""}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect?.()}
      />
      <span>{label}</span>
    </label>
  );
}

interface FieldProps {
  value: string;
  unit?: string;
  onChange: (value: string) => void;
}

function Field({ value, unit, onChange }: FieldProps) {
  return (
    <div className="dialog__field">
      <input
        className="dialog__input"
        value={value}
        aria-label={unit ?? "value"}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
      {unit && <span className="dialog__unit">{unit}</span>}
    </div>
  );
}

/**
 * What was marked on the sheet rather than typed here. `what` names the thing
 * to click when nothing has been marked yet; without it the line asks for the
 * point a marked vector wants.
 */
function Picked({ filled, what }: { filled: boolean; what?: string }) {
  if (filled) return <p className="dialog__picked">Marked on the sheet</p>;
  return <p className="dialog__picked">Click {what ? `a ${what}` : "a point"} on the sheet</p>;
}
