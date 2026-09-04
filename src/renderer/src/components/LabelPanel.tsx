import { useState } from "react";
import "./LabelPanel.css";

export interface LabelRow {
  id: string;
  /**
   * What it is called now, whether that name was typed or handed out, and
   * empty where it has never been labelled and so has no name at all.
   */
  name: string;
  /** What kind of thing it is, for the row to say. */
  kind: string;
  shown: boolean;
  selected: boolean;
}

interface LabelPanelProps {
  rows: LabelRow[];
  onRename: (id: string, name: string) => void;
  onShow: (ids: string[], shown: boolean) => void;
  /** The row under the pointer, whose object the sheet lights up. */
  onSpot: (id: string | null) => void;
  /** Whether a point comes out with its label already showing. */
  labelNew: boolean;
  onLabelNew: (on: boolean) => void;
}

/** The kinds in the order they are listed, and what a group of them is called. */
const KINDS: [string, string][] = [
  ["point", "Points"],
  ["segment", "Segments"],
  ["ray", "Rays"],
  ["line", "Lines"],
  ["circle", "Circles"],
  ["arc", "Arcs"],
  ["fill", "Fills"],
  ["locus", "Loci"],
];

/**
 * Every object that can carry a name, gathered by kind in the order they were
 * built: what each one is called, and whether it is showing. Where a name came
 * from is not said, because it makes no difference to anything: a label keeps
 * whatever name it was given, typed or handed out. Clearing the box puts it
 * back on the run, which hands it the next name going.
 *
 * Showing labels happens in bulk here, by kind, by what is selected on the
 * sheet, or for the whole page, so a figure can be labelled without hunting
 * round the sheet for one object at a time.
 *
 * Nothing here changes the selection: naming things is not selecting them. A
 * row under the pointer lights its object up on the sheet, and a row whose
 * object is selected on the sheet is filled in, so the two stay legible
 * together without either taking the other over.
 */
export function LabelPanel({
  rows,
  onRename,
  onShow,
  onSpot,
  labelNew,
  onLabelNew,
}: LabelPanelProps) {
  /** The row being typed into. Held here so the list stays a plain list. */
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(null);
  const all = rows.map((row) => row.id);
  const chosen = rows.filter((row) => row.selected).map((row) => row.id);
  const groups = KINDS.map(([kind, title]) => ({
    title,
    rows: rows.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);
  // Anything whose kind is not on the list still gets a home.
  const rest = rows.filter((row) => !KINDS.some(([kind]) => kind === row.kind));
  if (rest.length > 0) groups.push({ title: "Other", rows: rest });

  return (
    <div className="labels">
      {/* Labelling as you build, rather than labelling afterwards: with this on
          every point that lands says its name straight away. */}
      <div className="labels__bulk">
        <span className="labels__bulk-of">Label new points</span>
        <button
          type="button"
          role="switch"
          aria-checked={labelNew}
          aria-label="Label new points"
          className={`labels__switch${labelNew ? " labels__switch--on" : ""}`}
          onClick={() => onLabelNew(!labelNew)}
        >
          <span className="labels__switch-knob" />
        </button>
      </div>

      <div className="labels__bulk">
        <span className="labels__bulk-of">Page</span>
        <button
          type="button"
          className="labels__action"
          disabled={rows.length === 0}
          onClick={() => onShow(all, true)}
        >
          Show
        </button>
        <button
          type="button"
          className="labels__action"
          disabled={rows.length === 0}
          onClick={() => onShow(all, false)}
        >
          Hide
        </button>
      </div>

      <div className="labels__bulk">
        <span className="labels__bulk-of">Selected</span>
        <button
          type="button"
          className="labels__action"
          disabled={chosen.length === 0}
          onClick={() => onShow(chosen, true)}
        >
          Show
        </button>
        <button
          type="button"
          className="labels__action"
          disabled={chosen.length === 0}
          onClick={() => onShow(chosen, false)}
        >
          Hide
        </button>
      </div>

      <div className="labels__list" onPointerLeave={() => onSpot(null)}>
        {groups.map((group) => {
          const ids = group.rows.map((row) => row.id);
          const showing = group.rows.filter((row) => row.shown).length;
          return (
            <div key={group.title}>
              <div className="labels__group">
                <span className="labels__group-name">{group.title}</span>
                <span className="labels__count">
                  {showing} of {group.rows.length}
                </span>
                <button
                  type="button"
                  className="labels__action labels__action--small"
                  onClick={() => onShow(ids, showing < group.rows.length)}
                >
                  {showing < group.rows.length ? "Show" : "Hide"}
                </button>
              </div>

              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className={`labels__row${row.selected ? " labels__row--selected" : ""}`}
                  onPointerEnter={() => onSpot(row.id)}
                >
                  <button
                    type="button"
                    className={`labels__eye${row.shown ? " labels__eye--on" : ""}`}
                    aria-label={row.shown ? "Hide this label" : "Show this label"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onShow([row.id], !row.shown);
                    }}
                  >
                    {row.shown ? "shown" : "hidden"}
                  </button>
                  {typing?.id === row.id ? (
                    <input
                      className="labels__name labels__name--typing"
                      // biome-ignore lint/a11y/noAutofocus: the click on the name asked for it
                      autoFocus
                      value={typing.text}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setTyping({ ...typing, text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setTyping(null);
                      }}
                      onBlur={() => {
                        if (typing.text.trim() !== row.name) onRename(row.id, typing.text.trim());
                        setTyping(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`labels__name${row.name ? "" : " labels__name--none"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setTyping({ id: row.id, text: row.name });
                      }}
                    >
                      {row.name || "—"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
