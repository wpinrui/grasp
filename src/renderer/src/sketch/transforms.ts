/**
 * What the Transform dialogs work out: the vector, angle or ratio they were
 * given, turned into one derivation per selected point.
 *
 * Nothing here makes a point. The preview asks for positions, and only pressing
 * the dialog's button turns those into points with ids, so a dialog left open
 * costs nothing.
 */

import {
  cornersOf,
  createArc,
  createCircle,
  createFill,
  createInterior,
  createPoint,
  type Derivation,
  endsById,
  filledPath,
  imageOf,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  lineThrough,
  type MarkedAngle,
  type MarkedRatio,
  type MarkedVector,
  type PointSize,
  PX_PER_CM,
  type Settled,
  type SketchArc,
  type SketchObject,
  type SketchPoint,
  settle,
} from "./model";

export type TransformKind = "translate" | "rotate" | "dilate" | "reflect";

export interface TranslateValues {
  mode: "polar" | "rectangular" | "marked";
  distance: string;
  angle: string;
  horizontal: string;
  vertical: string;
  /** Whether the polar halves are the numbers typed or the marked ones. */
  markedDistance: boolean;
  markedAngle: boolean;
  /** Whether the two rectangular distances are typed or marked. */
  markedPair: boolean;
  /** The two ends of a marked vector, picked by clicking the sheet. */
  from: string | null;
  to: string | null;
}

export interface RotateValues {
  degrees: string;
  /** Whether it turns by the number typed or by the marked angle. */
  marked: boolean;
}

export interface DilateValues {
  /** The ratio as it is written in the dialog: new over old. */
  top: string;
  bottom: string;
  /** Whether it scales by the numbers typed or by the marked ratio. */
  marked: boolean;
}

/**
 * What the sketch has marked, which a transform can follow instead of being
 * given a number. Held by the window rather than by any dialog, so a mark stays
 * marked until one of the same kind replaces it.
 */
export interface Marks {
  angle: MarkedAngle | null;
  ratio: MarkedRatio | null;
  /** One distance for a polar translation, or two for a rectangular one. */
  distances: string[];
}

export const NO_MARKS: Marks = { angle: null, ratio: null, distances: [] };

export interface TransformValues {
  translate: TranslateValues;
  rotate: RotateValues;
  dilate: DilateValues;
}

export const DEFAULT_VALUES: TransformValues = {
  translate: {
    mode: "polar",
    distance: "1.0",
    angle: "90.0",
    horizontal: "1.0",
    vertical: "1.0",
    markedDistance: false,
    markedAngle: false,
    markedPair: false,
    from: null,
    to: null,
  },
  rotate: { degrees: "90.0", marked: false },
  dilate: { top: "1.0", bottom: "2.0", marked: false },
};

