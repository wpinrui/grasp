/**
 * What a page holds, and the geometry the canvas needs to hit-test it.
 *
 * Objects are stored in sheet coordinates: pixels on a sheet with no edges, y
 * downward. The canvas is a window onto it, `view` is the sheet point at the
 * window's top left corner and `scale` is screen pixels per sheet pixel, so
 * screen = (sheet - view) * scale.
 *
 * A dot keeps its size on screen at every zoom, so the sheet it covers, and
 * with it the reach of a click, is its drawn radius divided by the scale.
 *
 * A point is either free, and can be dragged, or an image with a `from` saying
 * how its parents place it. A line is never free: its `span` says which points
 * and lines put it where it is. Parents always come earlier in the list than
 * what hangs off them, so one pass down settles the whole page.
 */

import type { CSSProperties } from "react";
import { dependsOn, differentiate, type Expr, type Quantity } from "./expression";

/** Display > Point Style, smallest first. */
export const POINT_SIZES = ["dot", "small", "medium", "large"] as const;

export type PointSize = (typeof POINT_SIZES)[number];

/** Drawn radius per size, in canvas pixels. */
export const POINT_RADII: Record<PointSize, number> = {
  dot: 2,
  small: 3.25,
  medium: 4.5,
  large: 6.5,
};

/** The size a point is born at. */
export const DEFAULT_POINT_SIZE: PointSize = "medium";

/**
 * How an image is worked out from its parents. A point without one is free and
 * can be dragged; a point with one follows what it came from.
 */
/**
 * What a transform follows, where it was told to follow something rather than
 * given a number. The number is kept beside it as what it last came to, so a
 * transform that was given a plain number carries none of this and reads the
 * same as it always did.
 *
 * Following rather than holding is the whole point of marking: rotate by the
 * angle ABC and the image turns as A, B and C move, where rotating by 45
 * degrees never changes.
 */
export type MarkedAngle =
  /**
   * Three points: one on the first arm, the corner, one on the second. An angle
   * marker and a pair of straight objects meeting at a point both come down to
   * this, and are turned into it where they are marked, so there is one shape
   * here rather than three that mean the same.
   */
  | { kind: "points"; a: string; corner: string; b: string }
  /** A measurement, parameter or calculation that is an angle. */
  | { kind: "value"; of: string };

export type MarkedRatio =
  /** Two segments, the first over the second. */
  | { kind: "segments"; top: string; bottom: string }
  /** Three points along a line: the signed AC over AB. */
  | { kind: "points"; a: string; b: string; c: string }
  /** A measurement, parameter or calculation with no units. */
  | { kind: "value"; of: string };

export type MarkedVector =
  /** Tail and head. */
  | { kind: "points"; from: string; to: string }
  /** A distance value across, and another one up. */
  | { kind: "distances"; horizontal: string; vertical: string }
  /** How far, and which way. Either half can be marked on its own. */
  | { kind: "polar"; distance?: string; angle?: MarkedAngle };

export type Derivation =
  | { kind: "translate"; of: string; dx: number; dy: number; by?: MarkedVector }
  | { kind: "rotate"; of: string; centre: string; degrees: number; by?: MarkedAngle }
  | { kind: "dilate"; of: string; centre: string; ratio: number; by?: MarkedRatio }
  | { kind: "midpoint"; of: string; and: string }
  | { kind: "cross"; of: string; and: string; pick?: number }
  | { kind: "reflect"; of: string; mirror: string }
  | { kind: "on"; path: string; at: number };

/** What an image hangs off. It goes when any of them goes. */
/** What a marked angle is read off, so an image goes when any of it goes. */
export function partsOfAngle(angle: MarkedAngle): string[] {
  return angle.kind === "points" ? [angle.a, angle.corner, angle.b] : [angle.of];
}

export function partsOfRatio(ratio: MarkedRatio): string[] {
  if (ratio.kind === "segments") return [ratio.top, ratio.bottom];
  if (ratio.kind === "points") return [ratio.a, ratio.b, ratio.c];
  return [ratio.of];
}

export function partsOfVector(vector: MarkedVector): string[] {
  if (vector.kind === "points") return [vector.from, vector.to];
  if (vector.kind === "distances") return [vector.horizontal, vector.vertical];
  return [
    ...(vector.distance ? [vector.distance] : []),
    ...(vector.angle ? partsOfAngle(vector.angle) : []),
  ];
}

export function parentsOf(from: Derivation): string[] {
  if (from.kind === "on") return [from.path];
  if (from.kind === "midpoint" || from.kind === "cross") return [from.of, from.and];
  if (from.kind === "reflect") return [from.of, from.mirror];
  // A transform that follows something hangs off that too, so deleting an end
  // of a marked vector takes every image translated by it.
  if (from.kind === "translate") {
    return [from.of, ...(from.by ? partsOfVector(from.by) : [])];
  }
  if (from.kind === "rotate") {
    return [from.of, from.centre, ...(from.by ? partsOfAngle(from.by) : [])];
  }
  return [from.of, from.centre, ...(from.by ? partsOfRatio(from.by) : [])];
}

/**
 * What an object's label is doing. A name that was typed is pinned and stays
 * put; without one the object takes its turn in the automatic run for its kind.
 * `off` is where the label sits from what it names, in screen pixels.
 */
