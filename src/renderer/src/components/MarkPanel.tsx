import type { MouseEvent } from "react";
import { MOST_STROKES, type Position, type SketchMark } from "../sketch/model";
import {
  AngleIcon,
  BinIcon,
  EqualMarkIcon,
  FlipIcon,
  ParallelMarkIcon,
  ReflexIcon,
  RightAngleIcon,
  TickIcon,
} from "./icons";
import "./MarkPanel.css";

interface MarkPanelProps {
  mark: SketchMark;
  /** Where the mark is drawn, in screen pixels from the sheet's top left. */
  at: Position;
  onStrokes: (id: string, strokes: number) => void;
  onFlip: (id: string) => void;
  /** An angle mark swapping to the angle on the other side of its arms. */
  onReflex: (id: string) => void;
  /** An angle mark drawn as the square, or put back to arcs. */
  onSquare: (id: string, square: boolean) => void;
  /** Whether it is being drawn as the square right now. */
  square: boolean;
  /** Whether the path is free of the other kind of mark, so it can swap to it. */
  canSwap: boolean;
  onForm: (id: string, form: "equal" | "parallel") => void;
  onDelete: (id: string) => void;
}

const COUNTS = Array.from({ length: MOST_STROKES }, (_, nth) => nth + 1);

/**
 * The panel that opens on a mark: how many strokes it carries, which way its
 * arrowheads point, whether it says equal or parallel, and a way to take it
 * off. It opens where the mark is, so what it is about is never in doubt, and
 * everything it offers is one press away rather than a count to be clicked up
 * to.
 *
 * It rides above the sheet in screen pixels, so it keeps its size at every zoom
 * the way a label does, and it follows the mark when the figure moves.
 */
export function MarkPanel({
  mark,
  at,
  onStrokes,
  onFlip,
  onReflex,
  onSquare,
  onForm,
  onDelete,
  canSwap,
  square,
}: MarkPanelProps) {
  const angle = mark.form === "angle";
  // Bars read the same either way round, so there is nothing to turn.
  const turns = mark.form === "parallel";
  const form = angle ? "equal" : (mark.form as "equal" | "parallel");
  // A press must not reach the sheet: that would count as a click on the
  // canvas, which is what closes the panel.
  const hold = (event: MouseEvent) => event.preventDefault();

  return (
    <div
      className="mark-panel"
      style={{
        left: `${at.x}px`,
        top: `${at.y}px`,
        color: "var(--color-tool-marker)",
      }}
      onMouseDown={hold}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {turns && (
        <>
          <button
            type="button"
            className="mark-panel__button"
            aria-label="Turn the mark round"
            title="Turn the mark round"
            onClick={() => onFlip(mark.id)}
          >
            <FlipIcon />
          </button>
          <span className="mark-panel__split" />
        </>
      )}
      {angle && (
        <>
          <button
            type="button"
            className={`mark-panel__button${
              "reflex" in mark && mark.reflex ? " mark-panel__button--on" : ""
            }`}
            aria-label="Mark the reflex angle instead"
            title="Mark the reflex angle instead"
            onClick={() => onReflex(mark.id)}
          >
            <ReflexIcon />
          </button>
          <button
            type="button"
            className={`mark-panel__button${square ? " mark-panel__button--on" : ""}`}
            aria-label="Draw it as a right angle"
            title="Draw it as a right angle"
            onClick={() => onSquare(mark.id, !square)}
          >
            <RightAngleIcon />
          </button>
          <span className="mark-panel__split" />
        </>
      )}
      {COUNTS.map((strokes) => (
        <button
          type="button"
          key={strokes}
          className={`mark-panel__button${
            mark.strokes === strokes ? " mark-panel__button--on" : ""
          }`}
          aria-label={`${strokes}`}
          onClick={() => onStrokes(mark.id, strokes)}
        >
          {angle ? <AngleIcon strokes={strokes} /> : <TickIcon form={form} strokes={strokes} />}
        </button>
      ))}
      {!angle && canSwap && (
        <>
          <span className="mark-panel__split" />
          <button
            type="button"
            className="mark-panel__button"
            aria-label={form === "equal" ? "Make it parallel" : "Make it equal sides"}
            title={form === "equal" ? "Make it parallel" : "Make it equal sides"}
            onClick={() => onForm(mark.id, form === "equal" ? "parallel" : "equal")}
          >
            {form === "equal" ? <ParallelMarkIcon /> : <EqualMarkIcon />}
          </button>
        </>
      )}
      <span className="mark-panel__split" />
      <button
        type="button"
        className="mark-panel__button mark-panel__button--away"
        aria-label="Delete the mark"
        title="Delete the mark"
        onClick={() => onDelete(mark.id)}
      >
        <BinIcon />
      </button>
    </div>
  );
}