/** A field is only good when it holds a number. Empty is not a number. */
function reading(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function positionOf(objects: SketchObject[], id: string | null) {
  return id ? endsById(objects).get(id) : undefined;
}

/**
 * The vector the Translate dialog is describing: where it points now, and what
 * it follows where either half was marked rather than typed. The numbers are
 * kept even on a marked vector, since a polar one with only its distance marked
 * reads its direction back off them.
 */
function translation(
  values: TranslateValues,
  objects: SketchObject[],
  marks: Marks,
): { dx: number; dy: number; by?: MarkedVector } | null {
  if (values.mode === "polar") {
    const distance = reading(values.distance);
    const angle = reading(values.angle);
    if (distance === null || angle === null) return null;
    const radians = (angle * Math.PI) / 180;
    // Counterclockwise from east, on a sheet whose y counts downward.
    const held = {
      dx: distance * PX_PER_CM * Math.cos(radians),
      dy: -distance * PX_PER_CM * Math.sin(radians),
    };
    if (!values.markedDistance && !values.markedAngle) return held;
    if (values.markedDistance && marks.distances.length === 0) return null;
    if (values.markedAngle && !marks.angle) return null;
    return {
      ...held,
      by: {
        kind: "polar",
        distance: values.markedDistance ? marks.distances[0] : undefined,
        angle: values.markedAngle ? (marks.angle ?? undefined) : undefined,
      },
    };
  }
  if (values.mode === "rectangular") {
    const horizontal = reading(values.horizontal);
    const vertical = reading(values.vertical);
    if (horizontal === null || vertical === null) return null;
    const held = { dx: horizontal * PX_PER_CM, dy: -vertical * PX_PER_CM };
    if (!values.markedPair) return held;
    // Two distances: the first across, the second up.
    if (marks.distances.length < 2) return null;
    return {
      ...held,
      by: { kind: "distances", horizontal: marks.distances[0], vertical: marks.distances[1] },
    };
  }
  const from = positionOf(objects, values.from);
  const to = positionOf(objects, values.to);
  if (!from || !to || !values.from || !values.to) return null;
  return {
    dx: to.x - from.x,
    dy: to.y - from.y,
    by: { kind: "points", from: values.from, to: values.to },
  };
}

/**
 * How the dialog would place the image of one point, or null while it cannot be
 * answered yet. Null is what greys the action button and hides the preview.
 */
/** What the transform dialog was left holding, which is what its maker follows. */
export interface TransformAnswer {
  values: TransformValues;
  objects: SketchObject[];
  /** What a rotation or a dilation turns about. */
  centre: string | null;
  /** What a reflection is across. */
  mirror: string | null;
  marks?: Marks;
}

export function makerFor(
  kind: TransformKind,
  answer: TransformAnswer,
): ((of: string) => Derivation) | null {
  const { values, objects, centre, mirror, marks = NO_MARKS } = answer;
  if (kind === "translate") {
    const vector = translation(values.translate, objects, marks);
    return vector ? (of) => ({ kind: "translate", of, ...vector }) : null;
  }
  if (kind === "reflect") {
    return mirror ? (of) => ({ kind: "reflect", of, mirror }) : null;
  }
  if (!centre) return null;
  if (kind === "rotate") {
    const degrees = reading(values.rotate.degrees);
    if (degrees === null) return null;
    if (!values.rotate.marked) return (of) => ({ kind: "rotate", of, centre, degrees });
    const by = marks.angle;
    return by === null ? null : (of) => ({ kind: "rotate", of, centre, degrees, by });
  }
  const top = reading(values.dilate.top);
  const bottom = reading(values.dilate.bottom);
  if (top === null || bottom === null || bottom === 0) return null;
  const ratio = top / bottom;
  if (!values.dilate.marked) return (of) => ({ kind: "dilate", of, centre, ratio });
  const by = marks.ratio;
  return by === null ? null : (of) => ({ kind: "dilate", of, centre, ratio, by });
}

/** Points straight from derivations, for the constructions that build one. */
export function pointsFrom(
  derivations: Derivation[],
  objects: SketchObject[],
  size: PointSize,
): SketchObject[] {
  const settled = settle(objects).settled;
  return derivations.flatMap((from) => {
    const at = imageOf(from, settled);
    return at ? [createPoint(at, size, from)] : [];
  });
}

/** The points an arc is held by, the centre of its circle included. */
function arcPoints(arc: SketchArc, objects: SketchObject[]): string[] {
  const span = arc.span;
  if (span.kind === "through") return [span.from, span.via, span.to];
  if (span.kind === "centre") return [span.centre, span.from, span.to];
  const circle = objects.find((object) => object.id === span.circle);
  return circle && isCircle(circle) ? [circle.span.centre, span.from, span.to] : [];
}

/**
 * The points to image for a selection: the points in it, and every end of every
 * line in it, each one only once.
 */
function pointsToImage(chosen: SketchObject[], objects: SketchObject[]): string[] {
  const wanted: string[] = [];
  const add = (id: string) => {
    if (!wanted.includes(id)) wanted.push(id);
  };
  for (const object of chosen) {
    if (isPoint(object)) add(object.id);
    else if (isArc(object)) for (const held of arcPoints(object, objects)) add(held);
    else if (isCircle(object)) {
      // A circle drawn with the compass images through its two points. One
      // built from a segment's length has no radius point to image.
      if (object.span.kind === "through") {
        add(object.span.centre);
        add(object.span.edge);
      }
    } else if (isInterior(object)) for (const corner of cornersOf(object) ?? []) add(corner);
    else if (isLine(object) && object.span.kind === "through") {
      for (const end of object.span.ends) add(end);
    }
  }
  return wanted;
}

/**
 * Whether a transform can act on this selection at all: something has to be in
 * it, and a line built on another line has no ends to image, so it cannot come.
 */
export function transformable(selection: string[], objects: SketchObject[]): boolean {
  if (selection.length === 0) return false;
  const chosen = objects.filter((object) => selection.includes(object.id));
  return chosen.every(
    (object) =>
      isPoint(object) ||
      isInterior(object) ||
      isArc(object) ||
      (isLine(object) && object.span.kind === "through") ||
      (isCircle(object) && object.span.kind === "through"),
  );
}

/**
 * What a transform would make: an image of every point, and a copy of every
 * line joining the images of its ends, so a shape comes back a shape.
 *
 * The same call answers the preview and the button, so what you were shown is
 * exactly what lands.
 */
/**
 * How one point's image is made: the image itself, and anything built on the
 * way to it. A basic transform builds nothing on the way; a custom one replays
 * a whole chain, which is the only thing that differs between them.
 */
export type Imager = (
  id: string,
  settled: Settled,
) => { image: SketchPoint; along: SketchObject[] } | null;

export function transformed(
  selection: string[],
  make: (of: string) => Derivation,
  page: { objects: SketchObject[]; size: PointSize },
): SketchObject[] {
  const { objects, size } = page;
  return imagedBy(selection, objects, (id, settled) => {
    const from = make(id);
    const at = imageOf(from, settled);
    return at ? { image: createPoint(at, size, from), along: [] } : null;
  });
}

/**
 * The selection imaged: each point through the imager, and then everything the
 * selection holds rebuilt on those images, so a shape comes back a shape.
 */
export function imagedBy(
  selection: string[],
  objects: SketchObject[],
  imager: Imager,
): SketchObject[] {
  const chosen = objects.filter((object) => selection.includes(object.id));
  const settled = settle(objects).settled;
  const images = new Map<string, string>();
  const made: SketchObject[] = [];
  for (const id of pointsToImage(chosen, objects)) {
    const done = imager(id, settled);
    if (!done) continue;
    images.set(id, done.image.id);
    made.push(...done.along, done.image);
    settled.points.set(done.image.id, done.image);
  }
  for (const object of chosen) {
    if (isInterior(object)) {
      const round = filledPath(object);
      if (round) {
        // The circle it fills was imaged a moment ago, so the fill follows it.
        const image = images.get(round);
        if (image) made.push(createFill(image));
        continue;
      }
      const corners = (cornersOf(object) ?? []).map((corner) => images.get(corner));
      if (corners.every((corner) => corner !== undefined)) made.push(createInterior(corners));
      continue;
    }
    if (isArc(object)) {
      // However it was held, the image is held by a centre and two ends, since
      // the circle it was on may not be coming along.
      const held = arcPoints(object, objects).map((point) => images.get(point));
      if (!held.every((point) => point !== undefined)) continue;
      made.push(
        object.span.kind === "through"
          ? createArc({ kind: "through", from: held[0], via: held[1], to: held[2] })
          : createArc({ kind: "centre", centre: held[0], from: held[1], to: held[2] }),
      );
      continue;
    }
    if (isCircle(object)) {
      if (object.span.kind !== "through") continue;
      const centre = images.get(object.span.centre);
      const edge = images.get(object.span.edge);
      if (!centre || !edge) continue;
      const circle = createCircle({ kind: "through", centre, edge });
      images.set(object.id, circle.id);
      made.push(circle);
      continue;
    }
    if (!isLine(object) || object.span.kind !== "through") continue;
    const ends = object.span.ends.map((end) => images.get(end));
    if (ends[0] && ends[1]) made.push(lineThrough(object.form, [ends[0], ends[1]]));
  }
  return made;
}