export interface LabelState {
  name?: string;
  shown?: boolean;
  off?: Position;
  /**
   * How the label is set, where the palette has said. Each is absent until it
   * is set, and an absent one takes what `DEFAULT_LABEL` says, or, for the ink,
   * whatever a label is drawn in by default.
   */
  font?: string;
  size?: number;
  colour?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** How a label is set until the palette says otherwise: the way geometry is set in print. */
export const DEFAULT_LABEL = {
  font: "Times New Roman",
  size: 16,
  bold: true,
  italic: true,
  underline: false,
};

/**
 * What every object carries about how it shows: its label, and whether it is
 * hidden. A hidden object is not drawn, picked, snapped to or caught by a
 * marquee, and its label goes with it, but it keeps its place in the figure and
 * everything built on it stays where it is.
 */
/** How thick a stroked object is drawn. */
export const LINE_WIDTHS = ["hairline", "thin", "medium", "thick"] as const;
export type LineWidth = (typeof LINE_WIDTHS)[number];

/** How a stroked object is dashed, if at all. */
export const LINE_PATTERNS = ["solid", "dashed", "dotted"] as const;
export type LinePattern = (typeof LINE_PATTERNS)[number];

export interface Labelled {
  label?: LabelState;
  hidden?: boolean;
  /** The name of the colour token it is drawn in. Absent takes the default. */
  colour?: string;
  /**
   * How heavy its stroke is. Named weight rather than width because a caption
   * already has a width, which is how wide its box is dragged.
   */
  weight?: LineWidth;
  /** Solid unless it says otherwise. A fill and a point have no pattern. */
  pattern?: LinePattern;
}

export interface SketchPoint extends Labelled {
  id: string;
  kind: "point";
  x: number;
  y: number;
  size: PointSize;
  /** Set on an image. Absent on a point that was plotted by hand. */
  from?: Derivation;
}

/**
 * The run of names each kind of object takes its turn in, after the reference
 * app: points through the capitals, straight objects through the letters from
 * j, and everything else a letter and a number. A run of letters wraps: the
 * name after Z is A again, so a figure with twenty-seven points has two called
 * A rather than one called A1. Two objects sharing a name is allowed and
 * nothing is keyed by one, so nothing is damaged by it.
 */
const RUNS: Record<string, { letters?: string; stem?: string }> = {
  point: { letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  line: { letters: "jklmnopqrstuvwxyz" },
  circle: { stem: "c" },
  arc: { stem: "a" },
  polygon: { stem: "P" },
  disc: { stem: "C" },
  wedge: { stem: "A" },
  locus: { stem: "L" },
  measurement: { stem: "m" },
  parameter: { stem: "t" },
  calculation: { stem: "c" },
  table: { stem: "T" },
  function: { letters: "fgh" },
};

/** Which run an object takes its name from, or null when it can carry none. */
function runFor(object: SketchObject, objects: SketchObject[]): string | null {
  // A caption says what it says. It is not named, so it is not in any run.
  if (isCaption(object)) return null;
  // A custom transform is called whatever it was named when it was defined.
  if (isTransform(object)) return null;
  // So is a button: its name is written on it.
  if (isButton(object)) return null;
  // A mark is an ornament. It says what it says by how it is drawn, so it
  // carries no name and takes no turn in any run.
  if (isMark(object)) return null;
  if (isMeasurement(object)) return "measurement";
  if (isParameter(object)) return "parameter";
  if (isCalculation(object)) return "calculation";
  if (isTable(object)) return "table";
  // A derivative is not given a letter of its own. It is called after what it
  // differentiates, with a tick, once the run has named that one.
  if (isFunction(object)) return object.of === undefined ? "function" : null;
  if (isPoint(object)) return "point";
  if (isLine(object)) return "line";
  if (isCircle(object)) return "circle";
  if (isArc(object)) return "arc";
  if (isInterior(object)) {
    if (cornersOf(object)) return "polygon";
    return wedgeOf(object) ? "wedge" : "disc";
  }
  // A locus has one place to be named at only when it draws a curve of points.
  const driven = objects.find((candidate) => candidate.id === object.driven);
  return driven && isPoint(driven) ? "locus" : null;
}

/** The nth name of a run, counting from zero. A run of letters wraps at its end. */
function nameInRun(run: string, nth: number): string {
  const { letters, stem } = RUNS[run] ?? {};
  if (!letters) return `${stem ?? "x"}${nth + 1}`;
  return letters[nth % letters.length];
}

/**
 * How many names a run has before it comes back round to its first. A stem run
 * counts on for ever, so it never comes back round at all.
 */
function lapOf(run: string): number {
  return RUNS[run]?.letters?.length ?? Number.POSITIVE_INFINITY;
}

/**
 * What every object is called. A name that was typed is kept; the rest take
 * their turn in the run for their kind, in the order they were built, skipping
 * any name already spoken for. Nothing is stored, so deleting an object closes
 * the gap it leaves.
 */
export function namesFor(objects: SketchObject[]): Map<string, string> {
  const names = new Map<string, string>();
  const taken = new Set<string>();
  for (const object of objects) {
    const pinned = object.label?.name;
    if (pinned) {
      names.set(object.id, pinned);
      taken.add(pinned);
    }
  }
  const reached: Record<string, number> = {};
  for (const object of objects) {
    if (names.has(object.id)) continue;
    const run = runFor(object, objects);
    if (!run) continue;
    let nth = reached[run] ?? 0;
    let name = nameInRun(run, nth);
    // A name somebody typed is stepped over, so the run does not say it twice.
    // The run wraps, though, so every name in it can be spoken for already:
    // look once round it for a free one and then take whatever comes next.
    for (let tried = 0; taken.has(name) && tried < lapOf(run); tried += 1) {
      nth += 1;
      name = nameInRun(run, nth);
    }
    reached[run] = nth + 1;
    names.set(object.id, name);
    taken.add(name);
  }
  // f' after f, and f'' after that. A derivative is made after the function it
  // differentiates, so one pass forward names a whole chain of them.
  for (const object of objects) {
    if (!isFunction(object) || object.of === undefined || object.label?.name) continue;
    const from = names.get(object.of);
    if (!from) continue;
    let wanted = `${from}'`;
    while (taken.has(wanted)) wanted += "'";
    names.set(object.id, wanted);
    taken.add(wanted);
  }
  return names;
}

/** Sheet pixels to a centimetre, so a cm at 100% zoom is about a real one. */
export const PX_PER_CM = 96 / 2.54;

/** Which way a straight object runs on past the two points that define it. */
export const LINE_FORMS = ["segment", "ray", "line"] as const;

export type LineForm = (typeof LINE_FORMS)[number];

/**
 * What puts a straight object where it is: two points it runs through, a point
 * and another line to follow or cross at a right angle, or the corner and arms
 * of an angle it splits in two.
 */
export type LineSpan =
  | { kind: "through"; ends: [string, string] }
  | { kind: "parallel"; at: string; to: string }
  | { kind: "perpendicular"; at: string; to: string }
  | { kind: "bisector"; corner: string; a: string; b: string };

/**
 * A straight object: a segment between the two points its span gives, a ray
 * running out past the second, or a line running out both ways.
 */
export interface SketchLine extends Labelled {
  id: string;
  kind: "line";
  form: LineForm;
  span: LineSpan;
}

export function parentsOfSpan(span: LineSpan): string[] {
  if (span.kind === "through") return span.ends;
  if (span.kind === "bisector") return [span.corner, span.a, span.b];
  return [span.at, span.to];
}

/**
 * What puts a circle where it is: a centre and a point on it, which is how the
 * compass draws one, or a centre and a segment whose length is the radius.
 */
export type CircleSpan =
  | { kind: "through"; centre: string; edge: string }
  | { kind: "radius"; centre: string; along: string };

/** A circle. Like a line, it has no place of its own: it is where its span says. */
export interface SketchCircle extends Labelled {
  id: string;
  kind: "circle";
  span: CircleSpan;
}

export function parentsOfCircle(span: CircleSpan): string[] {
  return span.kind === "through" ? [span.centre, span.edge] : [span.centre, span.along];
}

/**
 * What puts an arc where it is: two points bounding a stretch of a circle, two
 * points the same distance from a centre, or three points it runs through.
 *
 * The first two run counter-clockwise from `from` to `to`, which is what says
 * whether it is the short way round or the long way.
 */
export type ArcSpan =
  | { kind: "on"; circle: string; from: string; to: string }
  | { kind: "centre"; centre: string; from: string; to: string }
  | { kind: "through"; from: string; via: string; to: string };

/** An arc: a stretch of a circle, with two ends. */
export interface SketchArc extends Labelled {
  id: string;
  kind: "arc";
  span: ArcSpan;
}

export function parentsOfArc(span: ArcSpan): string[] {
  if (span.kind === "on") return [span.circle, span.from, span.to];
  if (span.kind === "centre") return [span.centre, span.from, span.to];
  return [span.from, span.via, span.to];
}

/**
 * A filled shape, its corners in the order they were picked. It has no place of
 * its own either: it is wherever its corners are.
 */
export type SketchInterior = Labelled &
  (
    | { id: string; kind: "interior"; vertices: string[] }
    | { id: string; kind: "interior"; of: string; wedge?: "sector" | "segment" }
  );

/** The corners a fill runs through, or null when it fills a circle or an arc. */
export function cornersOf(fill: SketchInterior): string[] | null {
  return "vertices" in fill ? fill.vertices : null;
}

/** The circle or arc a fill is the inside of, or null when it is a polygon's. */
export function filledPath(fill: SketchInterior): string | null {
  return "of" in fill ? fill.of : null;
}

/**
 * Which way an arc is filled: the sector out to its centre, or the segment cut
 * off by its chord. Null on a fill that is not an arc's.
 */
export function wedgeOf(fill: SketchInterior): "sector" | "segment" | null {
  return "wedge" in fill ? (fill.wedge ?? null) : null;
}

/**
 * A locus: every position a driven object takes as its driver runs along a
 * path. The driver is a point, the domain the straight object it runs along,
 * and the driven object anything built on the driver.
 *
 * It holds no positions of its own. They are worked out afresh in `settle`, by
 * putting the driver at each sample in turn and following what hangs off it.
 */
export interface SketchLocus extends Labelled {
  id: string;
  kind: "locus";
  driver: string;
  domain: string;
  driven: string;
  /** How far along the domain the driver runs, in the domain's own units. */
  span: [number, number];
  /** How many positions are drawn along that stretch. */
  samples: number;
}

/** How a caption's text is set across its box. */
export type CaptionAlign = "left" | "center" | "right";

/**
 * A caption: writing on the sheet that says what the sketch is about. It is
 * dragged out with the Text tool, typed into, and resized by the handle at its
 * corner, which reflows what is in it.
 *
 * It hangs by its top left corner, in sheet coordinates, so it travels with the
 * drawing when the sheet is panned. Its width and its type stay the size they
 * are set to at every zoom, the way a label does, so `width` is screen pixels
 * rather than sheet ones.
 *
 * `html` is what was typed, with the runs that carry their own font, size,
 * colour or style, the mathematical notation, and the Hot Text links. A link
 * carries the id of what it reads and is filled in with that object's name
 * every time the caption is drawn, so renaming the object rewrites the
 * sentence.
 */
export interface SketchCaption extends Labelled {
  id: string;
  kind: "caption";
  x: number;
  y: number;
  /** How wide the box is, in screen pixels. */
  width: number;
  html: string;
  align: CaptionAlign;
  /** What the caption is set in where nothing inside it says otherwise. */
  font: string;
  /** Point size. */
  size: number;
  /** The name of the colour token the text takes. */
  colour: string;
}

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

export function isPoint(object: SketchObject): object is SketchPoint {
  return object.kind === "point";
}

export function isLine(object: SketchObject): object is SketchLine {
  return object.kind === "line";
}

export function isInterior(object: SketchObject): object is SketchInterior {
  return object.kind === "interior";
}

export function isLocus(object: SketchObject): object is SketchLocus {
  return object.kind === "locus";
}

export function isCircle(object: SketchObject): object is SketchCircle {
  return object.kind === "circle";
}

export function isArc(object: SketchObject): object is SketchArc {
  return object.kind === "arc";
}

export function isCaption(object: SketchObject): object is SketchCaption {
  return object.kind === "caption";
}

export function isMeasurement(object: SketchObject): object is SketchMeasurement {
  return object.kind === "measurement";
}

export function isParameter(object: SketchObject): object is SketchParameter {
  return object.kind === "parameter";
}

export function isCalculation(object: SketchObject): object is SketchCalculation {
  return object.kind === "calculation";
}

export function isTable(object: SketchObject): object is SketchTable {
  return object.kind === "table";
}

export function isFunction(object: SketchObject): object is SketchFunction {
  return object.kind === "function";
}

export function isTransform(object: SketchObject): object is SketchTransform {
  return object.kind === "transform";
}

export function isButton(object: SketchObject): object is SketchButton {
  return object.kind === "button";
}

/**
 * What a function works out, whether it was typed or differentiated. A
 * derivative is worked out here rather than stored, so it follows whatever it
 * differentiates. A file that says a function differentiates itself gets
 * nothing rather than an endless walk.
 */
export function bodyOf(
  objects: SketchObject[],
  id: string,
  seen: Set<string> = new Set(),
): Expr | null {
  if (seen.has(id)) return null;
  const found = objects.find((object) => object.id === id);
  if (!found || !isFunction(found)) return null;
  if (found.body) return found.body;
  if (!found.of) return null;
  seen.add(id);
  const from = bodyOf(objects, found.of, seen);
  return from ? differentiate(from, (other) => bodyOf(objects, other, new Set(seen))) : null;
}

/** Everything that writes a number on the sheet, whatever it gets it from. */
export function isValue(
  object: SketchObject,
): object is SketchMeasurement | SketchParameter | SketchCalculation {
  return isMeasurement(object) || isParameter(object) || isCalculation(object);
}

export function isMark(object: SketchObject): object is SketchMark {
  return object.kind === "mark";
}

/** The path a tick rides, or null on an angle mark, which rides no path. */
export function markPath(mark: SketchMark): string | null {
  return "path" in mark ? mark.path : null;
}

/**
 * Text riding over the sheet rather than drawn in it: a caption and a
 * measurement both hang by a spot, keep their size at every zoom, and are hit,
 * dragged and caught by a marquee where they are drawn rather than by geometry.
 */
/**
 * Everything that sits on the sheet as text rather than as geometry. It has a
 * place of its own and no parents holding it there, so a drag carries it and
 * whatever it reads stays put.
 */
export type SketchWriting =
  | SketchCaption
  | SketchMeasurement
  | SketchParameter
  | SketchCalculation
  | SketchTable
  | SketchFunction
  | SketchButton;

export function isWriting(object: SketchObject): object is SketchWriting {
  return (
    isCaption(object) ||
    isValue(object) ||
    isTable(object) ||
    isFunction(object) ||
    isButton(object)
  );
}

/**
 * The objects a caption reads through Hot Text, in the order they appear in it.
 * Read out of the markup rather than kept beside it, so there is one place a
 * link is recorded and it cannot fall out of step with what is written.
 */
export function linkedIn(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/data-link="([^"]+)"/g)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/**
 * The points a drag actually moves. A point plotted by hand moves itself, and a
 * point on a path slides along it, but a point that was constructed is where its
 * parents put it: what moves then is everything it was built on, right back to
 * the points that can move. The whole configuration travels together, so no
 * constraint is broken and nothing is locked in place.
 */
export function movedBy(objects: SketchObject[], ids: string[]): string[] {
  const moving: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string, dragged: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    const object = objects.find((candidate) => candidate.id === id);
    if (!object) return;
    if (isPoint(object) && (!object.from || (dragged && object.from.kind === "on"))) {
      moving.push(object.id);
      return;
    }
    // A mark is an ornament on the figure, never a handle on it. Dragging one
    // moves the mark itself and leaves everything it marks where it is.
    if (isMark(object)) return;
    for (const parent of familyOf(object) ?? []) walk(parent, false);
  };
  for (const id of ids) walk(id, true);
  return moving;
}

