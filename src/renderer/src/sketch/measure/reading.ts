import { evaluate, type Quantity, type Sheet, write } from "../expression";
import {
  bodyOf,
  cornersOf,
  filledPath,
  inLine,
  isArc,
  isCalculation,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isMeasurement,
  isParameter,
  isPoint,
  type MeasureKind,
  type Position,
  readValuesWith,
  type Settled,
  type SketchArc,
  type SketchCalculation,
  type SketchFunction,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
  wedgeOf,
} from "../model";
import {
  fromSheetTerms,
  inSheetTerms,
  quantityOf,
  quantityOfParameter,
  sayQuantity,
} from "./quantity";
import { cornerOf, endsOf, find, onCircle } from "./shape";
import { said, units } from "./units";
/** A run of the reading, with the mark that says what kind of thing it names. */
export interface Naming {
  text: string;
  over?: "bar" | "arc" | "ray" | "line";
}

/** A measurement as it reads on the sheet. */
export interface Reading {
  /** What is written before the value. Empty when the reading is a fraction. */
  lead: Naming[];
  /** Ratio stacks its two names instead of writing one. */
  fraction?: { top: Naming[]; bottom: Naming[] };
  /** The number and its units, already rounded. */
  value: string;
}

/**
 * A parameter or a calculation as it reads on the sheet. A parameter says its
 * own name and the number it holds. A calculation says the sum it is, so the
 * sheet shows the working rather than a number from nowhere, unless its own
 * name is showing, which is the same rule a measurement follows.
 */
export function readingOfValue(
  object: SketchParameter | SketchCalculation | SketchFunction,
  quantity: Quantity | null,
  page: { names: Map<string, string>; objects?: SketchObject[] },
): Reading {
  const { names, objects = [] } = page;
  const name = names.get(object.id) ?? "";
  // A function says what it is rather than what it comes to, since it comes to
  // nothing until something is put into it.
  if (isFunction(object)) {
    const body = bodyOf(objects, object.id);
    return {
      lead: [{ text: `${name}(x)` }],
      value: body ? write(body, names) : "—",
    };
  }
  if (isParameter(object)) {
    const unit =
      object.unit === "angle"
        ? units.angle === "radians"
          ? " rad"
          : "°"
        : object.unit === "distance"
          ? ` ${units.distance}`
          : "";
    // Written to the places it was typed to, which is also how far + and - move it.
    return { lead: [{ text: name }], value: `${said(object.value, object.places)}${unit}` };
  }
  return {
    lead: [{ text: object.label?.shown ? name : write(object.expression, names) }],
    value: sayQuantity(quantity),
  };
}

/**
 * The sketch as an expression reads it, which is what the Calculator works its
 * preview out against and what a calculation on the sheet is evaluated with.
 * The numbers are already settled, in the sheet's own terms, so this only says
 * them back in the units readings are written in.
 */
export function sheetOf(objects: SketchObject[], settled: Settled): Sheet {
  return {
    value: (id) => {
      const held = settled.values.get(id);
      return held ? fromSheetTerms(held) : null;
    },
    body: (id) => bodyOf(objects, id),
    angle: units.angle,
    distance: units.distance,
  };
}

/**
 * What every number on the sheet comes to now, keyed by id and said in the units
 * readings are written in. The working out happened as the page settled, since a
 * transform can follow a number and so the geometry needs them too.
 */
export function quantitiesOf(settled: Settled): Map<string, Quantity | null> {
  const held = new Map<string, Quantity | null>();
  for (const [id, value] of settled.values) held.set(id, value ? fromSheetTerms(value) : null);
  return held;
}

/**
 * How the geometry reads a number as it settles, handed to `model/settle.ts`
 * because a transform can follow one and the page has to work them out
 * together. Sheet terms, centimetres and degrees, so the geometry needs to
 * know nothing about what units are being written.
 */
