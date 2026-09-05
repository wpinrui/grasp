import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { WantedPage } from "../sketch/pages";
import { DialogFrame } from "./DialogFrame";
import "./DocumentOptionsDialog.css";

/** How tall a row is, which is what a drag counts in. */
const ROW = 28;

/** A row of the list: the page it stands for, and a key that survives reordering. */
interface Row extends WantedPage {
  key: string;
}

interface DocumentOptionsDialogProps {
  pages: { id: string; name: string }[];
  /** The page the window is showing, so the list opens on it. */
  activeId: string;
  tabs: boolean;
  /** Clicking a page in the list shows it, the way the reference does. */
  onShow: (id: string) => void;
  onApply: (wanted: WantedPage[], tabs: boolean) => void;
  onCancel: () => void;
}

let added = 0;

/**
 * Document Options: every page of the sketch in one list, to rename, reorder,
 * duplicate and remove.
 *
 * Nothing here touches the sketch until OK. That is what makes it safe to
 * remove a page from: Cancel leaves the document exactly as it was, which
 * matters when the thing being removed cannot be got back.
 */
export function DocumentOptionsDialog({
  pages,
  activeId,
  tabs,
  onShow,
  onApply,
  onCancel,
}: DocumentOptionsDialogProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    pages.map((page) => ({ key: page.id, id: page.id, name: page.name })),
  );
  const [chosen, setChosen] = useState(activeId);
  const [showing, setShowing] = useState(tabs);
  const [adding, setAdding] = useState(false);
  const drag = useRef<{ from: number; y: number } | null>(null);

  const at = rows.findIndex((row) => row.key === chosen);
  const row = rows[at];

  function rename(name: string) {
    setRows(rows.map((one) => (one.key === chosen ? { ...one, name } : one)));
  }

  function add(from?: string) {
    added += 1;
    const copy = from ? rows.find((one) => one.id === from) : undefined;
    const made: Row = {
      key: `new-${added}`,
      name: copy ? `${copy.name} copy` : `Page ${rows.length + 1}`,
      from,
    };
    // In after whichever page is chosen, which is where a new page belongs.
    setRows([...rows.slice(0, at + 1), made, ...rows.slice(at + 1)]);
    setChosen(made.key);
    setAdding(false);
  }

  function drop() {
    if (rows.length < 2) return;
    setRows(rows.filter((one) => one.key !== chosen));
    setChosen(rows[Math.max(0, at - 1)].key);
  }

  /** Press and drag a row to move the page in the sketch, as the reference does. */
  function startDrag(event: ReactPointerEvent<HTMLDivElement>, index: number) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: index, y: event.clientY };
  }

  function pullDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held) return;
    const moved = Math.round((event.clientY - held.y) / ROW);
    if (moved === 0) return;
    const to = Math.min(rows.length - 1, Math.max(0, held.from + moved));
    if (to === held.from) return;
    const next = rows.filter((_, nth) => nth !== held.from);
    next.splice(to, 0, rows[held.from]);
    setRows(next);
    drag.current = { from: to, y: held.y + (to - held.from) * ROW };
  }

  return (
    <DialogFrame
      title="Document Options"
      action="OK"
      canApply={rows.every((one) => one.name.trim() !== "")}
      onApply={() =>
        onApply(
          rows.map(({ key, ...want }) => ({ ...want, name: want.name.trim() })),
          showing,
        )
      }
      onCancel={onCancel}
      wide
    >
      <div className="docopts__list">
        {rows.map((one, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: a row of a list, picked and dragged rather than pressed
          // biome-ignore lint/a11y/useKeyWithClickEvents: the name field beside it takes the keyboard
          <div
            key={one.key}
            className={`docopts__row${one.key === chosen ? " docopts__row--on" : ""}`}
            onPointerDown={(event) => startDrag(event, index)}
            onPointerMove={pullDrag}
            onPointerUp={() => {
              drag.current = null;
            }}
            onClick={() => {
              setChosen(one.key);
              // An existing page comes up in the window behind the dialog.
              if (one.id) onShow(one.id);
            }}
          >
            <span className="docopts__name">{one.name}</span>
            {!one.id && <span className="docopts__new">{one.from ? "copy" : "new"}</span>}
          </div>
        ))}
      </div>

      <label className="docopts__field">
        <span className="docopts__label">Name</span>
        <input
          className="docopts__input"
          value={row?.name ?? ""}
          aria-label="Page name"
          disabled={!row}
          onChange={(event) => rename(event.target.value)}
        />
      </label>

      <div className="docopts__buttons">
        <div className="docopts__adder">
          <button type="button" className="docopts__action" onClick={() => setAdding(!adding)}>
            Add Page
          </button>
          {adding && (
            <>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: dismiss layer, the entries stay reachable */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: the entries are buttons and take the keyboard themselves */}
              <div className="docopts__dismiss" onClick={() => setAdding(false)} />
              <div className="docopts__menu">
                <button type="button" className="docopts__item" onClick={() => add()}>
                  Blank Page
                </button>
                {rows
                  .filter((one) => one.id)
                  .map((one) => (
                    <button
                      type="button"
                      key={one.key}
                      className="docopts__item"
                      onClick={() => add(one.id)}
                    >
                      Duplicate {one.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
        <button type="button" className="docopts__action" disabled={rows.length < 2} onClick={drop}>
          Delete Page
        </button>
      </div>

      <label className="docopts__tabs">
        <input type="checkbox" checked={showing} onChange={() => setShowing(!showing)} />
        <span>Show page tabs</span>
      </label>
      <p className="docopts__note">
        Nothing here happens until OK. Cancel leaves the sketch exactly as it was, which is the only
        way back from deleting a page.
      </p>
    </DialogFrame>
  );
}