/** What an object hangs off: its parents, whatever kind of object it is. */
export function familyOf(object: SketchObject): string[] | undefined {
  // A caption that reads an object hangs off it, so deleting the object takes
  // the caption with it rather than leaving it quoting something that is gone.
  if (isCaption(object)) return linkedIn(object.html);
  // A measurement goes when anything it reads goes: a number with nothing left
  // to measure says nothing.
  if (isMeasurement(object)) return object.of;
  // A calculation goes when any number it reads goes: an expression with a
  // hole in it works nothing out. A parameter reads nothing, so it hangs off
  // nothing and stays until it is deleted itself.
  if (isCalculation(object)) return dependsOn(object.expression);
  if (isParameter(object)) return [];
  // A table goes when any column it reads goes: a table with a hole in it is
  // not a record of anything.
  if (isTable(object)) return object.of;
  // A function goes with whatever it reads, and a derivative goes with the
  // function it differentiates, which is the only thing it has.
  if (isFunction(object))
    return object.body ? dependsOn(object.body) : object.of ? [object.of] : [];
  // A custom transform is the two points it was shown on, so it goes when
  // either of them does.
  if (isTransform(object)) return [object.seed, object.image];
  // A button goes when what it acts on goes: there is nothing left to press it
  // for. A link acts on a page rather than an object, so it hangs off nothing.
  if (isButton(object)) {
    const does = object.does;
    if (does.form === "link") return [];
    if (does.form === "scroll") return [does.point];
    return does.of;
  }
  // A mark goes with what it marks: the path a tick rides, or the corner and
  // the two sides an angle mark sits between.
  if (isMark(object)) {
    return "path" in object ? [object.path] : [object.corner, ...object.arms, ...object.sides];
  }
  if (isPoint(object)) return object.from && parentsOf(object.from);
  if (isLine(object)) return parentsOfSpan(object.span);
  if (isCircle(object)) return parentsOfCircle(object.span);
  if (isArc(object)) return parentsOfArc(object.span);
  // A locus goes when the driver, the path it runs along or what it draws goes.
  if (isLocus(object)) return [object.driver, object.domain, object.driven];
  return cornersOf(object) ?? [filledPath(object) as string];
}

export function pointsOf(objects: SketchObject[]): SketchPoint[] {
  return objects.filter(isPoint);
}

export interface SketchState {
  objects: SketchObject[];
  selection: string[];
}

export const EMPTY_SKETCH: SketchState = { objects: [], selection: [] };

/** Where a page is being looked at: its top left corner, and its zoom. */
export interface View extends Position {
  scale: number;
}

export const DEFAULT_VIEW: View = { x: 0, y: 0, scale: 1 };

/** Slack around an object that a click still counts as a hit. */
const PICK_SLACK = 5;

/** Far enough that a ray or a line always leaves any rectangle we clip to. */
const FAR = 1e9;

/** Below this a direction is too short to tell which way it points. */
const TINY = 1e-9;