readValuesWith((object, objects, settled) => {
  const worked = isMeasurement(object)
    ? quantityOf(object, objects, settled)
    : isParameter(object)
      ? quantityOfParameter(object)
      : isCalculation(object)
        ? evaluate(object.expression, sheetOf(objects, settled))
        : null;
  return worked ? inSheetTerms(worked) : null;
});

/** The page a reading takes its names off: what is on it, and what it is called. */
export interface NamingOn {
  objects: SketchObject[];
  names: Map<string, string>;
}

/** The page a reading is read off: its names, and where everything settled. */
export interface ReadingOn extends NamingOn {
  settled: Settled;
}

/** What an object is called in print: by the points it was built from. */
function nameOf(id: string, objects: SketchObject[], names: Map<string, string>): Naming[] {
  const object = find(objects, id);
  // Asked for only where it is used, since most kinds are named by the points
  // they were built from rather than by their own name.
  const plain = () => [{ text: names.get(id) ?? "" }];
  if (!object) return plain();
  const of = (ids: string[]) => ids.map((one) => names.get(one) ?? "?").join("");
  if (isLine(object)) {
    const ends = endsOf(object);
    if (!ends) return plain();
    const over = object.form === "segment" ? "bar" : object.form === "ray" ? "ray" : "line";
    return [{ text: of(ends), over }];
  }
  if (isCircle(object)) {
    if (object.span.kind !== "through") return plain();
    return [{ text: `⊙${of([object.span.centre, object.span.edge])}` }];
  }
  if (isArc(object)) return arcNaming(object, objects, names);
  if (isInterior(object)) {
    const corners = cornersOf(object);
    if (corners) {
      return [{ text: `${corners.length === 3 ? "△" : ""}${of(corners)}` }];
    }
    return nameOf(filledPath(object) ?? "", objects, names);
  }
  return plain();
}

/** An arc's printed name: the letters it runs through under an arc. */
function arcNaming(arc: SketchArc, objects: SketchObject[], names: Map<string, string>): Naming[] {
  const of = (ids: string[]) => ids.map((one) => names.get(one) ?? "?").join("");
  if (arc.span.kind === "through") {
    return [{ text: of([arc.span.from, arc.span.via, arc.span.to]), over: "arc" }];
  }
  const ends: Naming = { text: of([arc.span.from, arc.span.to]), over: "arc" };
  if (arc.span.kind === "centre") return [ends];
  return [ends, { text: " on " }, ...nameOf(arc.span.circle, objects, names)];
}

/** The stretch of a circle two or three points name, written the same way. */
function stretchNaming(
  held: SketchObject[],
  objects: SketchObject[],
  names: Map<string, string>,
): Naming[] {
  if (held.length === 1) return nameOf(held[0].id, objects, names);
  const round = held.find(isCircle);
  const points = held.filter(isPoint);
  if (!round) return [];
  const letters = points.map((point) => names.get(point.id) ?? "?").join("");
  return [{ text: letters, over: "arc" }, { text: " on " }, ...nameOf(round.id, objects, names)];
}

/**
 * How a measurement reads once its value is worked out: the name of the
 * quantity written the way it is written in print, and that value after it.
 *
 * The naming takes no geometry, which is what lets the sheet ask what a
 * measurement spells out without settling the page first. Every `names.get`
 * from here down reaches the printed reading, and `spelledOutBy` takes that as
 * its definition: one that did not would still be counted as spelled out, and
 * would be named for nothing.
 */
