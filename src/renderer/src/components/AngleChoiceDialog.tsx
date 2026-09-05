import { useState } from "react";
import { DialogFrame } from "./DialogFrame";
import "./AngleChoiceDialog.css";

/** One of the angles at the corner, ready to be named and picked. */
export interface AngleChoice {
  arms: [string, string];
  turn: number;
}

interface AngleChoiceDialogProps {
  /** What the corner is called, and what each arm is called. */
  corner: string;
  nameOf: (id: string) => string;
  choices: AngleChoice[];
  /** Whether the angle is being marked or measured, which is what the buttons say. */
  way: "mark" | "read";
  onPick: (arms: [string, string]) => void;
  /** Lights the angle up on the sheet while a row is chosen or under the pointer. */
  onShow: (arms: [string, string] | null) => void;
  onCancel: () => void;
  /** Where the click that asked landed, so the dialog comes up by the corner. */
  at: { x: number; y: number };
}

const keyOf = (arms: [string, string]) => arms.join("|");

/**
 * Which angle at a corner was meant. Two straight objects running out of a
 * point make one angle and need no asking; three make three, and a click on the
 * point alone does not say which. Dragging from one arm to the other says it
 * without a dialog, and this is for when the click came first.
 *
 * The reflex angles are not here. An angle is read the short way round and
 * turned over afterwards, from the mark's own panel or by asking for the number
 * a second time, which is how the reflex angle is reached everywhere else.
 */
export function AngleChoiceDialog({
  corner,
  nameOf,
  choices,
  way,
  onPick,
  onShow,
  onCancel,
  at,
}: AngleChoiceDialogProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const found = choices.find((choice) => keyOf(choice.arms) === chosen);

  return (
    <DialogFrame
      title={`Which angle at ${nameOf(corner)}?`}
      at={at}
      action={way === "mark" ? "Mark" : "Measure"}
      canApply={found !== undefined}
      onApply={() => found && onPick(found.arms)}
      onCancel={onCancel}
    >
      <div className="angles">
        {choices.map((choice) => {
          const key = keyOf(choice.arms);
          return (
            <button
              type="button"
              key={key}
              className={`angles__row${key === chosen ? " angles__row--chosen" : ""}`}
              onClick={() => {
                setChosen(key);
                onShow(choice.arms);
              }}
              onDoubleClick={() => onPick(choice.arms)}
              onPointerEnter={() => onShow(choice.arms)}
              onPointerLeave={() => onShow(found ? found.arms : null)}
            >
              <span className="angles__name">
                ∠{nameOf(choice.arms[0])}
                {nameOf(corner)}
                {nameOf(choice.arms[1])}
              </span>
              <span className="angles__turn">{choice.turn.toFixed(1)}°</span>
            </button>
          );
        })}
      </div>
    </DialogFrame>
  );
}
