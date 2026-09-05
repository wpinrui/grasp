import { Fragment, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { HiddenIcon, SnapIcon, TagIcon } from "./icons";
import { TooltipChip } from "./Tooltip";
import "./Dock.css";

/** How wide the pane can be dragged, in pixels. */
const MIN_WIDTH = 168;
const MAX_WIDTH = 480;

/** The least of the pane's height a panel can be left with, in pixels. */
const MIN_HEIGHT = 90;

/** Where a button sits down the rail, matching the toolbox on the other side. */
const TOOL_PITCH = 50;
const RAIL_PADDING = 6;
const TOOLTIP_OFFSET = 3;

interface Panel {
  id: string;
  name: string;
  /** The key that opens it, where it has one. */
  key?: string;
  Icon: () => ReactNode;
}

/** The panels the rail can open, in the order their buttons run down it. */
export const PANELS: Panel[] = [
  { id: "labels", name: "Labels", key: "Alt+/", Icon: TagIcon },
  { id: "hidden", name: "Hidden", Icon: HiddenIcon },
  { id: "snap", name: "Snap", Icon: SnapIcon },
];

/** What a panel puts in the bar the dock draws for it, and what it holds. */
export interface Pane {
  /** The tally on the right of the bar. Left off when there is none. */
  count?: string;
  body: ReactNode;
}

interface DockProps {
  /** The panels showing, in any order. Empty with everything collapsed. */
  open: string[];
  /** Put a panel in or out of the stack. */
  onToggle: (id: string) => void;
  width: number;
  onWidth: (width: number) => void;
  /** Each panel's contents, by panel id. */
  panes: Record<string, Pane>;
}

/**
 * The rail down the right edge and the pane it opens. One button per panel:
 * pressing one adds its panel to the pane, pressing it again takes it out.
 * Several can be open at once, and they stack down the pane in the order their
 * buttons run down the rail. With everything collapsed only the rail is left
 * and the sheet has the width.
 *
 * A panel is a card over the window, with its own bar carrying its icon, its
 * name and its tally, so two of them read as two rather than as one list with a
 * heading in the middle. The edge between the pane and the sheet is a grip, and
 * so is the seam between two cards: the first sets the width they all share,
 * the second shares the height between the pair it sits between.
 */
export function Dock({ open, onToggle, width, onWidth, panes }: DockProps) {
  const drag = useRef<{ from: number; width: number } | null>(null);
  const seam = useRef<{ from: number; above: number; total: number; at: number } | null>(null);
  const stack = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  /**
   * What share of the pane each open panel has been dragged to, or null while
   * they share it evenly. Shares rather than heights, so the stack still fills
   * the pane when the window is resized or the pane is dragged wider.
   */
  const [shares, setShares] = useState<number[] | null>(null);
  const tip = hovered === null ? null : PANELS[hovered];
  // What was remembered may name a panel this build no longer has, and the
  // rail's order is the stack's order however they were opened.
  const showing = PANELS.filter((panel) => open.includes(panel.id));
  if (shares && shares.length !== showing.length) setShares(null);

  function grab(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: event.clientX, width };
  }

  function pull(event: PointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held) return;
    // The pane grows as the grip goes left, so the sheet gives up the room.
    const wanted = held.width + (held.from - event.clientX);
    onWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, wanted)));
  }

  /** The height every open panel has right now, measured off the sheet. */
  function measured(): number[] {
    const cards = stack.current?.querySelectorAll(".dock__panel");
    return [...(cards ?? [])].map((card) => card.getBoundingClientRect().height);
  }

  function grabSeam(event: PointerEvent<HTMLDivElement>, at: number) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const sizes = measured();
    seam.current = { from: event.clientY, above: sizes[at], total: sizes[at] + sizes[at + 1], at };
  }

  function pullSeam(event: PointerEvent<HTMLDivElement>) {
    const held = seam.current;
    if (!held) return;
    // The pair either side of the seam share what they had between them, so
    // nothing else in the stack moves.
    const above = Math.min(
      held.total - MIN_HEIGHT,
      Math.max(MIN_HEIGHT, held.above + (event.clientY - held.from)),
    );
    const sizes = measured();
    sizes[held.at] = above;
    sizes[held.at + 1] = held.total - above;
    const whole = sizes.reduce((sum, size) => sum + size, 0);
    setShares(whole > 0 ? sizes.map((size) => size / whole) : null);
  }

  return (
    <>
      {showing.length > 0 && (
        <div className="dock__pane" style={{ width: `${width}px` }} ref={stack}>
          <div
            className="dock__grip"
            onPointerDown={grab}
            onPointerMove={pull}
            onPointerUp={() => {
              drag.current = null;
            }}
          />
          {showing.map((panel, index) => {
            const pane = panes[panel.id];
            // Shares drive flex-grow against a zero basis, so whatever the
            // pane's height is now, the stack fills it in the ratio it was left.
            const share = shares?.length === showing.length ? shares[index] : null;
            return (
              <Fragment key={panel.id}>
                {index > 0 && (
                  <div
                    className="dock__seam"
                    onPointerDown={(event) => grabSeam(event, index - 1)}
                    onPointerMove={pullSeam}
                    onPointerUp={() => {
                      seam.current = null;
                    }}
                  >
                    <span className="dock__seam-handle" />
                  </div>
                )}
                <section
                  className="dock__panel"
                  style={share === null ? undefined : { flex: `${share} 1 0` }}
                >
                  <div className="dock__bar">
                    <span className="dock__bar-icon">
                      <panel.Icon />
                    </span>
                    <span className="dock__bar-name">{panel.name}</span>
                    {pane?.count !== undefined && (
                      <span className="dock__bar-count">{pane.count}</span>
                    )}
                  </div>
                  {pane?.body}
                </section>
              </Fragment>
            );
          })}
        </div>
      )}
      <div className="dock__rail">
        {PANELS.map((panel, index) => (
          <button
            type="button"
            key={panel.id}
            className={`dock__tool${open.includes(panel.id) ? " dock__tool--open" : ""}`}
            aria-label={panel.name}
            aria-pressed={open.includes(panel.id)}
            onClick={() => onToggle(panel.id)}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <panel.Icon />
          </button>
        ))}

        {/* The same tooltip the toolbox shows, on the other side of the rail. */}
        {tip && hovered !== null && (
          <TooltipChip
            className="tooltip--dock"
            says={tip.name}
            keys={tip.key}
            style={{ top: `${RAIL_PADDING + hovered * TOOL_PITCH + TOOLTIP_OFFSET}px` }}
          />
        )}
      </div>
    </>
  );
}