function readingWith(measurement: SketchMeasurement, page: NamingOn, value: string): Reading {
  const { objects, names } = page;
  const measure = measurement.measure;
  // Its label showing, a measurement says its own name in front of the value
  // rather than the printed form of what it measures.
  if (measurement.label?.shown) {
    return { lead: [{ text: names.get(measurement.id) ?? "" }], value };
  }
  const held = measurement.of.map((id) => find(objects, id)).filter(Boolean) as SketchObject[];
  const named = (id: string) => nameOf(id, objects, names);
  const plain = (id: string) => names.get(id) ?? "?";

  switch (measure) {
    case "length":
      return { lead: [{ text: "m " }, ...named(measurement.of[0])], value };
    case "distance": {
      if (held.every(isPoint)) {
        return { lead: [{ text: measurement.of.map(plain).join("") }], value };
      }
      const point = held.find(isPoint);
      const line = held.find(isLine);
      if (!point || !line) return { lead: [], value };
      return {
        lead: [{ text: `Distance ${plain(point.id)} to ` }, ...named(line.id)],
        value,
      };
    }
    case "perimeter":
      return { lead: [{ text: "Perimeter " }, ...named(measurement.of[0])], value };
    case "circumference":
      return { lead: [{ text: "Circumference " }, ...named(measurement.of[0])], value };
    case "angle": {
      const three = held.every(isPoint)
        ? measurement.of
        : (cornerOf(held[0], held[1]) ?? measurement.of);
      return { lead: [{ text: `m∠${three.map(plain).join("")}` }], value };
    }
    case "area":
      return { lead: [{ text: "Area " }, ...named(measurement.of[0])], value };
    case "arc-angle":
      return { lead: [{ text: "m " }, ...stretchNaming(held, objects, names)], value };
    case "arc-length":
      return { lead: [{ text: "Length " }, ...stretchNaming(held, objects, names)], value };
    case "radius":
      return { lead: [{ text: "Radius " }, ...named(measurement.of[0])], value };
    case "ratio": {
      if (held.every(isPoint)) {
        const [a, b, c] = measurement.of.map(plain);
        return {
          lead: [],
          fraction: { top: [{ text: `${a}${c}` }], bottom: [{ text: `${a}${b}` }] },
          value,
        };
      }
      return {
        lead: [],
        fraction: {
          top: [{ text: "m " }, ...named(measurement.of[0])],
          bottom: [{ text: "m " }, ...named(measurement.of[1])],
        },
        value,
      };
    }
    default: {
      const point = held[0];
      const path = isPoint(point) && point.from?.kind === "on" ? point.from.path : null;
      return {
        lead: [{ text: `${plain(measurement.of[0])} on ` }, ...(path ? named(path) : [])],
        value,
      };
    }
  }
}

/**
 * How a measurement reads: the name of the quantity and its value. Asking for
 * the label instead writes the measurement's own name in front of the value,
 * which is what Show Labels swaps in.
 */
export function readingOf(measurement: SketchMeasurement, page: ReadingOn): Reading {
  const value = sayQuantity(
    quantityOf(measurement, page.objects, page.settled),
    measurement.places,
  );
  return readingWith(measurement, page, value);
}

/**
 * A page's names, keeping every one that is asked for. A reading spells out the
 * names of what it measures, down through the points each of those was built
 * from, and this is how the sheet finds out which those are without a second
 * walk over the same ground to fall out of step with this one.
 */
class NamesAsked extends Map<string, string> {
  readonly asked = new Set<string>();
  override get(id: string): string | undefined {
    this.asked.add(id);
    return super.get(id);
  }
}

/**
 * Everything a measurement's reading writes the name of, its own name aside.
 * Taking a measurement names these, since a reading with nothing to print
 * would come out saying "?? = 5 cm". It names them and leaves their labels
 * alone: what the figure shows is not the measurement's to change.
 */
export function spelledOutBy(measurement: SketchMeasurement, page: NamingOn): string[] {
  const names = new NamesAsked(page.names);
  readingWith(measurement, { ...page, names }, "");
  return [...names.asked].filter((id) => id !== measurement.id);
}

/** A measurement as one line of plain text, for the rows that list it. */
export function readingText(reading: Reading): string {
  if (reading.fraction) {
    const say = (parts: Naming[]) => parts.map((part) => part.text).join("");
    return `${say(reading.fraction.top)} / ${say(reading.fraction.bottom)} = ${reading.value}`;
  }
  return `${reading.lead.map((part) => part.text).join("")} = ${reading.value}`;
}

