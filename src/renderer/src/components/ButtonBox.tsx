import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import type { Position, SketchButton, View } from "../sketch/model";
import { DEFAULT_CAPTION } from "./typeset";
import "./ButtonBox.css";

/** Pointer travel that turns a press on a button into a drag. */
const DRAG_THRESHOLD = 3;

interface ButtonBoxProps {
  button: SketchButton;
  view: View;
  scale: number;
  selected: boolean;
  tool: string;
  /** Drawn faintly where it sits, for a hidden one the dock is pointing at. */
  ghost?: boolean;
  /** Pressing it, which is what it is for. */
  onPress: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onGrab: (id: string) => void;
  onDrag: (by: Position) => void;
  onDrop: () => void;
  onMeasure: (id: string, size: { width: number; height: number }) => void;
}

/**
 * One action button on the sheet.
 *
 * A plain press runs it, which is the whole point of it being there. Holding
 * Shift or Ctrl picks it up into the selection instead, which is how one is
 * gathered for a Presentation button or renamed, and a drag moves it. It hangs
 * by a spot on the sheet and keeps its type size at every zoom, the way a
 * reading does.
 */
export function ButtonBox({
  button,
  view,
  scale,
  selected,
  tool,
  ghost,
  onPress,
  onSelect,
  onGrab,
  onDrag,
  onDrop,
  onMeasure,
}: ButtonBoxProps) {
  const root = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ from: Position; moved: boolean } | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || ghost) return;
    const observer = new ResizeObserver(() => {
      onMeasure(button.id, { width: element.offsetWidth, height: element.offsetHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [button.id, onMeasure, ghost]);

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || tool !== "arrow") return;
    // The sheet never sees a press that landed on a button.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  function pullDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const held = drag.current;
    if (!held) return;
    const dx = event.clientX - held.from.x;
    const dy = event.clientY - held.from.y;
    if (!held.moved) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      held.moved = true;
      onGrab(button.id);
    }
    onDrag({ x: dx / scale, y: dy / scale });
  }

  function dropDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const held = drag.current;
    drag.current = null;
    if (!held) return;
    event.stopPropagation();
    if (held.moved) {
      onDrop();
      return;
    }
    if (event.shiftKey || event.ctrlKey) {
      onSelect(button.id, true);
      return;
    }
    onPress(button.id);
  }

  return (
    <button
      type="button"
      ref={root}
      data-id={button.id}
      className={`action-button${selected ? " action-button--selected" : ""}${ghost ? " action-button--ghost" : ""}`}
      style={{
        left: `${(button.x - view.x) * scale}px`,
        top: `${(button.y - view.y) * scale}px`,
        fontFamily: `"${button.font ?? DEFAULT_CAPTION.font}", serif`,
        fontSize: `${button.size ?? DEFAULT_CAPTION.size}pt`,
        color: `var(${button.colour ?? DEFAULT_CAPTION.colour})`,
        pointerEvents: tool === "arrow" && !ghost ? "auto" : "none",
      }}
      onPointerDown={ghost ? undefined : startDrag}
      onPointerMove={ghost ? undefined : pullDrag}
      onPointerUp={ghost ? undefined : dropDrag}
    >
      {button.name}
    </button>
  );
}
