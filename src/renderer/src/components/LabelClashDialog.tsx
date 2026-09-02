import { DialogFrame } from "./DialogFrame";

interface LabelClashDialogProps {
  /** The name that was typed, and what already answers to it. */
  name: string;
  holder: string;
  onFree: () => void;
  onBoth: () => void;
  onCancel: () => void;
}

/**
 * Two objects cannot end up sharing a name by accident, so a name already in
 * use asks what was meant: hand it over and put the other one back on the
 * automatic run, or let both answer to it on purpose.
 */
export function LabelClashDialog({
  name,
  holder,
  onFree,
  onBoth,
  onCancel,
}: LabelClashDialogProps) {
  return (
    <DialogFrame
      title="Name taken"
      action="Take the name"
      canApply
      onApply={onFree}
      onCancel={onCancel}
      extra={
        <button type="button" className="dialog__button" onClick={onBoth}>
          Keep both
        </button>
      }
    >
      <p className="dialog__about">
        {name} is already the name of {holder}.
      </p>
      <p className="dialog__about">
        Taking the name puts that one back on the automatic run, where it takes the next name going.
        Keeping both leaves two objects answering to {name}.
      </p>
    </DialogFrame>
  );
}
