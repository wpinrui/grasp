/**
 * The names beside the things they name. They ride above the sheet as HTML
 * rather than as SVG, so they keep their size on screen and can be typed into.
 *
 * Whether a label is the pointer's to take is the sheet's call, not this one's,
 * and is handed in. Double-clicking one turns it into the box its name is typed
 * in.
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
export interface LabelEdit {
  id: string;
  text: string;
}

interface LabelsProps {
  labels: DrawnLabel[];
  view: View;
  scale: number;
  /** Which labels the palette is set on, drawn as picked. */
  picked: string[];
  /**
   * Whether a label is the pointer's to take. The Text tool makes it so while
   * it is making captions, and the Arrow while it is armed for everything or
   * for writing. An Arrow armed for points or paths passes over a label the way
   * it passes over a caption, and a relabel run puts labels out of reach
   * altogether, so a click lands on the vertex one is sitting over.
   */
  reachable: boolean;
  /**
   * The name a vertex is about to be given, drawn where its label will hang so
   * that a relabel run says what a click would do before it is made. The label
   * it stands in for is left out of `labels` while this is up, so the two never
   * sit one on top of the other.
   */
  ghost?: DrawnLabel | null;
  naming: LabelEdit | null;
  onNaming: (naming: LabelEdit | null) => void;
  onRename: (id: string, name: string) => void;
  onGrab: (event: PointerEvent<HTMLElement>, id: string, off: Position) => void;
  onDrag: (event: PointerEvent<HTMLElement>) => void;
  onDrop: (event: PointerEvent<HTMLElement>) => void;
}

/** What a name is typed into, in place of the label, until it is settled. */
function NameBox({
  label,
  naming,
  where,
  onNaming,
  onRename,
}: {
  label: DrawnLabel;
  naming: LabelEdit;
  where: CSSProperties;
  onNaming: (naming: LabelEdit | null) => void;
  onRename: (id: string, name: string) => void;
}) {
  return (
    <input
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

export function Labels({
  labels,
  view,
  scale,
  picked,
  reachable,
  ghost,
  naming,
  onNaming,
  onRename,
  onGrab,
  onDrag,
  onDrop,
}: LabelsProps) {
  /** Where a label sits on screen: what it hangs from, moved by its own offset. */
  function whereOf(label: DrawnLabel) {
    return {
      left: `${(label.at.x - view.x) * scale + label.off.x}px`,
      top: `${(label.at.y - view.y) * scale + label.off.y}px`,
    };
  }

  return (
    <>
      {labels.map((label) => {
        const where = whereOf(label);
        if (naming?.id === label.id) {
          return (
            <NameBox
              key={label.id}
              label={label}
              naming={naming}
              where={where}
              onNaming={onNaming}
              onRename={onRename}
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

      {ghost && (
        <span
          className="canvas__label canvas__label--ghost"
          style={{ ...whereOf(ghost), ...ghost.look }}
        >
          {ghost.name}
        </span>
      )}
    </>
  );
}