export interface Position {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function radiusOf(point: SketchPoint): number {
  return POINT_RADII[point.size];
}

/** How far, in sheet pixels, a click still counts as on an object. */
export function slackAt(scale: number): number {
  return PICK_SLACK / scale;
}

/** Where a line runs, and how far along it it actually exists. */
export interface LineGeometry {
  a: Position;
  b: Position;
  form: LineForm;
}

/**
 * The positions a locus was worked out to, one entry per sample: places for a
 * driven point, stretches for a driven straight object, corner lists for a
 * driven fill.
 */
export type LocusShape =
  | { kind: "points"; at: Position[] }
  | { kind: "lines"; at: LineGeometry[] }
  | { kind: "circles"; at: CircleGeometry[] }
  | { kind: "arcs"; at: ArcGeometry[] }
  | { kind: "shapes"; at: Position[][] };

/** Where a circle runs. `ref` is the way round it a point at 0 sits. */
export interface CircleGeometry {
  at: Position;
  radius: number;
  ref: number;
}

/**
 * Where an arc runs: round its circle from `from`, sweeping the given angle.
 * A negative sweep runs counter-clockwise on screen, where y counts downward.
 * `flat` is set instead when its three points went straight, and it is drawn
 * as the run between the two of them.
 */
export interface ArcGeometry {
  at: Position;
  radius: number;
  from: number;
  sweep: number;
  flat?: [Position, Position];
}

/** Something a point can be put on and slide along. */
export type PathGeometry = LineGeometry | CircleGeometry | ArcGeometry;

export function isRound(path: PathGeometry): path is CircleGeometry {
  return "ref" in path;
}

export function isArcPath(path: PathGeometry): path is ArcGeometry {
  return "sweep" in path;
}

/** A whole turn. */
const TURN = Math.PI * 2;

/** Everything the page's geometry is worked out into, in one pass. */
export interface Settled {
  /**
   * What every number on the sheet comes to, in the sheet's own terms:
   * centimetres and degrees, whatever units are being written. A transform can
   * follow one, so they settle alongside the geometry rather than after it.
   */
  values: Map<string, Quantity | null>;
  points: Map<string, SketchPoint>;
  lines: Map<string, LineGeometry>;
  circles: Map<string, CircleGeometry>;
  arcs: Map<string, ArcGeometry>;
  /** Each interior's corners, in order, once they are all known. */
  shapes: Map<string, Position[]>;
  loci: Map<string, LocusShape>;
}

/** Where a path runs, whichever kind of path it is. */
export function pathIn(settled: Settled, id: string): PathGeometry | undefined {
  return settled.lines.get(id) ?? settled.circles.get(id) ?? settled.arcs.get(id);
}

/** How many positions a new locus draws, and how far + and - can push it. */
export const POINT_SAMPLES = 60;
export const SHAPE_SAMPLES = 20;
export const MIN_SAMPLES = 5;
export const MAX_SAMPLES = 200;
export const SAMPLE_STEP = 5;

/** Where a point on screen lands on the sheet. */
export function toSheet(
  bounds: DOMRect,
  clientX: number,
  clientY: number,
  view: Position,
  scale: number,
): Position {
  return {
    x: view.x + (clientX - bounds.left) / scale,
    y: view.y + (clientY - bounds.top) / scale,
  };
}

/** The sheet the drawing takes up, dots included, or null when it is empty. */
export function contentBounds(
  objects: SketchObject[],
  scale: number,
  settled = settle(objects).settled,
): Rect | null {
  const captions = objects.filter(isWriting);
  if (pointsOf(objects).length === 0 && captions.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  // Only a point has a place of its own, and a line is drawn between points.
  for (const object of pointsOf(objects)) {
    const reach = radiusOf(object) / scale;
    left = Math.min(left, object.x - reach);
    top = Math.min(top, object.y - reach);
    right = Math.max(right, object.x + reach);
    bottom = Math.max(bottom, object.y + reach);
  }
  // A caption hangs by its top left corner and holds the width it was given,
  // in screen pixels, so how much sheet it covers depends on the zoom.
  for (const caption of captions) {
    const width = isCaption(caption) ? caption.width : 0;
    left = Math.min(left, caption.x);
    top = Math.min(top, caption.y);
    right = Math.max(right, caption.x + width / scale);
    bottom = Math.max(bottom, caption.y);
  }
  // A circle reaches past the points that hold it, so it brings its own edges.
  for (const round of settled.circles.values()) {
    left = Math.min(left, round.at.x - round.radius);
    top = Math.min(top, round.at.y - round.radius);
    right = Math.max(right, round.at.x + round.radius);
    bottom = Math.max(bottom, round.at.y + round.radius);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function union(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The direction from a to b, at length one, or null when there is none. */
function unit(a: Position, b: Position): Position | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length < TINY ? null : { x: dx / length, y: dy / length };
}

/**
 * Ids are counted out, and stamped with a token this run of the app picked. The
 * counter is module state, so anything that reloads the module starts it again:
 * a hot reload in development, and any later scheme for splitting the bundle.
 * A sketch read from a file was counted out by a different run. The token is
 * what keeps those apart, because two objects sharing an id share a name, a
 * label, and every toggle keyed by it, and the sketch is quietly damaged.
 */
const RUN = Math.random().toString(36).slice(2, 8);

let made = 0;

function nextId(kind: string): string {
  made += 1;
  return `${kind}-${made}-${RUN}`;
}

export function createPoint(at: Position, size: PointSize, from?: Derivation): SketchPoint {
  return { id: nextId("point"), kind: "point", x: at.x, y: at.y, size, from };
}

export function createLine(form: LineForm, span: LineSpan): SketchLine {
  return { id: nextId("line"), kind: "line", form, span };
}

export function createCircle(span: CircleSpan): SketchCircle {
  return { id: nextId("circle"), kind: "circle", span };
}

export function createArc(span: ArcSpan): SketchArc {
  return { id: nextId("arc"), kind: "arc", span };
}

export function createInterior(vertices: string[]): SketchInterior {
  return { id: nextId("shape"), kind: "interior", vertices };
}

/** A fresh caption, empty, dragged out to the box it was given. */
export function createCaption(
  at: Position,
  width: number,
  look: { font: string; size: number; colour: string; align?: CaptionAlign },
): SketchCaption {
  return {
    id: nextId("caption"),
    kind: "caption",
    x: at.x,
    y: at.y,
    width,
    html: "",
    align: "left",
    ...look,
  };
}

/** A number the sketch holds, which the New Parameter dialog sets. */
export function createParameter(
  value: number,
  unit: ParameterUnit,
  places: number,
  at: Position,
): SketchParameter {
  return { id: nextId("param"), kind: "parameter", value, unit, places, x: at.x, y: at.y };
}

/** A number worked out from the sketch's other numbers. */
export function createCalculation(expression: Expr, at: Position): SketchCalculation {
  return { id: nextId("calc"), kind: "calculation", expression, x: at.x, y: at.y };
}

/** Something on the sheet to press, which does what it was made to do. */
export function createButton(name: string, does: ButtonAction, at: Position): SketchButton {
  return { id: nextId("button"), kind: "button", name, does, x: at.x, y: at.y };
}

/** A transform shown by example: a point, and what that point became. */
export function createCustomTransform(name: string, seed: string, image: string): SketchTransform {
  return { id: nextId("custom"), kind: "transform", name, seed, image };
}

/** A function of x, either typed out or worked out from another one. */
export function createFunction(
  at: Position,
  from: { body: Expr } | { of: string },
): SketchFunction {
  return { id: nextId("fn"), kind: "function", ...from, x: at.x, y: at.y };
}

/** A grid of what the sketch's numbers came to, a column each and no rows yet. */
export function createTable(of: string[], at: Position): SketchTable {
  return { id: nextId("table"), kind: "table", of, rows: [], x: at.x, y: at.y };
}

/** A number written on the sheet, reading the objects it was taken from. */
export function createMeasurement(
  measure: MeasureKind,
  of: string[],
  at: Position,
): SketchMeasurement {
  return { id: nextId("measure"), kind: "measurement", measure, of, x: at.x, y: at.y };
}

/** The inside of a circle, which is wherever the circle is. */
export function createFill(of: string): SketchInterior {
  return { id: nextId("shape"), kind: "interior", of };
}

/** The inside of an arc: out to its centre, or cut off by its chord. */
export function createWedge(of: string, wedge: "sector" | "segment"): SketchInterior {
  return { id: nextId("shape"), kind: "interior", of, wedge };
}

/** Whether a spot is inside the part of an arc's circle the fill covers. */
export function insideWedge(arc: ArcGeometry, wedge: "sector" | "segment", at: Position): boolean {
  if (arc.flat) return false;
  if (distance(arc.at, at) > arc.radius) return false;
  if (wedge === "sector") {
    const t = turnOn(arc, at);
    return t >= 0 && t <= 1;
  }
  // The segment is what the chord cuts off: the side of it the arc bulges to.
  const start = spotOnPath(arc, 0);
  const end = spotOnPath(arc, 1);
  const side = (spot: Position) =>
    (end.x - start.x) * (spot.y - start.y) - (end.y - start.y) * (spot.x - start.x);
  const bulge = side(spotOnPath(arc, 0.5));
  return Math.abs(bulge) > TINY && Math.sign(side(at)) === Math.sign(bulge);
}

export function createLocus(
  driver: string,
  domain: string,
  driven: string,
  span: [number, number],
  samples: number,
): SketchLocus {
  return { id: nextId("locus"), kind: "locus", driver, domain, driven, span, samples };
}

/** Whether a spot is inside a shape, by counting crossings to its left. */
export function insideShape(corners: Position[], at: Position): boolean {
  let inside = false;
  for (let index = 0, last = corners.length - 1; index < corners.length; last = index++) {
    const one = corners[index];
    const other = corners[last];
    const straddles = one.y > at.y !== other.y > at.y;
    if (!straddles) continue;
    const cut = one.x + ((at.y - one.y) / (other.y - one.y)) * (other.x - one.x);
    if (at.x < cut) inside = !inside;
  }
  return inside;
}

/** A shape's edges, as the segments its outline is made of. */
function edgesOf(corners: Position[]): LineGeometry[] {
  return corners.map((corner, index) => ({
    a: corner,
    b: corners[(index + 1) % corners.length],
    form: "segment" as const,
  }));
}

/** The common case: a line through two points. */
export function lineThrough(form: LineForm, ends: [string, string]): SketchLine {
  return createLine(form, { kind: "through", ends });
}

/**
 * Every spot two paths meet at, in an order that holds still as they move: a
 * line and a circle in the order they are met running along the line, and two
 * circles with the one to the left of the way between their centres first.
 * Empty when they do not meet where they run.
 */
export function crossings(one: PathGeometry, other: PathGeometry): Position[] {
  // An arc meets things where its circle does, less whatever falls off its
  // ends, so it is worked out as the circle and then cut back.
  if (isArcPath(one) || isArcPath(other)) {
    const met = crossings(wholePath(one), wholePath(other));
    return met.filter(
      (spot) => (!isArcPath(one) || onArc(one, spot)) && (!isArcPath(other) || onArc(other, spot)),
    );
  }
  if (!isRound(one) && !isRound(other)) {
    const met = crossing(one, other);
    return met ? [met] : [];
  }
  if (isRound(one) && isRound(other)) return circlesMeet(one, other);
  const line = isRound(one) ? (other as LineGeometry) : one;
  const round = isRound(one) ? one : (other as CircleGeometry);
  return lineMeetsCircle(line, round);
}

/** The whole path an arc is a stretch of: its circle, or the run it lies on. */
function wholePath(path: PathGeometry): PathGeometry {
  if (!isArcPath(path)) return path;
  if (path.flat) return { a: path.flat[0], b: path.flat[1], form: "segment" };
  return { at: path.at, radius: path.radius, ref: path.from };
}

/** Where a straight object runs into a circle, in the order it meets them. */
function lineMeetsCircle(line: LineGeometry, round: CircleGeometry): Position[] {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const gap = { x: line.a.x - round.at.x, y: line.a.y - round.at.y };
  const a = dx * dx + dy * dy;
  if (a < TINY) return [];
  const b = 2 * (gap.x * dx + gap.y * dy);
  const c = gap.x * gap.x + gap.y * gap.y - round.radius * round.radius;
  const under = b * b - 4 * a * c;
  if (under < 0) return [];
  const root = Math.sqrt(under);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t, index, all) => (index === 0 ? true : Math.abs(t - all[0]) > TINY))
    .filter((t) => runsTo(line.form, t))
    .map((t) => ({ x: line.a.x + dx * t, y: line.a.y + dy * t }));
}

/** Where two circles meet, the left-hand one first. */
function circlesMeet(one: CircleGeometry, other: CircleGeometry): Position[] {
  const apart = distance(one.at, other.at);
  if (apart < TINY) return [];
  if (apart > one.radius + other.radius) return [];
  if (apart < Math.abs(one.radius - other.radius)) return [];
  const way = { x: (other.at.x - one.at.x) / apart, y: (other.at.y - one.at.y) / apart };
  const along =
    (apart * apart + one.radius * one.radius - other.radius * other.radius) / (2 * apart);
  const off = Math.sqrt(Math.max(0, one.radius * one.radius - along * along));
  const foot = { x: one.at.x + way.x * along, y: one.at.y + way.y * along };
  if (off < TINY) return [foot];
  return [
    { x: foot.x - way.y * off, y: foot.y + way.x * off },
    { x: foot.x + way.y * off, y: foot.y - way.x * off },
  ];
}

/**
 * Where two straight objects cross, or null when they do not cross where they
 * run. Parallel objects never cross, and two segments whose lines would only
 * meet beyond their ends do not either.
 */
export function crossing(one: LineGeometry, other: LineGeometry): Position | null {
  const p = { x: one.b.x - one.a.x, y: one.b.y - one.a.y };
  const q = { x: other.b.x - other.a.x, y: other.b.y - other.a.y };
  const twist = p.x * q.y - p.y * q.x;
  if (Math.abs(twist) < TINY) return null;
  const gap = { x: other.a.x - one.a.x, y: other.a.y - one.a.y };
  const t = (gap.x * q.y - gap.y * q.x) / twist;
  const u = (gap.x * p.y - gap.y * p.x) / twist;
  if (!runsTo(one.form, t) || !runsTo(other.form, u)) return null;
  return { x: one.a.x + p.x * t, y: one.a.y + p.y * t };
}

/** Whether an object still exists that far along itself. */
function runsTo(form: LineForm, t: number): boolean {
  if (form === "line") return true;
  if (t < 0) return false;
  return form === "ray" || t <= 1;
}

/** Where an image belongs, or null when what it hangs off has gone. */
/** Which way one spot lies from another, as the sheet counts angles. */
function bearing(from: Position, to: Position): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * The angle a rotation is following, in degrees counterclockwise on screen,
 * which is the way a fixed angle is counted too. Three points give the turn
 * that carries the first arm onto the second.
 */
function angleFollowed(angle: MarkedAngle, settled: Settled): number | null {
  if (angle.kind === "value") {
    const held = settled.values.get(angle.of);
    // Only an angle is an angle. A length says nothing about how far to turn.
    return held && held.angle === 1 && held.length === 0 ? held.value : null;
  }
  const corner = settled.points.get(angle.corner);
  const a = settled.points.get(angle.a);
  const b = settled.points.get(angle.b);
  if (!corner || !a || !b) return null;
  // The sheet's y counts downward, so counterclockwise on screen is the way the
  // bearing decreases.
  return ((bearing(corner, a) - bearing(corner, b)) * 180) / Math.PI;
}

/** The ratio a dilation is following, or null where it says nothing. */
function ratioFollowed(ratio: MarkedRatio, settled: Settled): number | null {
  if (ratio.kind === "value") {
    const held = settled.values.get(ratio.of);
    // A scale factor has no units: a length would be a ratio of what to what.
    return held && held.angle === 0 && held.length === 0 ? held.value : null;
  }
  if (ratio.kind === "segments") {
    const top = settled.lines.get(ratio.top);
    const bottom = settled.lines.get(ratio.bottom);
    if (!top || !bottom) return null;
    const under = distance(bottom.a, bottom.b);
    return under === 0 ? null : distance(top.a, top.b) / under;
  }
  const a = settled.points.get(ratio.a);
  const b = settled.points.get(ratio.b);
  const c = settled.points.get(ratio.c);
  if (!a || !b || !c) return null;
  // Signed, so C on the far side of A from B dilates through the centre. Read
  // along AB, which is the line all three are meant to lie on.
  const alongX = b.x - a.x;
  const alongY = b.y - a.y;
  const span = alongX * alongX + alongY * alongY;
  return span === 0 ? null : ((c.x - a.x) * alongX + (c.y - a.y) * alongY) / span;
}

/**
 * The vector a translation is following, in sheet pixels. A polar vector can
 * have one half marked and the other left as it was given, so the half that is
 * not marked is read back off the vector the translation is carrying.
 */
function vectorFollowed(
  by: MarkedVector,
  settled: Settled,
  held: { dx: number; dy: number },
): { dx: number; dy: number } | null {
  if (by.kind === "points") {
    const from = settled.points.get(by.from);
    const to = settled.points.get(by.to);
    return from && to ? { dx: to.x - from.x, dy: to.y - from.y } : null;
  }
  const reach = (id: string): number | null => {
    const found = settled.values.get(id);
    // A distance is a distance. An angle or a bare number is not one.
    return found && found.length === 1 && found.angle === 0 ? found.value * PX_PER_CM : null;
  };
  if (by.kind === "distances") {
    const across = reach(by.horizontal);
    const up = reach(by.vertical);
    // Up the screen is the positive way, and the sheet's y counts downward.
    return across === null || up === null ? null : { dx: across, dy: -up };
  }
  const far = by.distance ? reach(by.distance) : Math.hypot(held.dx, held.dy);
  const way = by.angle
    ? angleFollowed(by.angle, settled)
    : (Math.atan2(-held.dy, held.dx) * 180) / Math.PI;
  if (far === null || way === null) return null;
  const radians = (way * Math.PI) / 180;
  return { dx: far * Math.cos(radians), dy: -far * Math.sin(radians) };
}

export function imageOf(from: Derivation, settled: Settled): Position | null {
  if (from.kind === "on") {
    const path = pathIn(settled, from.path);
    return path ? spotOnPath(path, from.at) : null;
  }
  if (from.kind === "cross") {
    const one = pathIn(settled, from.of);
    const other = pathIn(settled, from.and);
    if (!one || !other) return null;
    const met = crossings(one, other);
    return met[from.pick ?? 0] ?? null;
  }
  const of = settled.points.get(from.of);
  if (!of) return null;
  if (from.kind === "translate") {
    // What it follows where it was told to follow something, and the numbers it
    // was given otherwise.
    const by = from.by ? vectorFollowed(from.by, settled, from) : from;
    if (!by) return null;
    return { x: of.x + by.dx, y: of.y + by.dy };
  }
  if (from.kind === "reflect") {
    const mirror = settled.lines.get(from.mirror);
    if (!mirror) return null;
    const way = unit(mirror.a, mirror.b);
    if (!way) return null;
    // Twice the way to the foot of the perpendicular, less the point itself.
    const across = (of.x - mirror.a.x) * way.x + (of.y - mirror.a.y) * way.y;
    const foot = { x: mirror.a.x + way.x * across, y: mirror.a.y + way.y * across };
    return { x: 2 * foot.x - of.x, y: 2 * foot.y - of.y };
  }
  if (from.kind === "midpoint") {
    const and = settled.points.get(from.and);
    return and ? { x: (of.x + and.x) / 2, y: (of.y + and.y) / 2 } : null;
  }
  const centre = settled.points.get(from.centre);
  if (!centre) return null;
  const dx = of.x - centre.x;
  const dy = of.y - centre.y;
  if (from.kind === "dilate") {
    const ratio = from.by ? ratioFollowed(from.by, settled) : from.ratio;
    if (ratio === null) return null;
    return { x: centre.x + dx * ratio, y: centre.y + dy * ratio };
  }
  const degrees = from.by ? angleFollowed(from.by, settled) : from.degrees;
  if (degrees === null) return null;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Counterclockwise on screen, where y counts downward.
  return { x: centre.x + dx * cos + dy * sin, y: centre.y - dx * sin + dy * cos };
}

/** Where a circle sits, or null when what holds it has gone or it has no size. */
export function circleAt(span: CircleSpan, settled: Settled): CircleGeometry | null {
  const centre = settled.points.get(span.centre);
  if (!centre) return null;
  const at = { x: centre.x, y: centre.y };
  if (span.kind === "through") {
    const edge = settled.points.get(span.edge);
    if (!edge) return null;
    const radius = distance(centre, edge);
    // A point on the circle is measured round from its radius point, so
    // swinging the radius point carries everything on the circle with it.
    return radius < TINY
      ? null
      : { at, radius, ref: Math.atan2(edge.y - centre.y, edge.x - centre.x) };
  }
  const along = settled.lines.get(span.along);
  if (!along) return null;
  const radius = distance(along.a, along.b);
  return radius < TINY ? null : { at, radius, ref: 0 };
}

/** The angle from a centre to a spot, on a sheet whose y counts downward. */
function angleTo(centre: Position, spot: Position): number {
  return Math.atan2(spot.y - centre.y, spot.x - centre.x);
}

/** How far counter-clockwise it is from one angle round to another. */
function turnBetween(from: number, to: number): number {
  const gap = (from - to) % TURN;
  return gap < 0 ? gap + TURN : gap;
}

/** The circle through three points, or null when they lie in a straight line. */
function circleThrough(a: Position, b: Position, c: Position): CircleGeometry | null {
  const twice = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(twice) < TINY) return null;
  const one = a.x * a.x + a.y * a.y;
  const two = b.x * b.x + b.y * b.y;
  const three = c.x * c.x + c.y * c.y;
  const at = {
    x: (one * (b.y - c.y) + two * (c.y - a.y) + three * (a.y - b.y)) / twice,
    y: (one * (c.x - b.x) + two * (a.x - c.x) + three * (b.x - a.x)) / twice,
  };
  return { at, radius: distance(at, a), ref: 0 };
}

/** Whether a spot lies between two others, all three being in a line. */
function between(one: Position, spot: Position, other: Position): boolean {
  const along = (spot.x - one.x) * (other.x - one.x) + (spot.y - one.y) * (other.y - one.y);
  const reach = (other.x - one.x) ** 2 + (other.y - one.y) ** 2;
  return along >= 0 && along <= reach;
}

/**
 * Where an arc runs, or null when it cannot be placed: its three points went
 * straight and the middle one is not between the others, so there is no arc.
 */
export function arcAt(span: ArcSpan, settled: Settled): ArcGeometry | null {
  const from = settled.points.get(span.from);
  const to = settled.points.get(span.to);
  if (!from || !to) return null;
  if (span.kind === "through") {
    const via = settled.points.get(span.via);
    if (!via) return null;
    const round = circleThrough(from, via, to);
    if (!round) {
      // Straight through: an arc of no angle, drawn as the run it makes. With
      // the middle point outside the other two there is no such run.
      const ends: [Position, Position] = [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
      return between(from, via, to)
        ? { at: ends[0], radius: 0, from: 0, sweep: 0, flat: ends }
        : null;
    }
    const start = angleTo(round.at, from);
    const round_to = turnBetween(start, angleTo(round.at, to));
    const round_via = turnBetween(start, angleTo(round.at, via));
    // Counter-clockwise if that is the way past the middle point, the other
    // way about if it is not.
    const sweep = round_via <= round_to ? -round_to : TURN - round_to;
    return { at: round.at, radius: round.radius, from: start, sweep };
  }
  const at =
    span.kind === "on" ? settled.circles.get(span.circle)?.at : settled.points.get(span.centre);
  if (!at) return null;
  const centre = { x: at.x, y: at.y };
  const radius =
    span.kind === "on" ? (settled.circles.get(span.circle)?.radius ?? 0) : distance(centre, from);
  if (radius < TINY) return null;
  const start = angleTo(centre, from);
  return { at: centre, radius, from: start, sweep: -turnBetween(start, angleTo(centre, to)) };
}

/** How far along an arc a spot is, which is past 1 when it is off the end. */
function turnOn(arc: ArcGeometry, spot: Position): number {
  if (arc.flat) return alongPath({ a: arc.flat[0], b: arc.flat[1], form: "segment" }, spot);
  if (Math.abs(arc.sweep) < TINY) return 0;
  const way = arc.sweep < 0 ? -1 : 1;
  const off = ((((angleTo(arc.at, spot) - arc.from) * way) % TURN) + TURN) % TURN;
  return (off * way) / arc.sweep;
}

/** Whether a spot on the arc's circle is on the stretch the arc runs. */
function onArc(arc: ArcGeometry, spot: Position): boolean {
  const t = turnOn(arc, spot);
  return t >= -0.000001 && t <= 1.000001;
}

/** The spot a given way along a path: a fraction of a line, a turn of a circle. */
export function spotOnPath(path: PathGeometry, at: number): Position {
  if (isArcPath(path)) {
    if (path.flat) {
      return {
        x: path.flat[0].x + (path.flat[1].x - path.flat[0].x) * at,
        y: path.flat[0].y + (path.flat[1].y - path.flat[0].y) * at,
      };
    }
    const angle = path.from + path.sweep * at;
    return {
      x: path.at.x + Math.cos(angle) * path.radius,
      y: path.at.y + Math.sin(angle) * path.radius,
    };
  }
  if (isRound(path)) {
    const angle = path.ref + at * Math.PI * 2;
    return {
      x: path.at.x + Math.cos(angle) * path.radius,
      y: path.at.y + Math.sin(angle) * path.radius,
    };
  }
  return {
    x: path.a.x + (path.b.x - path.a.x) * at,
    y: path.a.y + (path.b.y - path.a.y) * at,
  };
}

/** The two points a line runs through, or null when it cannot be placed. */
export function lineAlong(span: LineSpan, form: LineForm, settled: Settled): LineGeometry | null {
  if (span.kind === "through") {
    const a = settled.points.get(span.ends[0]);
    const b = settled.points.get(span.ends[1]);
    return a && b && distance(a, b) > TINY ? { a, b, form } : null;
  }
  if (span.kind === "bisector") {
    const corner = settled.points.get(span.corner);
    const a = settled.points.get(span.a);
    const b = settled.points.get(span.b);
    if (!corner || !a || !b) return null;
    const one = unit(corner, a);
    const other = unit(corner, b);
    if (!one || !other) return null;
    const half = { x: one.x + other.x, y: one.y + other.y };
    // The arms point opposite ways, so there is no angle to halve.
    if (Math.hypot(half.x, half.y) < TINY) return null;
    return { a: corner, b: { x: corner.x + half.x, y: corner.y + half.y }, form };
  }
  const at = settled.points.get(span.at);
  const to = settled.lines.get(span.to);
  if (!at || !to) return null;
  const along = { x: to.b.x - to.a.x, y: to.b.y - to.a.y };
  const way = span.kind === "parallel" ? along : { x: -along.y, y: along.x };
  return { a: at, b: { x: at.x + way.x, y: at.y + way.y }, form };
}

/**
 * Put every image back where its parents say it belongs, and work out where
 * every line runs. One pass, because parents always come first.
 *
 * The same objects array comes back when nothing moved, so nothing downstream
 * mistakes a selection change for an edit.
 */
/**
 * Work out where one object belongs from what has already been placed, and
 * write that into `settled`. Everything it needs is there, because parents
 * always come before their children.
 */
function place(object: SketchObject, settled: Settled): void {
  // Neither a locus nor writing is placed here: a locus is worked out after
  // everything else, and writing sits where it was put.
  if (isLocus(object) || isWriting(object) || isMark(object)) return;
  if (isCircle(object)) {
    const round = circleAt(object.span, settled);
    if (round) settled.circles.set(object.id, round);
    return;
  }
  if (isArc(object)) {
    const arc = arcAt(object.span, settled);
    if (arc) settled.arcs.set(object.id, arc);
    return;
  }
  if (isInterior(object)) {
    // A circle's inside is wherever its circle is, so there is nothing of its
    // own to work out.
    const wanted = cornersOf(object);
    if (!wanted) return;
    const corners = wanted.map((id) => settled.points.get(id));
    if (corners.every((corner) => corner !== undefined)) {
      settled.shapes.set(
        object.id,
        corners.map((corner) => ({ x: corner.x, y: corner.y })),
      );
    }
    return;
  }
  if (isLine(object)) {
    const along = lineAlong(object.span, object.form, settled);
    if (along) settled.lines.set(object.id, along);
    return;
  }
  // A custom transform is a relationship, not a thing on the sheet, so it has
  // nowhere to be put.
  if (isTransform(object)) return;
  if (isButton(object)) return;
  const at = object.from ? imageOf(object.from, settled) : null;
  settled.points.set(object.id, at ? { ...object, x: at.x, y: at.y } : object);
}

/**
 * A locus, sample by sample: park the driver at each spot along its stretch of
 * the domain, follow everything built on it, and keep where the driven object
 * ended up. The page itself is left exactly as it was.
 */
function locusOf(locus: SketchLocus, objects: SketchObject[], settled: Settled): LocusShape | null {
  const domain = pathIn(settled, locus.domain);
  const driver = settled.points.get(locus.driver);
  const before = objects.slice(
    0,
    objects.findIndex((object) => object.id === locus.id),
  );
  const driven = before.find((object) => object.id === locus.driven);
  if (!domain || !driver || !driven) return null;
  // What has to be worked out again for each sample: everything hanging off
  // the driver, in the order it was built, the driver itself excepted.
  const family = withDependents(before, [locus.driver]);
  const chain = before.filter(
    (object) => family.has(object.id) && object.id !== locus.driver && !isLocus(object),
  );
  const read = isPoint(driven)
    ? (from: Settled) => from.points.get(driven.id)
    : isLine(driven)
      ? (from: Settled) => from.lines.get(driven.id)
      : isCircle(driven)
        ? (from: Settled) => from.circles.get(driven.id)
        : isArc(driven)
          ? (from: Settled) => from.arcs.get(driven.id)
          : (from: Settled) => from.shapes.get(driven.id);
  const count = Math.max(2, Math.min(MAX_SAMPLES, Math.round(locus.samples)));
  const at: (Position | LineGeometry | CircleGeometry | ArcGeometry | Position[])[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = locus.span[0] + ((locus.span[1] - locus.span[0]) * index) / (count - 1);
    const scratch: Settled = {
      points: new Map(settled.points),
      values: settled.values,
      lines: new Map(settled.lines),
      circles: new Map(settled.circles),
      arcs: new Map(settled.arcs),
      shapes: new Map(settled.shapes),
      loci: settled.loci,
    };
    scratch.points.set(driver.id, { ...driver, ...spotOnPath(domain, t) });
    for (const object of chain) place(object, scratch);
    const found = read(scratch);
    // A settled point carries more than a place, so only its place is kept.
    if (found) at.push("x" in found ? { x: found.x, y: found.y } : found);
  }
  if (at.length === 0) return null;
  if (isPoint(driven)) return { kind: "points", at: at as Position[] };
  if (isLine(driven)) return { kind: "lines", at: at as LineGeometry[] };
  if (isCircle(driven)) return { kind: "circles", at: at as CircleGeometry[] };
  if (isArc(driven)) return { kind: "arcs", at: at as ArcGeometry[] };
  return { kind: "shapes", at: at as Position[][] };
}

/**
 * How a number on the sheet is read, in centimetres and degrees. Working one out
 * lives in `measure.ts`, which is built on this file and so cannot be reached
 * from it, so that module hands the reader over as it loads. The same seam
 * `writeIn` uses to set the units readings are written in.
 */
type ValueReader = (
  object: SketchObject,
  objects: SketchObject[],
  settled: Settled,
) => Quantity | null;

let readValue: ValueReader | null = null;

export function readValuesWith(reader: ValueReader): void {
  readValue = reader;
}

export function settle(objects: SketchObject[]): { objects: SketchObject[]; settled: Settled } {
  const settled: Settled = {
    values: new Map(),
    points: new Map(),
    lines: new Map(),
    circles: new Map(),
    arcs: new Map(),
    shapes: new Map(),
    loci: new Map(),
  };
  let moved = false;
  const next = objects.map((object) => {
    if (isLocus(object)) {
      const shape = locusOf(object, objects, settled);
      if (shape) settled.loci.set(object.id, shape);
      return object;
    }
    // A number settles here too, so a transform later in the list can follow
    // one. Parents always come earlier than what hangs off them, so by the time
    // a transform is reached whatever it follows has already been worked out.
    if (isValue(object)) {
      settled.values.set(object.id, readValue?.(object, objects, settled) ?? null);
      return object;
    }
    place(object, settled);
    if (!isPoint(object)) return object;
    const image = settled.points.get(object.id);
    if (!image || (image.x === object.x && image.y === object.y)) return object;
    moved = true;
    return image;
  });
  return { objects: moved ? next : objects, settled };
}

export function resolve(objects: SketchObject[]): SketchObject[] {
  return settle(objects).objects;
}

/** The given objects, and everything that hangs off them however far down. */
export function withDependents(objects: SketchObject[], ids: string[]): Set<string> {
  const going = new Set(ids);
  for (const object of objects) {
    const parents = familyOf(object);
    if (!parents) continue;
    if (parents.some((parent) => going.has(parent))) going.add(object.id);
  }
  return going;
}

/**
 * The stretch of a straight object that lies inside a rectangle, or null when
 * none of it does. A segment is cut at both ends, a ray only at the first and a
 * line at neither, which is the whole of what tells the three apart: this both
 * draws them and decides whether a marquee has caught one.
 */
export function clipToRect(line: LineGeometry, rect: Rect): [Position, Position] | null {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  if (dx === 0 && dy === 0) return null;
  let near = line.form === "line" ? -FAR : 0;
  let far = line.form === "segment" ? 1 : FAR;
  const edges: [number, number][] = [
    [-dx, line.a.x - rect.x],
    [dx, rect.x + rect.width - line.a.x],
    [-dy, line.a.y - rect.y],
    [dy, rect.y + rect.height - line.a.y],
  ];
  for (const [towards, room] of edges) {
    if (towards === 0) {
      // Parallel to this edge, so it is either wholly inside it or wholly out.
      if (room < 0) return null;
      continue;
    }
    const t = room / towards;
    if (towards < 0) near = Math.max(near, t);
    else far = Math.min(far, t);
    if (near > far) return null;
  }
  return [
    { x: line.a.x + dx * near, y: line.a.y + dy * near },
    { x: line.a.x + dx * far, y: line.a.y + dy * far },
  ];
}

/**
 * How far along a path a point sits, as the fraction of the way from the first
 * of its two defining points to the second, kept to where the path runs: a
 * segment stops at both ends, a ray at the first, a line at neither.
 */
export function alongPath(path: PathGeometry, at: Position): number {
  // An arc has two ends, so a point on it stops at them the way it stops at
  // the ends of a segment.
  if (isArcPath(path)) return Math.min(1, Math.max(0, turnOn(path, at)));
  if (isRound(path)) {
    // Round a circle there is no end to stop at: the way round wraps.
    const turn = (Math.atan2(at.y - path.at.y, at.x - path.at.x) - path.ref) / (Math.PI * 2);
    return turn - Math.floor(turn);
  }
  const dx = path.b.x - path.a.x;
  const dy = path.b.y - path.a.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return 0;
  const t = ((at.x - path.a.x) * dx + (at.y - path.a.y) * dy) / span;
  if (path.form !== "line" && t < 0) return 0;
  if (path.form === "segment" && t > 1) return 1;
  return t;
}

/** A point sitting somewhere along a path, which it can then be dragged along. */
export function pointOnPath(
  path: SketchObject,
  where: PathGeometry,
  at: Position,
  size: PointSize,
): SketchPoint | null {
  const from: Derivation = { kind: "on", path: path.id, at: alongPath(where, at) };
  return createPoint(spotOnPath(where, from.at), size, from);
}

/** How far a spot is from a path, whichever kind of path it is. */
export function distanceToPath(path: PathGeometry, at: Position): number {
  if (isArcPath(path)) {
    if (path.flat) {
      return distanceToLine({ a: path.flat[0], b: path.flat[1], form: "segment" }, at);
    }
    // Off the end of the arc, the nearest part of it is that end.
    return distance(spotOnPath(path, alongPath(path, at)), at);
  }
  if (!isRound(path)) return distanceToLine(path, at);
  return Math.abs(distance(path.at, at) - path.radius);
}

/** Whether a spot lands on a locus: on the curve, on a sample, or inside one. */
function nearLocus(shape: LocusShape, at: Position, slack: number): boolean {
  if (shape.kind === "arcs") {
    return shape.at.some((arc) => distanceToPath(arc, at) <= slack);
  }
  if (shape.kind === "circles") {
    return shape.at.some((round) => distanceToPath(round, at) <= slack);
  }
  if (shape.kind === "lines") return shape.at.some((line) => distanceToLine(line, at) <= slack);
  if (shape.kind === "shapes") return shape.at.some((corners) => insideShape(corners, at));
  return shape.at.some((spot, index) => {
    if (index === 0) return distance(spot, at) <= slack;
    const step: LineGeometry = { a: shape.at[index - 1], b: spot, form: "segment" };
    return distanceToLine(step, at) <= slack;
  });
}

/** How far a point sits from a straight object, respecting where it stops. */
export function distanceToLine(line: LineGeometry, at: Position): number {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return distance(line.a, at);
  let t = ((at.x - line.a.x) * dx + (at.y - line.a.y) * dy) / span;
  if (line.form !== "line" && t < 0) t = 0;
  if (line.form === "segment" && t > 1) t = 1;
  return distance({ x: line.a.x + dx * t, y: line.a.y + dy * t }, at);
}

/**
 * How big a mark is drawn, in screen pixels, so it stays the same size at every
 * zoom the way a point does.
 */
const TICK_HALF = 7.5;
const TICK_GAP = 5;
const ARROW_HALF = 6.9;
const ARROW_DEPTH = 6.25;
const ARROW_GAP = 6.25;
export const ANGLE_RADIUS = 20;
const ANGLE_GAP = 4.5;
/** The arcs never close right up on the corner, however hard they are dragged. */
export const LEAST_ANGLE_RADIUS = 8;
/** How near the pointer has to come to a mark to catch it. */
const MARK_REACH = 9;
/** The room left between two marks sharing a spot on a path. */
const GROUP_GAP = 5;

/**
 * Where a mark is drawn: a tick sits at a spot on its path and lies along it,
 * an angle mark turns about its corner from one arm to the other.
 */
export type MarkShape =
  | { form: "equal" | "parallel"; at: Position; way: Position; strokes: number }
  | {
      form: "angle";
      at: Position;
      from: number;
      sweep: number;
      strokes: number;
      /** How far out the innermost arc runs, in screen pixels. */
      radius: number;
      /** Drawn as the square a right angle is customarily drawn with. */
      square: boolean;
    };

/**
 * A right angle is ninety and nothing else. The slack is there for the floating
 * point arithmetic the angle came out of, not to round a hand-drawn corner up.
 */
const RIGHT_SLACK = 1e-6;

/** Whether a turn is a right angle, which is what draws as the square. */
export function isRightAngle(sweep: number): boolean {
  return Math.abs(Math.abs((sweep * 180) / Math.PI) - 90) <= RIGHT_SLACK;
}

/**
 * The turn from one arm to the other: the short way round for the angle itself,
 * and the long way for the reflex angle on the other side of it.
 */
export function markSweep(from: number, to: number, reflex: boolean): number {
  const short = turnBetweenAngles(from, to);
  if (!reflex) return short;
  return short > 0 ? short - TURN : short + TURN;
}

/** A vector cut down to length one, or pointing along x when it has none. */
function unitOf(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
}

/** Which way a path is running at a given point along it. */
export function tangentOnPath(path: PathGeometry, at: number): Position {
  if (isArcPath(path)) {
    if (path.flat) return unitOf(path.flat[1].x - path.flat[0].x, path.flat[1].y - path.flat[0].y);
    const angle = path.from + path.sweep * at;
    const way = path.sweep < 0 ? -1 : 1;
    return { x: -Math.sin(angle) * way, y: Math.cos(angle) * way };
  }
  if (isRound(path)) {
    const angle = path.ref + at * TURN;
    return { x: -Math.sin(angle), y: Math.cos(angle) };
  }
  return unitOf(path.b.x - path.a.x, path.b.y - path.a.y);
}

/** The turn from one angle to another, taken the short way round. */
function turnBetweenAngles(from: number, to: number): number {
  return ((((to - from) % TURN) + TURN + Math.PI) % TURN) - Math.PI;
}

/**
 * How far along the path a mark reaches, in screen pixels: the strokes it holds
 * and the gaps between them.
 */
function markWidth(mark: SketchMark): number {
  if (!("path" in mark)) return 0;
  const gap = mark.form === "equal" ? TICK_GAP : ARROW_GAP;
  const own = mark.form === "equal" ? 2 : ARROW_DEPTH;
  return (mark.strokes - 1) * gap + own;
}

/**
 * The marks sharing a spot on a path, in the order they were made. Two marks
 * put at the same point are one group: they are laid out side by side and the
 * pair sits centred on that point, so a side can say equal and parallel at once
 * without one being drawn over the other.
 */
function groupOf(mark: SketchMark, objects: SketchObject[]): SketchMark[] {
  if (!("path" in mark)) return [mark];
  const group = objects.filter(
    (other): other is SketchMark =>
      isMark(other) && "path" in other && other.path === mark.path && other.at === mark.at,
  );
  // Bars go on the fat side of an arrowhead, never the pointy one, so a side
  // that says equal and parallel at once reads the way it is drawn by hand.
  const arrow = group.find((other) => other.form === "parallel");
  if (!arrow) return group;
  const tailFirst = "flipped" in arrow ? arrow.flipped !== true : true;
  return [...group].sort((one, other) => {
    if (one.form === other.form) return 0;
    const bars = one.form === "equal" ? -1 : 1;
    return tailFirst ? bars : -bars;
  });
}

/** Where a mark lands once the figure it marks has settled. */
export function markShape(
  mark: SketchMark,
  settled: Settled,
  objects: SketchObject[] = [],
  scale = 1,
): MarkShape | null {
  if ("path" in mark) {
    const path = pathIn(settled, mark.path);
    if (!path) return null;
    const way = tangentOnPath(path, mark.at);
    const spot = spotOnPath(path, mark.at);
    // Where it sits in its group, measured from the group's left hand end.
    const group = groupOf(mark, objects);
    const widths = group.map(markWidth);
    const whole = widths.reduce((sum, width) => sum + width, 0) + (group.length - 1) * GROUP_GAP;
    const before = widths
      .slice(
        0,
        Math.max(
          0,
          group.findIndex((other) => other.id === mark.id),
        ),
      )
      .reduce((sum, width) => sum + width + GROUP_GAP, 0);
    const off = (before + markWidth(mark) / 2 - whole / 2) / scale;
    return {
      form: mark.form,
      at: { x: spot.x + way.x * off, y: spot.y + way.y * off },
      way: mark.flipped ? { x: -way.x, y: -way.y } : way,
      strokes: mark.strokes,
    };
  }
  const corner = settled.points.get(mark.corner);
  const arms = mark.arms.map((id) => settled.points.get(id));
  if (!corner || arms.some((arm) => arm === undefined)) return null;
  const [one, other] = arms as SketchPoint[];
  const from = Math.atan2(one.y - corner.y, one.x - corner.x);
  const to = Math.atan2(other.y - corner.y, other.x - corner.x);
  const sweep = markSweep(from, to, mark.reflex === true);
  return {
    form: "angle",
    at: { x: corner.x, y: corner.y },
    from,
    sweep,
    strokes: mark.strokes,
    radius: mark.radius ?? ANGLE_RADIUS,
    square: mark.square ?? isRightAngle(sweep),
  };
}

/** 0, 1, ... n - 1. */
function runOf(count: number): number[] {
  return Array.from({ length: count }, (_, nth) => nth);
}

/**
 * The strokes a mark is drawn with, each an SVG path in sheet coordinates:
 * bars across the path, arrowheads along it, or arcs about the corner.
 */
export function markStrokes(shape: MarkShape, scale: number): string[] {
  const spot = (at: Position) => `${at.x} ${at.y}`;
  if (shape.form === "angle") {
    const way = shape.sweep < 0 ? 0 : 1;
    // A reflex angle goes round the long way, so its arcs are the big ones.
    const large = Math.abs(shape.sweep) > Math.PI ? 1 : 0;
    // The square a right angle is drawn with: out along one arm, across the
    // corner of the wedge, and back down the other. Off a right angle it comes
    // out as the kite the same three points make, which is what a marker forced
    // to the square on a wider angle should look like.
    if (shape.square) {
      return runOf(shape.strokes).map((nth) => {
        const radius = (shape.radius + nth * ANGLE_GAP) / scale;
        const middle = shape.from + shape.sweep / 2;
        const out = (angle: number, reach: number) => ({
          x: shape.at.x + Math.cos(angle) * reach,
          y: shape.at.y + Math.sin(angle) * reach,
        });
        const one = out(shape.from, radius);
        const other = out(shape.from + shape.sweep, radius);
        const far = out(middle, radius * Math.SQRT2);
        return `M ${spot(one)} L ${spot(far)} L ${spot(other)}`;
      });
    }
    return runOf(shape.strokes).map((nth) => {
      const radius = (shape.radius + nth * ANGLE_GAP) / scale;
      const start = {
        x: shape.at.x + Math.cos(shape.from) * radius,
        y: shape.at.y + Math.sin(shape.from) * radius,
      };
      const end = {
        x: shape.at.x + Math.cos(shape.from + shape.sweep) * radius,
        y: shape.at.y + Math.sin(shape.from + shape.sweep) * radius,
      };
      return `M ${spot(start)} A ${radius} ${radius} 0 ${large} ${way} ${spot(end)}`;
    });
  }
  const way = shape.way;
  const across = { x: -way.y, y: way.x };
  const gap = (shape.form === "equal" ? TICK_GAP : ARROW_GAP) / scale;
  const half = (shape.form === "equal" ? TICK_HALF : ARROW_HALF) / scale;
  const depth = ARROW_DEPTH / scale;
  return runOf(shape.strokes).map((nth) => {
    const off = (nth - (shape.strokes - 1) / 2) * gap;
    const centre = { x: shape.at.x + way.x * off, y: shape.at.y + way.y * off };
    if (shape.form === "equal") {
      const one = { x: centre.x - across.x * half, y: centre.y - across.y * half };
      const other = { x: centre.x + across.x * half, y: centre.y + across.y * half };
      return `M ${spot(one)} L ${spot(other)}`;
    }
    // An arrowhead points the way the path runs, so a pair of parallel sides
    // reads as going the same way rather than as two loose chevrons.
    const tip = { x: centre.x + way.x * (depth / 2), y: centre.y + way.y * (depth / 2) };
    const back = { x: tip.x - way.x * depth, y: tip.y - way.y * depth };
    const one = { x: back.x + across.x * half, y: back.y + across.y * half };
    const other = { x: back.x - across.x * half, y: back.y - across.y * half };
    return `M ${spot(one)} L ${spot(tip)} L ${spot(other)}`;
  });
}

/** How far out an angle mark's outermost arc runs, in screen pixels. */
export function markReach(mark: SketchMark): number {
  if ("path" in mark) return 0;
  return (mark.radius ?? ANGLE_RADIUS) + (mark.strokes - 1) * ANGLE_GAP;
}

/** Whether a spot catches a mark, which is how the Marker tool picks one up. */
export function nearMark(
  mark: SketchMark,
  at: Position,
  scale: number,
  settled: Settled,
  objects: SketchObject[] = [],
): boolean {
  const shape = markShape(mark, settled, objects, scale);
  if (!shape) return false;
  if (shape.form !== "angle") {
    const spread = ((shape.strokes - 1) / 2) * (TICK_GAP / scale);
    return distance(shape.at, at) <= MARK_REACH / scale + spread;
  }
  // The mark is the arcs, not the wedge they are drawn across. The band they
  // run in is one thing to click, so no single arc has to be hit on its own,
  // but the middle of the wedge and the corner it turns about belong to the
  // figure underneath: a mark that caught its whole sector would swallow every
  // press on the point it turns about, and a corner wearing a few marks could
  // not be pressed at all.
  const spread = (shape.strokes - 1) * ANGLE_GAP;
  // The square a right angle wears runs out to the far corner of its wedge.
  const far = shape.square ? shape.radius * Math.SQRT2 : shape.radius;
  const out = distance(shape.at, at);
  if (out < (shape.radius - MARK_REACH) / scale) return false;
  if (out > (far + spread + MARK_REACH) / scale) return false;
  const turn = turnBetweenAngles(shape.from, Math.atan2(at.y - shape.at.y, at.x - shape.at.x));
  return shape.sweep < 0 ? turn <= 0 && turn >= shape.sweep : turn >= 0 && turn <= shape.sweep;
}

/** A tick riding a path, put down a given fraction of the way along it. */
export function createTick(
  form: "equal" | "parallel",
  path: string,
  at: number,
  strokes: number,
  flipped: boolean,
): SketchMark {
  return { id: nextId("mark"), kind: "mark", form, path, at, strokes, flipped };
}

/** A mark on one of the angles the sides make where they meet. */
export function createAngleMark(
  corner: string,
  arms: [string, string],
  sides: [string, string],
  strokes: number,
  reflex: boolean,
  radius: number,
): SketchMark {
  return {
    id: nextId("mark"),
    kind: "mark",
    form: "angle",
    corner,
    arms,
    sides,
    strokes,
    reflex,
    radius,
  };
}

/**
 * Where along a segment a mark should land: the midpoint when the click comes
 * near it, since that is where a tick belongs, and otherwise where the click
 * landed. No midpoint is constructed; the mark simply rides the middle.
 */
export function markAlong(path: PathGeometry, at: Position, scale: number): number {
  const along = alongPath(path, at);
  if (isRound(path) || isArcPath(path) || path.form !== "segment") return along;
  const middle = spotOnPath(path, 0.5);
  return distance(middle, at) <= slackAt(scale) * 2 ? 0.5 : along;
}

/**
 * Topmost object under the pointer, or null. Points win over lines wherever the
 * two overlap, since a line always has points sitting on it; among their own
 * kind, later objects sit on top.
 */
export function objectAt(
  objects: SketchObject[],
  at: Position,
  scale: number,
  settled = settle(objects).settled,
): SketchObject | null {
  const slack = slackAt(scale);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isPoint(object) && distance(object, at) <= radiusOf(object) / scale + slack) {
      return object;
    }
  }
  // A mark is drawn over what it marks, so it is picked before it: clicking a
  // tick catches the tick rather than the side it sits on.
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isMark(object) && nearMark(object, at, scale, settled, objects)) return object;
  }
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isLocus(object)) {
      const shape = settled.loci.get(object.id);
      if (shape && nearLocus(shape, at, slack)) return object;
      continue;
    }
    if (!isLine(object) && !isCircle(object) && !isArc(object)) continue;
    const along = pathIn(settled, object.id);
    if (along && distanceToPath(along, at) <= slack) return object;
  }
  // A fill picks anywhere inside it, and so comes last: a point or a line
  // lying on top of one is what you meant to click.
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (!isInterior(object)) continue;
    const inside = filledPath(object);
    if (inside) {
      const wedge = wedgeOf(object);
      const arc = wedge ? settled.arcs.get(inside) : undefined;
      if (arc) {
        if (insideWedge(arc, wedge as "sector" | "segment", at)) return object;
        continue;
      }
      const where = settled.circles.get(inside);
      if (where && distance(where.at, at) <= where.radius) return object;
      continue;
    }
    const corners = settled.shapes.get(object.id);
    if (corners && insideShape(corners, at)) return object;
  }
  return null;
}

