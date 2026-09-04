import { useState } from "react";
import { canStartAt } from "../sketch/model";
import { DialogFrame } from "./DialogFrame";
import "./RelabelDialog.css";

interface RelabelDialogProps {
  /** Where the vertex was clicked, so the box comes up beside it. */
  at: { x: number; y: number };
  onStart: (from: string) => void;
  onCancel: () => void;
}

/**
 * What letter a relabel run starts at. It opens on the vertex that was clicked,
 * which takes that letter, and every vertex clicked after it takes the next one
 * going.
 */
export function RelabelDialog({ at, onStart, onCancel }: RelabelDialogProps) {
  const [from, setFrom] = useState("");
  const ready = canStartAt(from);

  return (
    <DialogFrame
      title="Relabel"
      action="Start"
      canApply={ready}
      at={at}
      onApply={() => ready && onStart(from)}
      onCancel={onCancel}
    >
      <label className="relabel__row">
        <span className="relabel__of">Start at</span>
        <input
          className="relabel__field"
          // biome-ignore lint/a11y/noAutofocus: the letter is all the box asks for
          autoFocus
          value={from}
          maxLength={1}
          aria-label="Start at"
          placeholder="A"
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <p className="dialog__about">
        Then click the vertices in the order you want them named. Switching tool ends it.
      </p>
    </DialogFrame>
  );
}
