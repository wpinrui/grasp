/**
 * What the Measure menu reads off the figure, and how it is written.
 *
 * A measurement holds no number. It holds what it was taken from, and the value
 * is worked out here from the settled geometry every time it is drawn, so
 * dragging the figure moves the number with it.
 *
 * A reading has two halves: the name of the quantity, which is written the way
 * it is written in print rather than by the object's own label, and the value
 * in its units. Ratio is the one that stacks, so it carries a fraction instead
 * of a name.
 */

import { evaluate, plain, type Quantity, type Sheet, write } from "./expression";
import {
  type ArcGeometry,
  bodyOf,
  type CircleGeometry,
  cornersOf,
  distance,
  distanceToLine,
  distanceToPath,
  filledPath,
  isArc,
  isCalculation,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isMeasurement,
  isParameter,
  isPoint,
  type LineGeometry,
  type MeasureKind,
  type Position,
  PX_PER_CM,
  pathIn,
  readValuesWith,
  type Settled,
  type SketchArc,
  type SketchCalculation,
  type SketchFunction,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
  spotOnPath,
  wedgeOf,
} from "./model";
import { DEFAULT_PREFS, type DistanceUnit, type Units } from "./prefs";

const TURN = Math.PI * 2;

/**
 * The units and precision every reading is written in. They belong to the
 * window rather than to any measurement, so they are held here and set from
 * Preferences: threading them through every reading, and through every guide a
 * tool draws as it drags one out, would be a prop on half the app to say one
 * thing.
 */
let units: Units = DEFAULT_PREFS.units;

export function writeIn(next: Units): void {
  units = next;
}

/** How many of each unit make a centimetre, since the sheet is measured in them. */
const PER_CM: Record<DistanceUnit, number> = { cm: 1, mm: 10, in: 1 / 2.54 };

/**
 * A number said the way it is: a rounded one keeps every place it was given, and
 * an exact one keeps none it does not need.
 *
 * Dropping the zeros off 0.610 says it was rounded to two places when it was
 * rounded to three, so a number the places have actually rounded keeps them
 * all. A right angle is not rounded to anything, so it is 90 and not 90.0.
 */
function said(value: number, places: number): string {
  const fixed = value.toFixed(places);
  if (!fixed.includes(".")) return fixed;
  // Whether anything was lost in the rounding. The slack is for the arithmetic
  // the number came out of: a constructed right angle is ninety to within it.
  const lost = Math.abs(value - Number(fixed));
  if (lost > Math.max(1e-9, Math.abs(value) * 1e-9)) return fixed;
  return fixed.replace(/\.?0+$/, "");
}

/**
 * A length, an angle and an area said the way a measurement says them, for
 * anything that has to read one out before it is an object with a measurement
 * on it: an object being drawn says how long it is as it is dragged out.
 */
export function sayLength(px: number): string {
  const value = (px / PX_PER_CM) * PER_CM[units.distance];
  return `${said(value, units.distancePlaces)} ${units.distance}`;
}

export function sayAngle(degrees: number): string {
  if (units.angle === "radians") {
    return `${said((degrees * Math.PI) / 180, units.anglePlaces)} rad`;
  }
  return `${said(degrees, units.anglePlaces)}°`;
}

export function sayArea(px: number): string {
  const per = PER_CM[units.distance];
  const value = (px / (PX_PER_CM * PX_PER_CM)) * per * per;
  return `${said(value, units.distancePlaces)} ${units.distance}²`;
}

/**
 * How many places a kind of reading is written to when it says nothing of its
 * own: what Preferences asks for. The panel starts from this, so raising the
 * places on one reading raises them from wherever that sketch is set.
 */
export function placesFor(measure: MeasureKind): number {
  if (measure === "angle" || measure === "arc-angle") return units.anglePlaces;
  if (measure === "ratio" || measure === "value") return units.otherPlaces;
  return units.distancePlaces;
}

/** How close to the rim a point has to be to count as on a circle. */
function onCircle(round: CircleGeometry, spot: Position): boolean {
  return Math.abs(distance(round.at, spot) - round.radius) <= Math.max(1e-6, round.radius * 1e-6);
}

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

function find(objects: SketchObject[], id: string): SketchObject | undefined {
  return objects.find((object) => object.id === id);
}

/** The whole line a straight object lies on, since a distance runs to that. */
function wholeLine(along: LineGeometry): LineGeometry {
  return { a: along.a, b: along.b, form: "line" };
}

