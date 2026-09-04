/**
 * The names beside the things they name. They ride above the sheet as HTML
 * rather than as SVG, so they keep their size on screen and can be typed into.
 *
 * A label is dragged and typed into by the two tools that deal in labels, and
 * is out of the way of every other tool. Double-clicking one turns it into the
 * box its name is typed in.
 */

import type { CSSProperties, PointerEvent } from "react";
import type { Position, View } from "../../../sketch/model";

/** One name as it is drawn: where it hangs, and how it is set. */
export interface DrawnLabel {
  id: string;
  name: string;
  at: Position;
  /** How far it has been dragged off what it names. */
  off: Position;
  look: CSSProperties;
}

/** The name being typed into, and what has been typed so far. */
export interface Naming {
  id: string;
  text: string;
}

interface LabelsProps {
  labels: DrawnLabel[];
  view: View;
  scale: number;
  /** Which labels the palette is set on, drawn as picked. */
  picked: string[];
  /** Whether a label is the pointer's to take, which only two tools make it. */
  reachable: boolean;
  naming: Naming | null;
  onNaming: (naming: Naming | null) => void;
  onRename: (id: string, name: string) => void;
  onGrab: (event: PointerEvent<HTMLElement>, id: string, off: Position) => void;
  onDrag: (event: PointerEvent<HTMLElement>) => void;
  onDrop: (event: PointerEvent<HTMLElement>) => void;
}

export function Labels({
  labels,
  view,
  scale,
  picked,
  reachable,
  naming,
  onNaming,
  onRename,
  onGrab,
  onDrag,
  onDrop,
}: LabelsProps) {
  return (
    <>
      {labels.map((label) => {
        const where = {
          left: `${(label.at.x - view.x) * scale + label.off.x}px`,
          top: `${(label.at.y - view.y) * scale + label.off.y}px`,
        };
        if (naming?.id === label.id) {
          return (
            <input
              key={label.id}
              className="canvas__label-input"
              style={where}
              // biome-ignore lint/a11y/noAutofocus: the double-click asked for it
              autoFocus
              value={naming.text}
              onChange={(event) => onNaming({ ...naming, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") onNaming(null);
              }}
              onBlur={() => {
                if (naming.text.trim() !== label.name) onRename(label.id, naming.text.trim());
                onNaming(null);
              }}
            />
          );
        }
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: a label is dragged and typed into, not pressed
          <span
            key={label.id}
            data-id={label.id}
            className={`canvas__label${picked.includes(label.id) ? " canvas__label--picked" : ""}`}
            style={{
              ...where,
              ...label.look,
              pointerEvents: reachable ? "auto" : "none",
            }}
            onPointerDown={(event) => onGrab(event, label.id, label.off)}
            onPointerMove={onDrag}
            onPointerUp={onDrop}
            onDoubleClick={() => onNaming({ id: label.id, text: label.name })}
          >
            {label.name}
          </span>
        );
      })}
    </>
  );
}