/**
 * What a Measure entry would read off the selection: one list of objects per
 * measurement it would write, in the order they were picked. Empty when the
 * selection is not one the entry takes, which is what greys it out.
 */
export function wouldMeasure(
  measure: MeasureKind,
  selected: SketchObject[],
  settled: Settled,
): string[][] {
  const ids = (objects: SketchObject[]) => objects.map((object) => object.id);
  const points = selected.filter(isPoint);
  const lines = selected.filter(isLine);
  const all = (test: (object: SketchObject) => boolean) =>
    selected.length > 0 && selected.every(test);

  switch (measure) {
    case "length":
      // Only a segment has a length. A ray and a line have no end.
      return all((object) => isLine(object) && object.form === "segment")
        ? selected.map((object) => [object.id])
        : [];
    case "distance": {
      if (selected.length === 2 && points.length === 2) return [ids(points)];
      if (lines.length + points.length !== selected.length) return [];
      if (points.length === 0 || lines.length === 0) return [];
      // One straight object and any number of points, or the other way about.
      if (lines.length === 1) return points.map((point) => [point.id, lines[0].id]);
      if (points.length === 1) return lines.map((line) => [points[0].id, line.id]);
      return [];
    }
    case "perimeter":
      // A circle's inside has a circumference rather than a perimeter.
      return all(
        (object) => isInterior(object) && (cornersOf(object) !== null || wedgeOf(object) !== null),
      )
        ? selected.map((object) => [object.id])
        : [];
    case "circumference":
      return all((object) => circleKind(object)) ? selected.map((object) => [object.id]) : [];
    case "angle": {
      if (selected.length === 3 && points.length === 3) return [ids(points)];
      // Two straight objects sharing an end, with or without that point.
      if (lines.length !== 2) return [];
      const corner = cornerOf(lines[0], lines[1]);
      if (!corner) return [];
      if (selected.length === 2) return [ids(lines)];
      if (selected.length === 3 && points.length === 1 && points[0].id === corner[1]) {
        return [ids(lines)];
      }
      return [];
    }
    case "area":
      return all((object) => circleKind(object) || isInterior(object))
        ? selected.map((object) => [object.id])
        : [];
    case "arc-angle":
    case "arc-length": {
      if (all(isArc)) return selected.map((object) => [object.id]);
      const round = selected.filter(isCircle);
      if (round.length !== 1 || points.length !== selected.length - 1) return [];
      if (points.length !== 2 && points.length !== 3) return [];
      const where = settled.circles.get(round[0].id);
      if (!where) return [];
      const at = points.map((point) => settled.points.get(point.id));
      if (at.some((one) => one === undefined)) return [];
      // They have to be on the circle, not merely near it.
      if (!(at as Position[]).every((one) => onCircle(where, one))) return [];
      return [[round[0].id, ...ids(points)]];
    }
    case "radius":
      return all((object) => circleKind(object) || isArc(object) || arcFill(object))
        ? selected.map((object) => [object.id])
        : [];
    case "ratio": {
      if (selected.length === 2 && lines.length === 2) {
        return lines.every((line) => line.form === "segment") ? [ids(lines)] : [];
      }
      if (selected.length !== 3 || points.length !== 3) return [];
      const at = points.map((point) => settled.points.get(point.id));
      if (at.some((one) => one === undefined)) return [];
      const [a, b, c] = at as Position[];
      // Three points that are not in a line have no ratio to read.
      if (!inLine(a, b, c)) return [];
      return [ids(points)];
    }
    default:
      return all((object) => isPoint(object) && object.from?.kind === "on")
        ? selected.map((object) => [object.id])
        : [];
  }
}

/** A circle, or the fill that is a circle's inside. */
function circleKind(object: SketchObject): boolean {
  if (isCircle(object)) return true;
  return isInterior(object) && cornersOf(object) === null && wedgeOf(object) === null;
}

/** A fill that is an arc's inside, either way it was filled. */
function arcFill(object: SketchObject): boolean {
  return isInterior(object) && wedgeOf(object) !== null;
}