export function endsById(objects: SketchObject[]): Map<string, SketchPoint> {
  return new Map(pointsOf(objects).map((point) => [point.id, point]));
}

export function rectBetween(a: Position, b: Position): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Whether a circle's rim runs through a rectangle: the nearest corner of the
 * rectangle is inside the rim and the furthest is outside, or the other way
 * about.
 */
function ringTouches(round: CircleGeometry, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const near = {
    x: Math.min(Math.max(round.at.x, left), right),
    y: Math.min(Math.max(round.at.y, top), bottom),
  };
  const far = {
    x: round.at.x - left > right - round.at.x ? left : right,
    y: round.at.y - top > bottom - round.at.y ? top : bottom,
  };
  return distance(round.at, near) <= round.radius && distance(round.at, far) >= round.radius;
}

/** Whether an arc runs through a rectangle, walked a step at a time. */
function arcTouches(arc: ArcGeometry, rect: Rect): boolean {
  if (arc.flat) return clipToRect(wholePath(arc) as LineGeometry, rect) !== null;
  const steps = 32;
  for (let step = 0; step < steps; step += 1) {
    const one = spotOnPath(arc, step / steps);
    const next = spotOnPath(arc, (step + 1) / steps);
    if (clipToRect({ a: one, b: next, form: "segment" }, rect)) return true;
  }
  return false;
}

