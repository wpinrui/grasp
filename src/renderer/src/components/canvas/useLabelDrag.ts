/** Labels are selected independently of their objects and dragged as a group. */
import { type PointerEvent, useRef } from "react";
import { LABEL_REACH } from "../../sketch/labelling";
import type { Position } from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";

interface LabelOffset {
  id: string;
  off: Position;
}

export interface Dragging {
  sketch: Sketch;
  tool: string;
  picked: string[];
  /** The visible labels, including their computed default offsets. */
  labels: () => LabelOffset[];
  editing: string | null;
  onCloseCaption: (next: string | null) => void;
  onLabelPick: (id: string | null, additive?: boolean) => void;
}

/** Stop the whole group when any label reaches its allowed distance from its object. */
function keptDelta(labels: LabelOffset[], by: Position): Position {
  const squared = by.x * by.x + by.y * by.y;
  if (squared === 0) return by;
  let portion = 1;
  for (const { off } of labels) {
    const dot = off.x * by.x + off.y * by.y;
    const room = Math.max(0, LABEL_REACH ** 2 - off.x ** 2 - off.y ** 2);
    portion = Math.min(portion, (-dot + Math.sqrt(dot * dot + squared * room)) / squared);
  }
  return { x: by.x * portion, y: by.y * portion };
}

export function useLabelDrag({
  sketch,
  tool,
  picked,
  labels,
  editing,
  onCloseCaption,
  onLabelPick,
}: Dragging) {
  const dragged = useRef<{
    id: string;
    labels: LabelOffset[];
    from: Position;
    moved: boolean;
  } | null>(null);

  function startLabelDrag(event: PointerEvent<HTMLSpanElement>, id: string, off: Position) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (tool === "arrow" && editing) onCloseCaption(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    const carrying =
      tool === "arrow" && picked.includes(id)
        ? labels().filter((label) => picked.includes(label.id))
        : [{ id, off }];
    dragged.current = {
      id,
      labels: carrying,
      from: { x: event.clientX, y: event.clientY },
      moved: false,
    };
  }

  function dragLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    if (!state) return;
    event.stopPropagation();
    const by = { x: event.clientX - state.from.x, y: event.clientY - state.from.y };
    if (!state.moved) {
      if (Math.hypot(by.x, by.y) < 3) return;
      state.moved = true;
      if (tool === "arrow" && !picked.includes(state.id)) onLabelPick(state.id, false);
      sketch.beginGesture();
    }
    const kept = keptDelta(state.labels, by);
    const offsets = new Map(
      state.labels.map(({ id, off }) => [id, { x: off.x + kept.x, y: off.y + kept.y }]),
    );
    const before = sketch.read();
    sketch.updateGesture({
      ...before,
      objects: before.objects.map((object) => {
        const off = offsets.get(object.id);
        return off ? { ...object, label: { ...object.label, off } } : object;
      }),
    });
  }

  function dropLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    dragged.current = null;
    if (!state) return;
    event.stopPropagation();
    if (state.moved) sketch.endGesture();
    else if (tool === "arrow") onLabelPick(state.id, true);
  }

  function cancelLabelDrag() {
    if (dragged.current?.moved) sketch.cancelGesture();
    dragged.current = null;
  }

  return { dragLabel, dropLabel, startLabelDrag, cancelLabelDrag };
}
