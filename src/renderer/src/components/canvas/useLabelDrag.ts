/** Labels are selected independently of their objects and dragged as a group. */
import { type PointerEvent, useRef } from "react";
import { LABEL_REACH } from "../../sketch/labelling";
import type { Position } from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";
import { DRAG_THRESHOLD } from "./sheet";

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

/**
 * How many times the reach limits are turned over before the sliding stops.
 * Pulling one label back in can carry another out, so one pass settles only
 * the last limit it applied; a handful walks a group most of the way in, and
 * `shortened` guarantees the rest.
 */
const REACH_PASSES = 4;

/**
 * The part of a move that leaves one label inside its reach of its object,
 * sliding it around the limit rather than stopping it dead against it.
 */
function withinReach(off: Position, by: Position): Position {
  const to = { x: off.x + by.x, y: off.y + by.y };
  const far = Math.hypot(to.x, to.y);
  if (far <= LABEL_REACH) return by;
  const pull = LABEL_REACH / far;
  return { x: to.x * pull - off.x, y: to.y * pull - off.y };
}

/**
 * The move pulled back along itself until it takes no label past its reach.
 * This is what holds the limit: sliding alone only settles the label it was
 * last applied to, and a group can be left with one still outside.
 */
function shortened(labels: LabelOffset[], by: Position): Position {
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

/**
 * How far the group may travel, as one delta so the labels keep their shape.
 * Every label ends inside its own reach, and one already at that limit slides
 * along it rather than sticking fast wherever it was let go.
 */
function keptDelta(labels: LabelOffset[], by: Position): Position {
  let kept = by;
  for (let pass = 0; pass < REACH_PASSES; pass += 1) {
    const settled = labels.reduce((so, { off }) => withinReach(off, so), kept);
    if (settled.x === kept.x && settled.y === kept.y) break;
    kept = settled;
  }
  return shortened(labels, kept);
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
      if (Math.hypot(by.x, by.y) < DRAG_THRESHOLD) return;
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