/**
 * Marquee catch. Touching is enough: an object does not have to sit inside the
 * rectangle, so a point counts as soon as its dot overlaps.
 */
export function objectsTouching(
  objects: SketchObject[],
  rect: Rect,
  scale: number,
  settled = settle(objects).settled,
): SketchObject[] {
  return objects.filter((object) => {
    if (isLocus(object)) {
      const shape = settled.loci.get(object.id);
      if (!shape) return false;
      if (shape.kind === "arcs") return shape.at.some((arc) => arcTouches(arc, rect));
      if (shape.kind === "circles") {
        return shape.at.some((round) => ringTouches(round, rect));
      }
      if (shape.kind === "lines") {
        return shape.at.some((line) => clipToRect(line, rect) !== null);
      }
      if (shape.kind === "shapes") {
        return shape.at.some((corners) =>
          edgesOf(corners).some((edge) => clipToRect(edge, rect) !== null),
        );
      }
      return shape.at.some(
        (spot) =>
          spot.x >= rect.x &&
          spot.x <= rect.x + rect.width &&
          spot.y >= rect.y &&
          spot.y <= rect.y + rect.height,
      );
    }
    if (isInterior(object)) {
      const inside = filledPath(object);
      if (inside) {
        const wedge = wedgeOf(object);
        const arc = wedge ? settled.arcs.get(inside) : undefined;
        if (arc) {
          // The rim being caught is the usual way in, and a rectangle wholly
          // inside the wedge counts too.
          return (
            arcTouches(arc, rect) ||
            insideWedge(arc, wedge as "sector" | "segment", { x: rect.x, y: rect.y })
          );
        }
        const where = settled.circles.get(inside);
        if (!where) return false;
        // Any overlap counts, so the nearest corner of the rectangle being
        // inside the circle is enough.
        const near = {
          x: Math.min(Math.max(where.at.x, rect.x), rect.x + rect.width),
          y: Math.min(Math.max(where.at.y, rect.y), rect.y + rect.height),
        };
        return distance(where.at, near) <= where.radius;
      }
      const corners = settled.shapes.get(object.id);
      if (!corners) return false;
      // Touching is enough, so an edge crossing the marquee counts, and so
      // does a marquee drawn wholly inside the shape.
      return (
        edgesOf(corners).some((edge) => clipToRect(edge, rect) !== null) ||
        insideShape(corners, { x: rect.x, y: rect.y })
      );
    }
    if (isCircle(object)) {
      const round = settled.circles.get(object.id);
      return round ? ringTouches(round, rect) : false;
    }
    if (isArc(object)) {
      const arc = settled.arcs.get(object.id);
      return arc ? arcTouches(arc, rect) : false;
    }
    // Nothing on the sheet to catch: it is a relationship between two points.
    if (isTransform(object)) return false;
    // A button is caught by what it covers, which is read off its box.
    if (isButton(object)) return false;
    if (isLine(object)) {
      const along = settled.lines.get(object.id);
      return along ? clipToRect(along, rect) !== null : false;
    }
    // Writing is drawn over the sheet rather than in it, so what it covers is
    // measured where it is drawn and a marquee is told about it from there.
    if (isWriting(object)) return false;
    // A mark is caught where it is drawn: the spot a tick rides, or the corner
    // an angle mark turns about.
    if (isMark(object)) {
      const shape = markShape(object, settled, objects, scale);
      if (!shape) return false;
      return (
        shape.at.x >= rect.x &&
        shape.at.x <= rect.x + rect.width &&
        shape.at.y >= rect.y &&
        shape.at.y <= rect.y + rect.height
      );
    }
    const reach = radiusOf(object) / scale;
    return (
      object.x >= rect.x - reach &&
      object.x <= rect.x + rect.width + reach &&
      object.y >= rect.y - reach &&
      object.y <= rect.y + rect.height + reach
    );
  });
}

