/**
 * Dragging a name away from what it names.
 *
 * A label is held within reach of its object, so it can be moved out of the way
 * of the figure without coming adrift from the thing it belongs to. It is also
 * picked on its own: what it names is not picked with it, so the palette is set
 * on the label rather than on the object under it.
 *
 * The press stops at the label. Letting it reach the sheet would capture the
 * pointer there, and the drag that follows would move the figure instead.
 */

import { type PointerEvent, useRef } from "react";
import { LABEL_REACH } from "../../sketch/labelling";
import type { Position } from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";

/** What the sheet hands the label dragging: the page, and how it is armed. */
export interface Dragging {
  sketch: Sketch;
  /** The tool that is up, since only the Arrow picks a label as it takes it. */
  tool: string;
  /** The caption open to type into, which a label takes the palette from. */
  editing: string | null;
  /** Settle and put that caption away before the label takes its place. */
  onCloseCaption: (next: string | null) => void;
  onLabelPick: (id: string | null, additive?: boolean) => void;
}

export function useLabelDrag({ sketch, tool, editing, onCloseCaption, onLabelPick }: Dragging) {
  /** The label in hand: which one, where it sat, and where the press began. */
  const dragged = useRef<{ id: string; off: Position; from: Position } | null>(null);

  /** Drag a label about within its reach of what it names. */
  function moveLabel(id: string, off: Position) {
    const held = Math.hypot(off.x, off.y);
    const kept =
      held <= LABEL_REACH
        ? off
        : { x: (off.x / held) * LABEL_REACH, y: (off.y / held) * LABEL_REACH };
    const before = sketch.read();
    sketch.updateGesture({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id ? { ...object, label: { ...object.label, off: kept } } : object,
      ),
    });
  }

  function startLabelDrag(event: PointerEvent<HTMLSpanElement>, id: string, off: Position) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (tool === "arrow") {
      // A caption open to type into is what the bar is set on, so it is settled
      // and put away before a label takes its place: only one of the two is
      // ever the thing the palette is working on.
      if (editing) onCloseCaption(null);
      onLabelPick(id, event.shiftKey || event.ctrlKey);
      sketch.select([]);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = { id, off, from: { x: event.clientX, y: event.clientY } };
    sketch.beginGesture();
  }

  function dragLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    if (!state) return;
    event.stopPropagation();
    moveLabel(state.id, {
      x: state.off.x + (event.clientX - state.from.x),
      y: state.off.y + (event.clientY - state.from.y),
    });
  }

  /** A label put back exactly where it was is not a move, so it is not a step. */
  function dropLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    dragged.current = null;
    if (!state) return;
    event.stopPropagation();
    const moved =
      Math.abs(event.clientX - state.from.x) + Math.abs(event.clientY - state.from.y) > 0;
    if (moved) sketch.endGesture();
    else sketch.cancelGesture();
  }

  return { dragLabel, dropLabel, startLabelDrag };
}
