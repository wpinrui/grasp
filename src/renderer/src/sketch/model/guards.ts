import { dependsOn, differentiate, type Expr } from "../expression";
import {
  cornersOf,
  filledPath,
  parentsOf,
  parentsOfArc,
  parentsOfCircle,
  parentsOfSpan,
  type SketchArc,
  type SketchCaption,
  type SketchCircle,
  type SketchInterior,
  type SketchLine,
  type SketchLocus,
  type SketchPoint,
} from "./figures";
import type { Position } from "./geometry";
import type {
  SketchButton,
  SketchCalculation,
  SketchFunction,
  SketchMark,
  SketchMeasurement,
  SketchObject,
  SketchParameter,
  SketchTable,
  SketchTransform,
} from "./values";
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
 * whatever it reads stays put. A reading tied to its figure is the one
 * exception: its place is worked out from the figure every time the page
 * settles, so it is carried by the figure instead.
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
