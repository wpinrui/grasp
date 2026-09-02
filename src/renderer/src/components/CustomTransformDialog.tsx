import { useState } from "react";
import { DialogFrame } from "./DialogFrame";
import "./CustomTransformDialog.css";

interface DefineDialogProps {
  onApply: (name: string) => void;
  onCancel: () => void;
}

/**
 * Define Custom Transform. The example is already selected, so the only thing
 * left to say is what to call it, which is also what the Transform menu will
 * call it.
 */
export function DefineTransformDialog({ onApply, onCancel }: DefineDialogProps) {
  const [name, setName] = useState("");
  const wanted = name.trim();

  return (
    <DialogFrame
      title="Define Custom Transform"
      action="Define"
      canApply={wanted !== ""}
      onApply={() => wanted !== "" && onApply(wanted)}
      onCancel={onCancel}
    >
      <label className="custom__row">
        <span className="custom__name">Name</span>
        <input
          className="custom__field"
          // biome-ignore lint/a11y/noAutofocus: the name is the only thing the dialog asks for
          autoFocus
          value={name}
          aria-label="Name"
          placeholder="Glide Reflect"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <p className="custom__note">
        It goes at the foot of the Transform menu. Select something else and choose it there to do
        the same thing to that.
      </p>
    </DialogFrame>
  );
}

interface EditDialogProps {
  transforms: { id: string; name: string }[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Edit Custom Transforms: rename one, or take it off the menu for good. */
export function EditTransformsDialog({ transforms, onRename, onDelete, onClose }: EditDialogProps) {
  return (
    <DialogFrame
      title="Edit Custom Transforms"
      action="Done"
      canApply
      onApply={onClose}
      onCancel={onClose}
    >
      {transforms.length === 0 ? (
        <p className="custom__note">Nothing defined yet.</p>
      ) : (
        transforms.map((one, nth) => (
          <div className="custom__row" key={one.id}>
            <span className="custom__key">{nth < 9 ? `Ctrl+${nth + 1}` : ""}</span>
            <input
              className="custom__field"
              value={one.name}
              aria-label="Name"
              onChange={(event) => onRename(one.id, event.target.value)}
            />
            <button
              type="button"
              className="custom__drop"
              aria-label={`Delete ${one.name}`}
              onClick={() => onDelete(one.id)}
            >
              Delete
            </button>
          </div>
        ))
      )}
      <p className="custom__note">
        Deleting one leaves whatever it has already made where it is. The images stay live: they
        still follow the figure the transform was shown on.
      </p>
    </DialogFrame>
  );
}
