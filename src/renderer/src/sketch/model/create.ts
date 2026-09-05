import type { Expr } from "../expression";
import type {
  ArcSpan,
  CaptionAlign,
  CircleSpan,
  Derivation,
  LineForm,
  LineSpan,
  PointSize,
  SketchArc,
  SketchCaption,
  SketchCircle,
  SketchInterior,
  SketchLine,
  SketchLocus,
  SketchPoint,
} from "./figures";
import type { PathGeometry, Position } from "./geometry";
import { alongPath, spotOnPath } from "./paths";
import type {
  MeasureKind,
  ParameterUnit,
  SketchCalculation,
  SketchFunction,
  SketchMeasurement,
  SketchObject,
  SketchParameter,
  SketchTable,
  SketchTransform,
} from "./values";

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

export function nextId(kind: string): string {
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

/**
 * The edges round a ring of corners, closing back to the first, so a polygon is
 * a ring however it was made: clicked out corner by corner, or built.
 */
export function edgesRound(ring: string[]): SketchObject[] {
  return ring.map((corner, index) =>
    lineThrough("segment", [corner, ring[(index + 1) % ring.length]]),
  );
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
/** What a parameter holds: a number, what it is a number of, and how far it is written. */
export interface ParameterWanted {
  value: number;
  unit: ParameterUnit;
  places: number;
}

export function createParameter(wanted: ParameterWanted, at: Position): SketchParameter {
  return { id: nextId("param"), kind: "parameter", ...wanted, x: at.x, y: at.y };
}

/** A number worked out from the sketch's other numbers. */
export function createCalculation(expression: Expr, at: Position): SketchCalculation {
  return { id: nextId("calc"), kind: "calculation", expression, x: at.x, y: at.y };
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

/** What a locus is: the point that drives it, what it slides along, and what it draws. */
export interface LocusWanted {
  driver: string;
  domain: string;
  driven: string;
  /** How far along the domain the driver is walked, as two fractions. */
  span: [number, number];
  samples: number;
}

export function createLocus(wanted: LocusWanted): SketchLocus {
  return { id: nextId("locus"), kind: "locus", ...wanted };
}

/** The common case: a line through two points. */
export function lineThrough(form: LineForm, ends: [string, string]): SketchLine {
  return createLine(form, { kind: "through", ends });
}

/** A point sitting somewhere along a path, which it can then be dragged along. */
export function pointOnPath(
  on: { path: SketchObject; where: PathGeometry },
  at: Position,
  size: PointSize,
): SketchPoint | null {
  const { path, where } = on;
  const from: Derivation = { kind: "on", path: path.id, at: alongPath(where, at) };
  return createPoint(spotOnPath(where, from.at), size, from);
}
