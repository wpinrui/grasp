import { useState } from "react";
import { DialogFrame } from "./DialogFrame";
import "./TableDataDialog.css";

/** What Add Table Data was told to do. */
export type AddTableData =
  | { kind: "one" }
  /** Collect rows as the numbers change: how many, and how fast at most. */
  | { kind: "watch"; rows: number; perSecond: number };

interface AddDialogProps {
  onApply: (wanted: AddTableData) => void;
  onCancel: () => void;
}

/** A number typed into one of the small fields, held as it is typed. */
function useNumber(start: number) {
  const [typed, setTyped] = useState(`${start}`);
  const value = Number(typed);
  const good = typed.trim() !== "" && Number.isFinite(value) && value > 0;
  return { typed, setTyped, value, good };
}

/**
 * Add Table Data. One row now, or rows collected as the figure moves.
 *
 * The reference app stops at 25 rows a go and tells you to come back for more.
 * That is its own limit rather than anything about a table, so this takes the
 * number asked for.
 */
export function AddTableDataDialog({ onApply, onCancel }: AddDialogProps) {
  const [watching, setWatching] = useState(false);
  const rows = useNumber(10);
  const rate = useNumber(2);
  const good = !watching || (rows.good && rate.good);

  return (
    <DialogFrame
      title="Add Table Data"
      action="Add"
      canApply={good}
      onApply={() =>
        onApply(
          watching
            ? { kind: "watch", rows: Math.round(rows.value), perSecond: rate.value }
            : { kind: "one" },
        )
      }
      onCancel={onCancel}
    >
      <label className="tabledata__choice">
        <input type="radio" checked={!watching} onChange={() => setWatching(false)} />
        <span>Add one entry now</span>
      </label>

      <label className="tabledata__choice">
        <input type="radio" checked={watching} onChange={() => setWatching(true)} />
        <span>Add entries as values change</span>
      </label>

      <div className={`tabledata__how${watching ? "" : " tabledata__how--off"}`}>
        <label className="tabledata__field">
          <input
            className="tabledata__number"
            value={rows.typed}
            disabled={!watching}
            inputMode="numeric"
            aria-label="How many entries"
            onChange={(event) => rows.setTyped(event.target.value)}
          />
          <span>entries</span>
        </label>
        <label className="tabledata__field">
          <span>at</span>
          <input
            className="tabledata__number"
            value={rate.typed}
            disabled={!watching}
            inputMode="decimal"
            aria-label="How many a second"
            onChange={(event) => rate.setTyped(event.target.value)}
          />
          <span>a second</span>
        </label>
      </div>

      <p className="tabledata__note">
        {watching
          ? "Collecting starts when you close this and stops when it has them all. Drag the figure to make the numbers move."
          : "Double-clicking a table takes a row as well."}
      </p>
    </DialogFrame>
  );
}

interface RemoveDialogProps {
  /** How many captures there are, so the dialog can say what it would take. */
  rows: number;
  onApply: (all: boolean) => void;
  onCancel: () => void;
}

/** Remove Table Data: the last capture, or all of them. */
export function RemoveTableDataDialog({ rows, onApply, onCancel }: RemoveDialogProps) {
  const [all, setAll] = useState(false);

  return (
    <DialogFrame
      title="Remove Table Data"
      action="Remove"
      canApply={rows > 0}
      onApply={() => onApply(all)}
      onCancel={onCancel}
    >
      <label className="tabledata__choice">
        <input type="radio" checked={!all} onChange={() => setAll(false)} />
        <span>Remove last entry</span>
      </label>
      <label className="tabledata__choice">
        <input type="radio" checked={all} onChange={() => setAll(true)} />
        <span>Remove all entries</span>
      </label>
      <p className="tabledata__note">
        {rows === 0
          ? "There is nothing in it yet. The last row keeps up with the figure; it is not a capture."
          : `${rows} ${rows === 1 ? "entry" : "entries"} captured. Shift and a double-click takes the last one too.`}
      </p>
    </DialogFrame>
  );
}
