import type { Expr, Quantity } from "../expression";
import type {
  Labelled,
  SketchArc,
  SketchCaption,
  SketchCircle,
  SketchInterior,
  SketchLine,
  SketchLocus,
  SketchPoint,
} from "./figures";
/** What a parameter is a number of, which is what it is written in. */
export const PARAMETER_UNITS = ["none", "angle", "distance"] as const;

export type ParameterUnit = (typeof PARAMETER_UNITS)[number];

/**
 * A parameter: a number the sketch simply holds. Nothing determines it, which
 * is what tells it apart from a measurement, so it is the one number you can
 * set and then vary to see what the rest of the figure does.
 *
 * `places` is how many decimal places were typed. It is both how far the number
 * is written out and how far the + and - keys step it, so typing 5.00 says
 * hundredths twice over: show me two places, and move me by a hundredth.
 */
export interface SketchParameter extends Labelled {
  id: string;
  kind: "parameter";
  value: number;
  unit: ParameterUnit;
  places: number;
  x: number;
  y: number;
  /** How it is set, where the text palette has said. */
  font?: string;
  size?: number;
}

/**
 * A calculation: an expression over the sketch's other numbers, worked out
 * afresh every time it is drawn. Like a measurement it holds no number of its
 * own, so dragging the figure moves it.
 */
export interface SketchCalculation extends Labelled {
  id: string;
  kind: "calculation";
  expression: Expr;
  x: number;
  y: number;
  font?: string;
  size?: number;
}

/**
 * What pressing an action button does. Each one is a thing you would otherwise
 * do through a menu, put on the sheet so it takes one press instead.
 */
export type ButtonAction =
  /**
   * Puts objects away and brings them back. A toggle reads the objects rather
   * than remembering: with all of them away it brings them back, and otherwise
   * it puts them away, so it is never out of step with what the sheet shows.
   */
  | { form: "hide-show"; of: string[]; does: "toggle" | "hide" | "show" }
  /** Goes to another page of this sketch. */
  | { form: "link"; page: string }
  /** Brings a point into view, in the middle of the window or at its corner. */
  | { form: "scroll"; point: string; to: "centre" | "corner" }
  /** Presses other buttons, all at once or one after another. */
  | { form: "present"; of: string[]; order: "together" | "in-turn" };

/**
 * An action button: a thing on the sheet you press to do something that would
 * otherwise take a menu. It sits where it is put and travels with the drawing,
 * the way a caption does.
 */
export interface SketchButton extends Labelled {
  id: string;
  kind: "button";
  /** What is written on it. */
  name: string;
  does: ButtonAction;
  x: number;
  y: number;
  font?: string;
  size?: number;
}

/**
 * A custom transform: a relationship shown by example rather than named. The
 * seed is the point it was shown on and the image is what that point became,
 * and applying it replays everything between them onto something else.
 *
 * It draws nothing. It lives among the objects so that it is saved, undone and
 * deleted like everything else: it goes when either of its two points goes.
 */
export interface SketchTransform extends Labelled {
  id: string;
  kind: "transform";
  /** What it is called, which is also what the Transform menu calls it. */
  name: string;
  seed: string;
  image: string;
}

/**
 * A function of one variable: an expression in x, which everything else can be
 * worked out at.
 *
 * A derivative holds no expression of its own. It holds the function it
 * differentiates and is worked out from that one every time it is read, so
 * editing the original carries straight through to it, and a derivative of a
 * derivative works the same way. That is also why a derivative cannot be edited
 * directly: there is nothing in it to edit.
 */
export interface SketchFunction extends Labelled {
  id: string;
  kind: "function";
  /** What was typed in the Calculator. Absent on a derivative. */
  body?: Expr;
  /** What it is the derivative of. Absent on one that was typed. */
  of?: string;
  x: number;
  y: number;
  font?: string;
  size?: number;
}

/**
 * A table: one column per number it was made from, and one row per capture.
 *
 * A row holds what those numbers came to at the moment it was taken, in the
 * sheet's own terms rather than in whatever units were being written at the
 * time, so switching the sketch from centimetres to millimetres reads the old
 * rows in millimetres too instead of leaving them lying. A cell that said
 * nothing when it was taken is held as nothing.
 *
 * The row that tracks the figure as it moves is not in here. It is worked out
 * where the table is drawn, so it is always current.
 */
export interface SketchTable extends Labelled {
  id: string;
  kind: "table";
  /** The values it reads, one column each, in the order they were picked. */
  of: string[];
  rows: (Quantity | null)[][];
  x: number;
  y: number;
  font?: string;
  size?: number;
}

/**
 * Where a tied reading's number hangs, in the frame of what it reads: how far
 * along that frame runs, and how far off it, both in sheet units. Where a
 * number sits beside a figure is a drawing convention rather than a part of the
 * figure, so the offset holds as the figure grows rather than growing with it.
 */