/**
 * The size the selected points share, or null when they differ or when nothing
 * is selected. This is what Point Style ticks.
 */
export function sharedPointSize(state: SketchState): PointSize | null {
  const selected = pointsOf(state.objects).filter((object) => state.selection.includes(object.id));
  if (selected.length === 0) return null;
  const first = selected[0].size;
  return selected.every((object) => object.size === first) ? first : null;
}

/** How far a pasted copy steps off what it came from, in sheet units. */
export const PASTE_STEP = 16;

/**
 * These objects and everything they hang off, in the order the sketch holds
 * them. A segment cannot exist without its ends, so copying one takes them
 * too, and copying a figure takes whatever it was built on.
 */
export function withFamily(objects: SketchObject[], ids: string[]): SketchObject[] {
  const wanted = new Set<string>();
  const walk = (id: string) => {
    if (wanted.has(id)) return;
    const object = objects.find((candidate) => candidate.id === id);
    if (!object) return;
    wanted.add(id);
    for (const parent of familyOf(object) ?? []) walk(parent);
  };
  for (const id of ids) walk(id);
  return objects.filter((object) => wanted.has(object.id));
}

/**
 * The same objects again as a copy: new ids, no pinned names, and stepped off
 * where they came from so the copy is not hiding under the original. The step
 * grows with each paste of the same copy, so pasting twice gives two.
 *
 * The ids are swapped over the serialised text rather than field by field. An
 * object points at another in a dozen different shapes and a caption's links
 * are buried in its markup, while an id is unique enough that no other text in
 * a sketch can collide with one.
 */
