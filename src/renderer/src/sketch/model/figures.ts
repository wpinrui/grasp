import type { Position } from "./geometry";
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

export function radiusOf(point: SketchPoint): number {
  return POINT_RADII[point.size];
}