/** How far round an arc runs, in radians, and how long it is, in sheet pixels. */
function arcSpread(arc: ArcGeometry): { angle: number; length: number } {
  if (arc.flat) {
    return { angle: 0, length: distance(arc.flat[0], arc.flat[1]) };
  }
  const angle = Math.abs(arc.sweep);
  return { angle, length: angle * arc.radius };
}

/** The counter-clockwise turn from one angle round to another, on screen. */
function ccw(from: number, to: number): number {
  return (((from - to) % TURN) + TURN) % TURN;
}

function angleAt(centre: Position, spot: Position): number {
  return Math.atan2(spot.y - centre.y, spot.x - centre.x);
}

/**
 * The stretch of a circle two or three points name: the minor arc between two,
 * and the one running from the first through the second to the third when there
 * are three. In radians.
 */
function stretchOn(round: CircleGeometry, at: Position[]): number {
  const angles = at.map((spot) => angleAt(round.at, spot));
  const round_trip = ccw(angles[0], angles[angles.length - 1]);
  if (at.length === 2) return Math.min(round_trip, TURN - round_trip);
  return ccw(angles[0], angles[1]) <= round_trip ? round_trip : TURN - round_trip;
}

/** The angle at B, between BA and BC, from 0 to 180 degrees. */
export function cornerAngle(a: Position, b: Position, c: Position): number | null {
  const one = { x: a.x - b.x, y: a.y - b.y };
  const other = { x: c.x - b.x, y: c.y - b.y };
  const lengths = Math.hypot(one.x, one.y) * Math.hypot(other.x, other.y);
  if (lengths < 1e-9) return null;
  const cos = (one.x * other.x + one.y * other.y) / lengths;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/**
 * How near a point has to come to a straight object to be standing on it. A
 * crossing is exact to the arithmetic that built it; this is not slack enough
 * for a point that merely looks close.
 */
const ON_ARM = 1e-6;

/** The two ends of a straight object, or null when it has none to name. */
export function endsOf(object: SketchObject): [string, string] | null {
  if (!isLine(object) || object.span.kind !== "through") return null;
  return object.span.ends;
}

/** One straight object running out of a corner: which it is, and which way. */
export interface Arm {
  /** The straight object itself. Two arms share one where it runs out both ways. */
  side: string;
  /** Its far end, which is the point the arm runs to. */
  end: string;
  /** The way it runs out of the corner, in radians. */
  angle: number;
}

/** Every straight object running out of a corner, sorted by the way it runs. */
export function armsAt(corner: string, objects: SketchObject[], settled: Settled): Arm[] {
  const at = settled.points.get(corner);
  if (!at) return [];
  const arms: Arm[] = [];
  const add = (side: string, end: string) => {
    const spot = settled.points.get(end);
    if (!spot || (spot.x === at.x && spot.y === at.y)) return;
    arms.push({ side, end, angle: Math.atan2(spot.y - at.y, spot.x - at.x) });
  };
  for (const object of objects) {
    const ends = endsOf(object);
    if (!ends) continue;
    // An end of the object: it runs out of the corner one way, to its far end.
    if (ends.includes(corner)) {
      add(object.id, ends[0] === corner ? ends[1] : ends[0]);
      continue;
    }
    // Not an end but standing on it, which is what a crossing is: the object
    // runs out of the corner both ways, and each way is an arm of its own.
    // Counting only the ends would leave a crossing looking like no corner at
    // all, so nothing there could be marked or measured.
    const along = pathIn(settled, object.id);
    if (!along || !isLine(object)) continue;
    if (distanceToPath(along, at) > ON_ARM) continue;
    add(object.id, ends[0]);
    add(object.id, ends[1]);
  }
  return arms.sort((one, other) => one.angle - other.angle);
}

/**
 * Which angle a drag out of the corner asks for: the two arms the drag fell
 * between, in the order the turn runs from the first to the second, and whether
 * that turn is the long way round. Null when there is no angle there to mark.
 */
/**
 * Every angle at a corner: one for each pair of arms running out of it, with
 * the turn between them in degrees. A corner with two arms makes one angle, and
 * that is the only case where clicking it says which angle was meant.
 */
export function anglesAt(
  corner: string,
  objects: SketchObject[],
  settled: Settled,
): { arms: [string, string]; sides: [string, string]; turn: number }[] {
  const arms = armsAt(corner, objects, settled);
  const out: { arms: [string, string]; sides: [string, string]; turn: number }[] = [];
  for (let i = 0; i < arms.length; i += 1) {
    for (let j = i + 1; j < arms.length; j += 1) {
      // The two ways out of one object are the same straight line, and the
      // straight angle between them is not an angle anybody marks.
      if (arms[i].side === arms[j].side) continue;
      let turn = Math.abs(arms[i].angle - arms[j].angle);
      if (turn > Math.PI) turn = Math.PI * 2 - turn;
      out.push({
        arms: [arms[i].end, arms[j].end],
        sides: [arms[i].side, arms[j].side],
        turn: (turn * 180) / Math.PI,
      });
    }
  }
  return out;
}

export function angleWanted(
  arms: Arm[],
  bearing: number,
): { arms: [string, string]; sides: [string, string]; reflex: boolean } | null {
  if (arms.length < 2) return null;
  const turn = (from: number, to: number) => {
    const gap = (to - from) % (Math.PI * 2);
    return gap < 0 ? gap + Math.PI * 2 : gap;
  };
  // The drag lands in the wedge between one arm and the next one round.
  let found = arms.length - 1;
  for (let index = 0; index < arms.length; index += 1) {
    const next = arms[(index + 1) % arms.length];
    if (turn(arms[index].angle, bearing) < turn(arms[index].angle, next.angle)) {
      found = index;
      break;
    }
  }
  const one = arms[found];
  const other = arms[(found + 1) % arms.length];
  const sweep = turn(one.angle, other.angle);
  return {
    arms: [one.end, other.end],
    sides: [one.side, other.side],
    reflex: sweep > Math.PI,
  };
}

/**
 * The three points an angle between two straight objects runs through: the far
 * end of the first, the corner they share, and the far end of the second. Null
 * when they share no end, which is when there is no angle to measure.
 */
export function cornerOf(one: SketchObject, other: SketchObject): [string, string, string] | null {
  const first = endsOf(one);
  const second = endsOf(other);
  if (!first || !second) return null;
  const shared = first.filter((end) => second.includes(end));
  if (shared.length !== 1) return null;
  const corner = shared[0];
  const from = first.find((end) => end !== corner);
  const to = second.find((end) => end !== corner);
  return from && to ? [from, corner, to] : null;
}

/** The area a ring of corners encloses, by the shoelace sum. */
export function shoelace(corners: Position[]): number {
  let twice = 0;
  for (let index = 0; index < corners.length; index += 1) {
    const one = corners[index];
    const next = corners[(index + 1) % corners.length];
    twice += one.x * next.y - next.x * one.y;
  }
  return Math.abs(twice) / 2;
}

/**
 * What a measurement comes to, in sheet units, or null when what it reads has
 * gone or has no value to give: a circle of no size, three points that stopped
 * being collinear, an angle with no arms.
 *
 * Lengths come back in sheet pixels and areas in square ones. They are turned
 * into centimetres where the reading is written, which is the one place the
 * units belong.
 */
export function amountOf(
  measurement: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): number | null {
  const parts = measurement.of.map((id) => find(objects, id));
  if (parts.some((part) => part === undefined)) return null;
  const held = parts as SketchObject[];
  const spot = (object: SketchObject) => settled.points.get(object.id) ?? null;

  switch (measurement.measure) {
    case "length": {
      const along = settled.lines.get(held[0].id);
      return along ? distance(along.a, along.b) : null;
    }
    case "distance": {
      if (held.every(isPoint)) {
        const [a, b] = held.map(spot);
        return a && b ? distance(a, b) : null;
      }
      const point = held.find(isPoint);
      const line = held.find(isLine);
      if (!point || !line) return null;
      const at = spot(point);
      const along = settled.lines.get(line.id);
      return at && along ? distanceToLine(wholeLine(along), at) : null;
    }
    case "perimeter": {
      const fill = held[0];
      if (!isInterior(fill)) return null;
      const corners = cornersOf(fill);
      if (corners) {
        const at = settled.shapes.get(fill.id);
        if (!at) return null;
        return at.reduce(
          (sum, corner, index) => sum + distance(corner, at[(index + 1) % at.length]),
          0,
        );
      }
      const arc = settled.arcs.get(filledPath(fill) ?? "");
      if (!arc) return null;
      const { length } = arcSpread(arc);
      if (wedgeOf(fill) === "sector") return length + 2 * arc.radius;
      return length + distance(spotOnPath(arc, 0), spotOnPath(arc, 1));
    }
    case "circumference": {
      const round = circleFor(held[0], settled);
      return round ? TURN * round.radius : null;
    }
    case "angle": {
      const points = held.every(isPoint) ? held : null;
      const three = points ? points.map((point) => point.id) : cornerOf(held[0], held[1]);
      if (!three) return null;
      const at = three.map((id) => settled.points.get(id));
      if (at.some((one) => one === undefined)) return null;
      const [a, b, c] = at as Position[];
      return cornerAngle(a, b, c);
    }
    case "area": {
      const round = circleFor(held[0], settled);
      if (round) return Math.PI * round.radius * round.radius;
      const fill = held[0];
      if (!isInterior(fill)) return null;
      const corners = settled.shapes.get(fill.id);
      if (corners) return shoelace(corners);
      const arc = settled.arcs.get(filledPath(fill) ?? "");
      if (!arc) return null;
      const { angle } = arcSpread(arc);
      const sector = (angle * arc.radius * arc.radius) / 2;
      // The segment is the sector less the triangle back to the centre.
      return wedgeOf(fill) === "sector"
        ? sector
        : sector - (arc.radius * arc.radius * Math.sin(angle)) / 2;
    }
    case "arc-angle":
    case "arc-length": {
      const found = arcSpanOf(held, settled);
      if (!found) return null;
      if (measurement.measure === "arc-length") return found.length;
      return (found.angle * 180) / Math.PI;
    }
    case "radius": {
      const round = circleFor(held[0], settled);
      if (round) return round.radius;
      const arc = arcFor(held[0], settled);
      return arc ? arc.radius : null;
    }
    case "ratio": {
      if (held.every(isPoint)) {
        const at = held.map(spot);
        if (at.some((one) => one === null)) return null;
        const [a, b, c] = at as Position[];
        const along = { x: b.x - a.x, y: b.y - a.y };
        const reach = along.x * along.x + along.y * along.y;
        if (reach < 1e-9) return null;
        return ((c.x - a.x) * along.x + (c.y - a.y) * along.y) / reach;
      }
      const [one, other] = held.map((object) => settled.lines.get(object.id));
      if (!one || !other) return null;
      const under = distance(other.a, other.b);
      return under < 1e-9 ? null : distance(one.a, one.b) / under;
    }
    default: {
      const point = held[0];
      if (!isPoint(point) || point.from?.kind !== "on") return null;
      return point.from.at;
    }
  }
}

/** The circle an object is or fills, or null when it is neither. */
function circleFor(object: SketchObject, settled: Settled): CircleGeometry | null {
  if (isCircle(object)) return settled.circles.get(object.id) ?? null;
  if (!isInterior(object) || cornersOf(object) || wedgeOf(object)) return null;
  return settled.circles.get(filledPath(object) ?? "") ?? null;
}

/** The arc an object is or fills, or null when it is neither. */
function arcFor(object: SketchObject, settled: Settled): ArcGeometry | null {
  if (isArc(object)) return settled.arcs.get(object.id) ?? null;
  if (!isInterior(object) || !wedgeOf(object)) return null;
  return settled.arcs.get(filledPath(object) ?? "") ?? null;
}

/**
 * How far round an arc angle runs and how long that stretch is: off a selected
 * arc, or off a circle and the two or three points naming a stretch of it. An
 * arc flattened into a straight run turns through nothing but still has a
 * length, which is why the two are carried together.
 */
function arcSpanOf(
  held: SketchObject[],
  settled: Settled,
): { angle: number; length: number } | null {
  const arc = held.length === 1 ? settled.arcs.get(held[0].id) : undefined;
  if (arc) return arcSpread(arc);
  const round = held.find(isCircle);
  const points = held.filter(isPoint);
  if (!round || points.length !== held.length - 1) return null;
  const where = settled.circles.get(round.id);
  if (!where) return null;
  const at = points.map((point) => settled.points.get(point.id));
  if (at.some((one) => one === undefined)) return null;
  const spots = at as Position[];
  if (!spots.every((one) => onCircle(where, one))) return null;
  const angle = stretchOn(where, spots);
  return { angle, length: angle * where.radius };
}

/** What an object is called in print: by the points it was built from. */
function nameOf(id: string, objects: SketchObject[], names: Map<string, string>): Naming[] {
  const object = find(objects, id);
  const plain = [{ text: names.get(id) ?? "" }];
  if (!object) return plain;
  const of = (ids: string[]) => ids.map((one) => names.get(one) ?? "?").join("");
  if (isLine(object)) {
    const ends = endsOf(object);
    if (!ends) return plain;
    const over = object.form === "segment" ? "bar" : object.form === "ray" ? "ray" : "line";
    return [{ text: of(ends), over }];
  }
  if (isCircle(object)) {
    if (object.span.kind !== "through") return plain;
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
  return plain;
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
 * How a measurement reads: the name of the quantity and its value. Asking for
 * the label instead writes the measurement's own name in front of the value,
 * which is what Show Labels swaps in.
 */
/**
 * What a measurement comes to, in the units readings are written in and with
 * what it is a quantity of carried alongside. This is the number, so it is what
 * the sheet writes and what a calculation reading the measurement works on.
 */
export function quantityOf(
  measurement: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): Quantity | null {
  const amount = amountOf(measurement, objects, settled);
  if (amount === null) return null;
  const measure = measurement.measure;
  if (measure === "area") {
    const scale = PER_CM[units.distance];
    return { value: (amount / (PX_PER_CM * PX_PER_CM)) * scale * scale, length: 2, angle: 0 };
  }
  if (measure === "angle" || measure === "arc-angle") {
    // The angle between two arms is the small one. Read the long way round, it
    // is the rest of the turn.
    const degrees = measure === "angle" && measurement.reflex ? 360 - amount : amount;
    return {
      value: units.angle === "radians" ? (degrees * Math.PI) / 180 : degrees,
      length: 0,
      angle: 1,
    };
  }
  if (measure === "ratio" || measure === "value") return plain(amount);
  return { value: (amount / PX_PER_CM) * PER_CM[units.distance], length: 1, angle: 0 };
}

/** What a parameter is a quantity of, which is simply what it was given. */
export function quantityOfParameter(parameter: SketchParameter): Quantity {
  if (parameter.unit === "angle") return { value: parameter.value, length: 0, angle: 1 };
  if (parameter.unit === "distance") return { value: parameter.value, length: 1, angle: 0 };
  return plain(parameter.value);
}

/**
 * A quantity in the sheet's own terms: centimetres and degrees, whatever the
 * sketch is currently written in. A table keeps its rows this way, so a sketch
 * switched from centimetres to millimetres reads its old rows in millimetres
 * rather than leaving them saying the old numbers.
 */
export function inSheetTerms(quantity: Quantity): Quantity {
  const perLength = PER_CM[units.distance] ** quantity.length;
  const perAngle = (units.angle === "radians" ? 180 / Math.PI : 1) ** quantity.angle;
  return { ...quantity, value: (quantity.value / perLength) * perAngle };
}

/** And back again, for writing one out. */
export function fromSheetTerms(quantity: Quantity): Quantity {
  const perLength = PER_CM[units.distance] ** quantity.length;
  const perAngle = (units.angle === "radians" ? Math.PI / 180 : 1) ** quantity.angle;
  return { ...quantity, value: quantity.value * perLength * perAngle };
}

/** An exponent written the way it is written in print. */
const RAISED = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function raised(power: number): string {
  const digits = Math.abs(power)
    .toString()
    .split("")
    .map((digit) => RAISED[Number(digit)] ?? digit)
    .join("");
  return power < 0 ? `⁻${digits}` : digits;
}

/**
 * A worked-out number as it is written: to the places its kind is written to,
 * with the unit that what it is a quantity of calls for. A length comes out in
 * the distance unit, an area in that unit squared, an angle in the angle unit,
 * and a plain number with nothing after it. Anything stranger says its unit
 * with the exponent it carries rather than pretending to be one of those.
 */
export function sayQuantity(quantity: Quantity | null, places?: number): string {
  if (!quantity) return "—";
  const { value, length, angle } = quantity;
  const to = (asked: number) => places ?? asked;
  if (length === 0 && angle === 0) return said(value, to(units.otherPlaces));
  if (length === 0 && angle === 1) {
    return `${said(value, to(units.anglePlaces))}${units.angle === "radians" ? " rad" : "°"}`;
  }
  if (angle === 0 && (length === 1 || length === 2)) {
    return `${said(value, to(units.distancePlaces))} ${units.distance}${length === 2 ? "²" : ""}`;
  }
  const parts = [
    length === 0 ? "" : `${units.distance}${length === 1 ? "" : raised(length)}`,
    angle === 0
      ? ""
      : `${units.angle === "radians" ? "rad" : "deg"}${angle === 1 ? "" : raised(angle)}`,
  ].filter(Boolean);
  return `${said(value, to(units.otherPlaces))} ${parts.join(" ")}`;
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
  names: Map<string, string>,
  objects: SketchObject[] = [],
): Reading {
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
 * How the geometry reads a number as it settles, handed to `model.ts` because a
 * transform can follow one and the page has to work them out together. Sheet
 * terms, centimetres and degrees, so the geometry needs to know nothing about
 * what units are being written.
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

export function readingOf(
  measurement: SketchMeasurement,
  objects: SketchObject[],
  names: Map<string, string>,
  settled: Settled,
): Reading {
  const measure = measurement.measure;
  const value = sayQuantity(quantityOf(measurement, objects, settled), measurement.places);
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
      const twist = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const reach = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
      // Three points that are not in a line have no ratio to read.
      if (reach < 1e-9 || Math.abs(twist) > reach * 1e-6) return [];
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