/**
 * The same objects again with fresh ids, for a page being copied. Unlike a
 * paste nothing moves and nothing is renamed: a duplicate page is meant to be
 * the same page, and two pages never share a sheet for their names to clash on.
 */
export function asDuplicated(taken: SketchObject[]): SketchObject[] {
  if (taken.length === 0) return [];
  let text = JSON.stringify(taken);
  for (const object of taken) text = text.split(object.id).join(nextId(object.kind));
  return JSON.parse(text) as SketchObject[];
}

export function asPasted(taken: SketchObject[], step: number): SketchObject[] {
  if (taken.length === 0) return [];
  let text = JSON.stringify(taken);
  for (const object of taken) text = text.split(object.id).join(nextId(object.kind));
  const made = JSON.parse(text) as SketchObject[];
  const off = PASTE_STEP * step;
  for (const object of made) {
    // A copy takes the next free name of its run rather than the one it came
    // with, since two points called A can never both be on the sheet.
    if (object.label?.name !== undefined) {
      object.label = { shown: object.label.shown, off: object.label.off };
    }
    // Only what is placed by hand moves. Everything derived follows its
    // parents, and a mark rides whatever it marks.
    if (isPoint(object) && object.from) continue;
    if (isPoint(object) || isCaption(object) || isMeasurement(object)) {
      object.x += off;
      object.y += off;
    }
  }
  return made;
}

/**
 * One step up or down the family tree, which is what Select Parents and Select
 * Children take. Parents are what an object depends on directly, children what
 * depends on it directly.
 *
 * An object with none of them stays selected, since there is nowhere to go. An
 * object whose kin are hidden drops out of the selection instead, because a
 * hidden object is not on the sheet to be handed.
 */
export function kinOf(
  objects: SketchObject[],
  ids: string[],
  way: "parents" | "children",
): string[] {
  const has = (id: string) => objects.find((candidate) => candidate.id === id);
  const next = new Set<string>();
  for (const id of ids) {
    const object = has(id);
    if (!object) continue;
    const kin =
      way === "parents"
        ? (familyOf(object) ?? []).filter(has)
        : objects
            .filter((candidate) => (familyOf(candidate) ?? []).includes(id))
            .map((candidate) => candidate.id);
    if (kin.length === 0) {
      next.add(id);
      continue;
    }
    for (const relative of kin) {
      if (has(relative)?.hidden !== true) next.add(relative);
    }
  }
  return [...next];
}

/** What each weight is worth on screen, in pixels. Strokes do not scale. */
const WEIGHTS: Record<LineWidth, number> = {
  hairline: 0.75,
  thin: 1.5,
  medium: 2.5,
  thick: 4,
};

/** How each pattern dashes, in pixels. Solid says nothing at all. */
const DASHES: Record<LinePattern, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "0.1 3.5",
};

/** How heavy a fill sits, so what is drawn on top of it stays readable. */
const FILL_ALPHA = 0.25;

/**
 * What a stroked object says about how it is drawn: its colour, how heavy it
 * is and how it dashes. What it does not say is left to the stylesheet, which
 * is where every object's default lives.
 */
export function strokeLook(object: SketchObject): CSSProperties {
  const look: CSSProperties = {};
  if (object.colour) look.stroke = `var(${object.colour})`;
  if (object.weight) look.strokeWidth = WEIGHTS[object.weight];
  if (object.pattern) {
    look.strokeDasharray = DASHES[object.pattern];
    if (object.pattern === "dotted") look.strokeLinecap = "round";
  }
  return look;
}

/** The same for a fill: a point's dot, a polygon's interior, a locus's wash. */
export function fillLook(object: SketchObject, wash: boolean): CSSProperties {
  if (!object.colour) return {};
  return wash
    ? { fill: `var(${object.colour})`, fillOpacity: FILL_ALPHA }
    : { fill: `var(${object.colour})`, fillOpacity: 1 };
}
