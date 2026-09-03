import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import type { Position, SketchTable, View } from "../sketch/model";
import { DEFAULT_CAPTION } from "./typeset";
import "./TableBox.css";

/** Pointer travel that turns a press on a table into a drag. */
const DRAG_THRESHOLD = 3;

interface TableBoxProps {
  table: SketchTable;
  /** The column headings, in the order the values were picked. */
  headings: string[];
  /** What was captured, oldest first, already written out. */
  rows: string[][];
  /** What the columns say right now, which is the row that tracks the figure. */
  live: string[];
  view: View;
  scale: number;
  selected: boolean;
  tool: string;
  /** Drawn faintly where it sits, for a hidden one the dock is pointing at. */
  ghost?: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onGrab: (id: string) => void;
  onDrag: (by: Position) => void;
  onDrop: () => void;
  /** Double-clicking takes a row, and with Shift down gives the last one back. */
  onCapture: (id: string) => void;
  onDropLast: (id: string) => void;
  /** How much of the sheet it covers, which is what a marquee needs. */
  onMeasure: (id: string, size: { width: number; height: number }) => void;
}

/**
 * One table on the sheet: a column for each number it was made from, a row for
 * each capture, and a last row that keeps up with the figure as it moves.
 *
 * It hangs by a spot on the sheet, so it travels with the drawing, and it keeps
 * its type size at every zoom the way a reading does.
 */
export function TableBox({
  table,
  headings,
  rows,
  live,
  view,
  scale,
  selected,
  tool,
  ghost,
  onSelect,
  onGrab,
  onDrag,
  onDrop,
  onCapture,
  onDropLast,
  onMeasure,
}: TableBoxProps) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: Position; moved: boolean } | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || ghost) return;
    const observer = new ResizeObserver(() => {
      onMeasure(table.id, { width: element.offsetWidth, height: element.offsetHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [table.id, onMeasure, ghost]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || tool !== "arrow") return;
    // The sheet never sees a press that landed in a table.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  function pullDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held) return;
    const dx = event.clientX - held.from.x;
    const dy = event.clientY - held.from.y;
    if (!held.moved) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      held.moved = true;
      onGrab(table.id);
    }
    onDrag({ x: dx / scale, y: dy / scale });
  }

  function dropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    drag.current = null;
    if (!held) return;
    event.stopPropagation();
    if (held.moved) {
      onDrop();
      return;
    }
    onSelect(table.id, event.shiftKey || event.ctrlKey);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a box dragged around the sheet, not a control; what it holds is a real table
    <div
      ref={root}
      data-id={table.id}
      className={`table-box${selected ? " table-box--selected" : ""}${ghost ? " table-box--ghost" : ""}`}
      style={{
        left: `${(table.x - view.x) * scale}px`,
        top: `${(table.y - view.y) * scale}px`,
        fontFamily: `"${table.font ?? DEFAULT_CAPTION.font}", serif`,
        fontSize: `${table.size ?? DEFAULT_CAPTION.size}pt`,
        color: `var(${table.colour ?? DEFAULT_CAPTION.colour})`,
        pointerEvents: tool === "arrow" && !ghost ? "auto" : "none",
      }}
      onPointerDown={ghost ? undefined : startDrag}
      onPointerMove={ghost ? undefined : pullDrag}
      onPointerUp={ghost ? undefined : dropDrag}
      // A row is quicker to take by double-clicking the table than by opening
      // the dialog for it, and Shift hands the last one back the same way.
      onDoubleClick={
        ghost ? undefined : (event) => (event.shiftKey ? onDropLast(table.id) : onCapture(table.id))
      }
    >
      <table className="table-box__grid">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, nth) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two captures can read the same
            <tr key={nth}>
              {row.map((cell, column) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a column is a position, not a name
                <td key={column}>{cell}</td>
              ))}
            </tr>
          ))}
          {/* The row that keeps up with the figure. It is worked out rather
              than captured, so it is never one of the rows above. */}
          <tr className="table-box__live">
            {live.map((cell, column) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is a position, not a name
              <td key={column}>{cell}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
