import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
import type { Naming, Reading } from "../sketch/measure";
import {
  isMeasurement,
  type Position,
  type SketchCalculation,
  type SketchFunction,
  type SketchMeasurement,
  type SketchParameter,
  type View,
} from "../sketch/model";
import { DEFAULT_CAPTION } from "./typeset";
import "./MeasurementBox.css";

/** Pointer travel that turns a press on a measurement into a drag. */
const DRAG_THRESHOLD = 3;

interface MeasurementBoxProps {
  /**
   * Anything written on the sheet as a name and what it comes to: a
   * measurement, a parameter, a calculation, or a function saying what it is.
   */
  measurement: SketchMeasurement | SketchParameter | SketchCalculation | SketchFunction;
  /** What it says now, worked out afresh every time the figure moves. */
  reading: Reading;
  view: View;
  scale: number;
  selected: boolean;
  /** Which tool is up: the Arrow carries it, the Text tool names it. */
  tool: string;
  /** Drawn faintly where it sits, for a hidden one the dock is pointing at. */
  ghost?: boolean;
  /**
   * The Measure tool is resting on what this was taken from, so a click there
   * comes to this one rather than laying another of it on top. Lit so that is
   * visible before the click.
   */
  lit?: boolean;
  /** A caption is open, so a press drops a link to this reading into it. */
  linking: boolean;
  onLink: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  onGrab: (id: string) => void;
  onDrag: (by: Position) => void;
  onDrop: () => void;
  /** The Text tool clicking it, which shows and hides its name. */
  onToggleLabel: (id: string) => void;
  onMeasure: (id: string, size: { width: number; height: number }) => void;
  /** The pointer coming onto the reading and leaving it again, so the sheet can
   * light up what it reads. */
  onHover?: (id: string | null) => void;
  /** The Measure tool clicking it, which opens the panel that says how it draws. */
  onOpen?: (id: string) => void;
  /** Double-clicking it, which opens that panel whatever tool is up. */
  onDoubleClick?: (id: string) => void;
}

/** One run of the reading, under whatever mark says what it names. */
function Run({ text, over }: Naming) {
  if (!over) return <span>{text}</span>;
  return <span className={`reading__over reading__over--${over}`}>{text}</span>;
}

function Runs({ parts }: { parts: Naming[] }) {
  return (
    <>
      {parts.map((part, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the runs are positional, and there is no id
        <Run key={index} text={part.text} over={part.over} />
      ))}
    </>
  );
}

/**
 * One measurement on the sheet: what it reads, and everything done to it.
 *
 * It hangs by a spot on the sheet, so it pans with the drawing, but it is drawn
 * over the sheet rather than in it, so it keeps its size at every zoom the way
 * a label does. The Arrow picks it up and drags it; the Text tool clicks it to
 * show and hide the name it goes by.
 */
export function MeasurementBox({
  measurement,
  reading,
  view,
  scale,
  selected,
  tool,
  ghost,
  lit,
  linking,
  onLink,
  onSelect,
  onGrab,
  onDrag,
  onDrop,
  onToggleLabel,
  onMeasure,
  onHover,
  onOpen,
  onDoubleClick,
}: MeasurementBoxProps) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: Position; moved: boolean } | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || ghost) return;
    // The whole box, padding and border included, since what reads it is
    // working out what the reading covers on the sheet.
    const observer = new ResizeObserver(() => {
      onMeasure(measurement.id, {
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [measurement.id, onMeasure, ghost]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // The sheet never sees a press that landed in a measurement.
    event.stopPropagation();
    // A caption is open: a press drops a link to the value into the sentence
    // rather than doing anything to the measurement itself.
    if (linking) {
      onLink(measurement.id);
      return;
    }
    // The Text tool deals in names, so a press with it shows or hides this
    // one's, the same way a press on any other object's label does.
    if (tool === "text") {
      onToggleLabel(measurement.id);
      return;
    }
    // The Arrow carries a reading about; the Measure tool opens its panel on a
    // click, and carries it about too, so neither has to be put down first.
    if (tool !== "arrow" && tool !== "measure") return;
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
      onGrab(measurement.id);
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
    // A press that went nowhere is a click. With the Measure tool up that opens
    // the reading's panel; otherwise it puts the measurement in or out of the
    // selection the way a click on anything else does.
    if (tool === "measure") {
      onOpen?.(measurement.id);
      return;
    }
    onSelect(measurement.id, event.shiftKey || event.ctrlKey);
  }

  // The Measure tool takes hold of a reading too, to open its panel on it.
  const held = tool === "arrow" || tool === "text" || tool === "measure";
  const shown = `reading${selected ? " reading--selected" : ""}${ghost ? " reading--ghost" : ""}${
    lit ? " reading--lit" : ""
  }`;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a box dragged around the sheet, not a control; what it holds is read as text
    <div
      ref={root}
      data-id={measurement.id}
      className={shown}
      style={{
        left: `${(measurement.x - view.x) * scale}px`,
        top: `${(measurement.y - view.y) * scale}px`,
        fontFamily: `"${measurement.font ?? DEFAULT_CAPTION.font}", serif`,
        fontSize: `${measurement.size ?? DEFAULT_CAPTION.size}pt`,
        color: `var(${measurement.colour ?? DEFAULT_CAPTION.colour})`,
        pointerEvents: held && !ghost ? "auto" : "none",
      }}
      onMouseEnter={ghost ? undefined : () => onHover?.(measurement.id)}
      onMouseLeave={ghost ? undefined : () => onHover?.(null)}
      onDoubleClick={ghost ? undefined : () => onDoubleClick?.(measurement.id)}
      onPointerDown={ghost ? undefined : startDrag}
      onPointerMove={ghost ? undefined : pullDrag}
      onPointerUp={ghost ? undefined : dropDrag}
    >
      {isMeasurement(measurement) && measurement.bare ? (
        <span className="reading__value">{reading.value}</span>
      ) : reading.fraction ? (
        <span className="reading__fraction">
          <span className="reading__top">
            <Runs parts={reading.fraction.top} />
          </span>
          <span className="reading__bottom">
            <Runs parts={reading.fraction.bottom} />
          </span>
        </span>
      ) : (
        <>
          <Runs parts={reading.lead} />
          <span className="reading__value"> = {reading.value}</span>
        </>
      )}
    </div>
  );
}
