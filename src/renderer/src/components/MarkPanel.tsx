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
import { PanelButton, PanelShell, PanelSplit } from "./MarkPanelShell";

const MARKER_COLOUR = "var(--color-tool-marker)";

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
  const swapTo = form === "equal" ? "Make it parallel" : "Make it equal sides";

  return (
    <PanelShell at={at} colour={MARKER_COLOUR}>
      {turns && (
        <>
          <PanelButton
            label="Turn the mark round"
            tip="Turn the mark round"
            onClick={() => onFlip(mark.id)}
          >
            <FlipIcon />
          </PanelButton>
          <PanelSplit />
        </>
      )}
      {angle && (
        <>
          <PanelButton
            label="Mark the reflex angle instead"
            tip="Mark the reflex angle instead"
            on={"reflex" in mark && mark.reflex}
            onClick={() => onReflex(mark.id)}
          >
            <ReflexIcon />
          </PanelButton>
          <PanelButton
            label="Draw it as a right angle"
            tip="Draw it as a right angle"
            on={square}
            onClick={() => onSquare(mark.id, !square)}
          >
            <RightAngleIcon />
          </PanelButton>
          <PanelSplit />
        </>
      )}
      {COUNTS.map((strokes) => (
        <PanelButton
          key={strokes}
          label={`${strokes}`}
          // A count says what it is by the strokes drawn on it.
          tip=""
          on={mark.strokes === strokes}
          onClick={() => onStrokes(mark.id, strokes)}
        >
          {angle ? <AngleIcon strokes={strokes} /> : <TickIcon form={form} strokes={strokes} />}
        </PanelButton>
      ))}
      {!angle && canSwap && (
        <>
          <PanelSplit />
          <PanelButton
            label={swapTo}
            tip={swapTo}
            onClick={() => onForm(mark.id, form === "equal" ? "parallel" : "equal")}
          >
            {form === "equal" ? <ParallelMarkIcon /> : <EqualMarkIcon />}
          </PanelButton>
        </>
      )}
      <PanelSplit />
      <PanelButton
        label="Delete the mark"
        tip="Delete the mark"
        away
        onClick={() => onDelete(mark.id)}
      >
        <BinIcon />
      </PanelButton>
    </PanelShell>
  );
}
