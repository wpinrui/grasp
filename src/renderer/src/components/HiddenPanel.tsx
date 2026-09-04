import "./HiddenPanel.css";

export interface HiddenRow {
  id: string;
  /** What it is called, and empty where it has never been labelled. */
  name: string;
  /** What kind of thing it is, for the row to sit under. */
  kind: string;
}

/** The kinds that can be put away all at once rather than one at a time. */
export interface HiddenKinds {
  marks: boolean;
  text: boolean;
}

interface HiddenPanelProps {
  rows: HiddenRow[];
  /** Bring these back into view. */
  onShow: (ids: string[]) => void;
  /** The row under the pointer, whose object the sheet ghosts. */
  onSpot: (id: string | null) => void;
  /** Which whole kinds are being kept out of the way. */
  kinds: HiddenKinds;
  onKinds: (part: Partial<HiddenKinds>) => void;
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
  ["caption", "Captions"],
];

/**
 * Everything hidden on the page, gathered by kind, each with a way back. The
 * reference app has none of this: showing one of a dozen hidden objects there
 * means showing all of them and hiding the rest again by hand.
 *
 * Pointing at a row ghosts its object where it sits, since a name and a kind
 * are not enough to tell three hidden segments apart. Showing one does not
 * select it: the dock never changes what is selected.
 */
export function HiddenPanel({ rows, onShow, onSpot, kinds, onKinds }: HiddenPanelProps) {
  const groups = KINDS.map(([kind, title]) => ({
    title,
    rows: rows.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);
  // Anything whose kind is not on the list still gets a home.
  const rest = rows.filter((row) => !KINDS.some(([kind]) => kind === row.kind));
  if (rest.length > 0) groups.push({ title: "Other", rows: rest });

  return (
    <div className="hidden-panel">
      {/* Whole kinds put away at once. This is not hiding one thing at a time:
          an object put away here keeps whatever it was set to individually, and
          comes back the moment the switch goes off. */}
      {(
        [
          ["marks", "Markings"],
          ["text", "Text"],
        ] as [keyof HiddenKinds, string][]
      ).map(([kind, name]) => (
        <div className="hidden-panel__all" key={kind}>
          <span className="hidden-panel__all-of">Hide all {name.toLowerCase()}</span>
          <button
            type="button"
            role="switch"
            aria-checked={kinds[kind]}
            aria-label={`Hide all ${name.toLowerCase()}`}
            className={`hidden-panel__switch${kinds[kind] ? " hidden-panel__switch--on" : ""}`}
            onClick={() => onKinds({ [kind]: !kinds[kind] })}
          >
            <span className="hidden-panel__switch-knob" />
          </button>
        </div>
      ))}

      <div className="hidden-panel__list" onPointerLeave={() => onSpot(null)}>
        {groups.map((group) => (
          <div key={group.title}>
            <div className="hidden-panel__group">
              <span className="hidden-panel__group-name">{group.title}</span>
              <span className="hidden-panel__count">{group.rows.length}</span>
              <button
                type="button"
                className="hidden-panel__action hidden-panel__action--small"
                onClick={() => onShow(group.rows.map((row) => row.id))}
              >
                Show
              </button>
            </div>

            {group.rows.map((row) => (
              <div key={row.id} className="hidden-panel__row" onPointerEnter={() => onSpot(row.id)}>
                <span className="hidden-panel__name">{row.name || "—"}</span>
                <button
                  type="button"
                  className="hidden-panel__action hidden-panel__action--small"
                  onClick={() => onShow([row.id])}
                >
                  Show
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden-panel__foot">
        <button
          type="button"
          className="hidden-panel__action"
          disabled={rows.length === 0}
          onClick={() => onShow(rows.map((row) => row.id))}
        >
          Show all
        </button>
      </div>
    </div>
  );
}
