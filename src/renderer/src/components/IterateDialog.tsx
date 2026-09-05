import { MAX_DEPTH } from "../sketch/iterate";
import { DialogFrame } from "./DialogFrame";
import "./TransformDialog.css";

interface IterateDialogProps {
  /** One row per seed, in the order they were selected. */
  targets: (string | null)[];
  /** The row a click on the sheet would fill. */
  active: number;
  depth: number;
  onDepth: (depth: number) => void;
  canApply: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function IterateDialog({
  targets,
  active,
  depth,
  onDepth,
  canApply,
  onApply,
  onCancel,
}: IterateDialogProps) {
  return (
    <DialogFrame
      title="Iterate"
      action="Iterate"
      canApply={canApply}
      onApply={onApply}
      onCancel={onCancel}
    >
      <fieldset className="dialog__group">
        <legend className="dialog__legend">Seed goes to:</legend>
        <div className="dialog__map">
          {targets.map((target, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its seed's place in the selection
              key={index}
              className={`dialog__row-map${index === active ? " dialog__row-map--active" : ""}`}
            >
              <span className="dialog__seed">Seed {index + 1}</span>
              <span className="dialog__arrow">&rarr;</span>
              <span className="dialog__target">{target ? `Image ${index + 1}` : "—"}</span>
            </div>
          ))}
        </div>
        <p className="dialog__picked">
          Click points on the sheet to say where each seed goes. Both ends are captioned on the
          sheet.
        </p>
      </fieldset>

      <fieldset className="dialog__group">
        <legend className="dialog__legend">Iterations:</legend>
        <div className="dialog__steps">
          <button
            type="button"
            className="dialog__step"
            aria-label="Fewer iterations"
            disabled={depth <= 1}
            onClick={() => onDepth(depth - 1)}
          >
            &minus;
          </button>
          <span className="dialog__count">{depth}</span>
          <button
            type="button"
            className="dialog__step"
            aria-label="More iterations"
            disabled={depth >= MAX_DEPTH}
            onClick={() => onDepth(depth + 1)}
          >
            +
          </button>
        </div>
      </fieldset>
    </DialogFrame>
  );
}