export interface ReadingSpot {
  along: number;
  across: number;
}

/** The Measure entries that read a geometric property off the figure. */
export const MEASURES = [
  "length",
  "distance",
  "perimeter",
  "circumference",
  "angle",
  "area",
  "arc-angle",
  "arc-length",
  "radius",
  "ratio",
  "value",
] as const;

export type MeasureKind = (typeof MEASURES)[number];

/**
 * A measurement: a number written on the sheet, saying what was measured and
 * what it comes to. It holds no value of its own. The value is worked out from
 * `of`, the objects it was taken from in the order they were picked, every time
 * it is drawn, so dragging the figure moves the number with it.
 *
 * Like a caption it hangs by a spot on the sheet, so it travels with the
 * drawing, and it is drawn over the sheet rather than in it, so it keeps its
 * size at every zoom the way a label does.
 */
export interface SketchMeasurement extends Labelled {
  id: string;
  kind: "measurement";
  measure: MeasureKind;
  /** What it reads, in the order those objects were picked. */
  of: string[];
  x: number;
  y: number;
  /** How it is set, where the text palette has said. */
  font?: string;
  size?: number;
  colour?: string;
  /**
   * Set on a reading that says only its number. The Measure tool writes those:
   * it was pointed at the thing, so the thing does not need naming again. A
   * measurement made from the Measure menu says what it is measuring first.
   */
  bare?: boolean;
  /**
   * Where the number hangs in the frame of what it reads, set on a reading that
   * is tied to its figure. Absent on one that stays where it was put, which
   * is what `x` and `y` alone mean. On a tied one `x` and `y` are worked out
   * from this every time the page settles, so the number goes wherever the
   * figure goes.
   */
  tied?: ReadingSpot;
  /**
   * How the segment a length is taken off is drawn out as a dimension: arrows
   * from end to end, broken by the number in the middle or running the whole
   * way with the number clear of them. Left off, only the number is drawn.
   */
  bounds?: "broken" | "full";
  /**
   * Whether dotted lines run from the ends of the segment out to the ends of
   * the arrows, which is what lets the whole dimension be dragged off the
   * segment and still say which segment it is about.
   */
  leaders?: boolean;
  /**
   * Set on an angle that is read the long way round, past a straight angle. The
   * angle between two arms is the small one; this is the rest of the turn.
   */
  reflex?: boolean;
  /**
   * How many decimal places this one reading is written to. Absent takes what
   * Preferences says for its kind, which is what nearly every reading does; the
   * panel sets this on the one reading that wants more or fewer.
   */
  places?: number;
}

/** How a caption and a measurement are set, which the text palette changes. */
export interface TextLook {
  font: string;
  size: number;
  colour: string;
}

/** What a mark says: the sides match, the sides are parallel, or this angle. */
export type MarkForm = "equal" | "parallel" | "angle";

/** The most strokes a mark can carry, which is what the mark panel offers. */
export const MOST_STROKES = 4;

/**
 * A mark: the ornament that says two sides are the same length, that two are
 * parallel, or that an angle is the one being talked about. It holds no place
 * of its own. A tick rides its path at `at`, the fraction of the way along it,
 * so it stays where it was put as the figure moves; an angle mark sits at the
 * corner its two sides share and is drawn between the arms running out to their
 * far ends. `strokes` is how many bars, arrows or arcs it carries, which is what
 * tells one pair of equal sides from the next.
 */
export type SketchMark = Labelled &
  (
    | {
        id: string;
        kind: "mark";
        form: "equal" | "parallel";
        path: string;
        at: number;
        strokes: number;
        /** Set when the arrowheads point against the way the path runs. */
        flipped?: boolean;
      }
    | {
        id: string;
        kind: "mark";
        form: "angle";
        corner: string;
        /** The far end of each side, which is where the arms point. */
        arms: [string, string];
        /** The two straight objects the angle is between. */
        sides: [string, string];
        strokes: number;
        /** Set when it marks the way round the long way, past a straight angle. */
        reflex?: boolean;
        /**
         * Whether it is drawn as the square a right angle is customarily drawn
         * with. Left off, a right angle draws as the square anyway and every
         * other angle draws as arcs, so this is only ever set to say otherwise.
         */
        square?: boolean;
        /** How far the arcs stand off the corner, in screen pixels. */
        radius?: number;
      }
  );

export type SketchObject =
  | SketchPoint
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchInterior
  | SketchLocus
  | SketchCaption
  | SketchMeasurement
  | SketchParameter
  | SketchCalculation
  | SketchTable
  | SketchFunction
  | SketchTransform
  | SketchButton
  | SketchMark;
