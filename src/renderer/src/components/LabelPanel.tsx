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

/** What is being typed into a row, and what has been typed so far. */
interface Typing {
  id: string;
  text: string;
}

interface LineProps {
  row: LabelRow;
  /** Set while this row is the one being typed into. */
  typing: Typing | null;
  onTyping: (typing: Typing | null) => void;
  onRename: (id: string, name: string) => void;
  onShow: (ids: string[], shown: boolean) => void;
  onSpot: (id: string | null) => void;
}

/**
 * One name in the list: the eye that shows and hides it, and the name itself,
 * which turns into the box it is typed in when it is clicked.
 */
function Line({ row, typing, onTyping, onRename, onShow, onSpot }: LineProps) {
  return (
    <div
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
      {typing ? (
        <input
          className="labels__name labels__name--typing"
          // biome-ignore lint/a11y/noAutofocus: the click on the name asked for it
          autoFocus
          value={typing.text}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onTyping({ ...typing, text: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") onTyping(null);
          }}
          onBlur={() => {
            if (typing.text.trim() !== row.name) onRename(row.id, typing.text.trim());
            onTyping(null);
          }}
        />
      ) : (
        <button
          type="button"
          className="labels__name"
          onClick={(event) => {
            event.stopPropagation();
            onTyping({ id: row.id, text: row.name });
          }}
        >
          {row.name}
        </button>
      )}
    </div>
  );
}

/**
 * Everything that has a name, gathered by kind in the order it was built: what
 * each one is called, and whether it is showing. Where a name came from is not
 * said, because it makes no difference to anything: a label keeps whatever name
 * it was given, typed or handed out. Clearing the box puts it back on the run,
 * which hands it the next name going.
 *
 * What has never been named is not listed, since a row saying nothing is no use
 * to anyone. It is still counted by its heading and still reached by that
 * heading's Show button, which is how a figure is labelled in bulk.
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
  const [typing, setTyping] = useState<Typing | null>(null);
  /**
   * The groups folded away, by kind. Segments start folded: a figure is mostly
   * segments and hardly any of them are ever named, so open they would push the
   * points out of view.
   */
  const [folded, setFolded] = useState<Record<string, boolean>>({ segment: true });
  /**
   * The rows of a group that are listed: the named ones, and none of the rest.
   * Everything of that kind still counts towards the heading and still answers
   * to its Show button, which is how a nameless one comes to have a name.
   */
  const listed = (group: { kind: string; rows: LabelRow[] }) =>
    folded[group.kind] ? [] : group.rows.filter((row) => row.name !== "");
  const all = rows.map((row) => row.id);
  const chosen = rows.filter((row) => row.selected).map((row) => row.id);
  const groups = KINDS.map(([kind, title]) => ({
    kind,
    title,
    rows: rows.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);
  // Anything whose kind is not on the list still gets a home.
  const rest = rows.filter((row) => !KINDS.some(([kind]) => kind === row.kind));
  if (rest.length > 0) groups.push({ kind: "other", title: "Other", rows: rest });

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
                {/* The heading folds the group away, and says how many of that
                    kind are showing whether it is folded or not. */}
                <button
                  type="button"
                  className="labels__group-open"
                  aria-expanded={!folded[group.kind]}
                  onClick={() => setFolded((was) => ({ ...was, [group.kind]: !was[group.kind] }))}
                >
                  <span className={`caret caret--${folded[group.kind] ? "right" : "down"}`} />
                  <span className="labels__group-name">{group.title}</span>
                  <span className="labels__count">
                    {showing} of {group.rows.length}
                  </span>
                </button>
                <button
                  type="button"
                  className="labels__action labels__action--small"
                  onClick={() => onShow(ids, showing < group.rows.length)}
                >
                  {showing < group.rows.length ? "Show" : "Hide"}
                </button>
              </div>

              {listed(group).map((row) => (
                <Line
                  key={row.id}
                  row={row}
                  typing={typing?.id === row.id ? typing : null}
                  onTyping={setTyping}
                  onRename={onRename}
                  onShow={onShow}
                  onSpot={onSpot}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
