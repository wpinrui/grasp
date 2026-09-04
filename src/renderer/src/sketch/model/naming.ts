import { cornersOf, wedgeOf } from "./figures";
import {
  isArc,
  isButton,
  isCalculation,
  isCaption,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isMark,
  isMeasurement,
  isParameter,
  isPoint,
  isTable,
  isTransform,
} from "./guards";
import type { SketchObject } from "./values";

/**
 * The run of names each kind of object takes its turn in, after the reference
 * app: points through the capitals, straight objects through the letters from
 * j, and everything else a letter and a number. A run of letters wraps: the
 * name after Z is A again, so a figure with twenty-seven labelled points has
 * two called A rather than one called A1. Two objects sharing a name is allowed
 * and nothing is keyed by one, so nothing is damaged by it.
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

/**
 * The runs whose names are only ever read off a label. Nothing in one of these
 * carries a name until a label is asked for, so the points nobody labels never
 * eat the letters of the ones that are: label three points out of a dozen and
 * they come out A, B and C. Everything else writes its own name as part of
 * itself, so it is named the moment it is made.
 */
const ON_A_LABEL = new Set(["point", "line", "circle", "arc", "polygon", "disc", "wedge", "locus"]);

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

/** Whether an object can carry a name at all, whether or not it has one yet. */
export function nameable(object: SketchObject, objects: SketchObject[]): boolean {
  return runFor(object, objects) !== null;
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
 * The first name from a point in a run that nothing answers to yet, and how far
 * along the run that name sits. A name somebody typed is stepped over, so the
 * run does not say it twice. The run wraps, though, so every name in it can be
 * spoken for already: this looks once round it for a free one and then takes
 * whatever comes next.
 */
function freeInRun(run: string, taken: Set<string>, from: number): { name: string; nth: number } {
  let nth = from;
  let name = nameInRun(run, nth);
  for (let tried = 0; taken.has(name) && tried < lapOf(run); tried += 1) {
    nth += 1;
    name = nameInRun(run, nth);
  }
  return { name, nth };
}

/**
 * f' after f, and f'' after that. A derivative is made after the function it
 * differentiates, so one pass forward names a whole chain of them.
 */
function nameDerivatives(
  objects: SketchObject[],
  names: Map<string, string>,
  taken: Set<string>,
): void {
  for (const object of objects) {
    if (!isFunction(object) || object.of === undefined || object.label?.name) continue;
    const from = names.get(object.of);
    if (!from) continue;
    let wanted = `${from}'`;
    while (taken.has(wanted)) wanted += "'";
    names.set(object.id, wanted);
    taken.add(wanted);
  }
}

/**
 * What everything is called, with `all` saying whether the runs reach the kinds
 * that are named only by being labelled.
 */
function lettering(objects: SketchObject[], all: boolean): Map<string, string> {
  const names = new Map<string, string>();
  const taken = new Set<string>();
  for (const object of objects) {
    const given = object.label?.name;
    if (given) {
      names.set(object.id, given);
      taken.add(given);
    }
  }
  const reached: Record<string, number> = {};
  for (const object of objects) {
    if (names.has(object.id)) continue;
    const run = runFor(object, objects);
    if (!run || (!all && ON_A_LABEL.has(run))) continue;
    const { name, nth } = freeInRun(run, taken, reached[run] ?? 0);
    reached[run] = nth + 1;
    names.set(object.id, name);
    taken.add(name);
  }
  nameDerivatives(objects, names, taken);
  return names;
}

/**
 * What every object is called. A label carries the name it was given and keeps
 * it, so a figure's letters never move because the label beside them was hidden
 * or because something else was drawn. Everything that writes its own name
 * instead of hanging a label takes its turn in the run for its kind, in the
 * order it was built.
 */
export function namesFor(objects: SketchObject[]): Map<string, string> {
  return lettering(objects, false);
}

/**
 * What the run would call each of these, for a label about to be shown on
 * something that has never carried a name. Each takes the first name of its run
 * that nothing on the page answers to, handed out in the order they were built.
 */
export function namesToGive(objects: SketchObject[], ids: string[]): Map<string, string> {
  const already = namesFor(objects);
  const taken = new Set(already.values());
  const wanted = new Set(ids);
  const given = new Map<string, string>();
  for (const object of objects) {
    if (!wanted.has(object.id) || already.has(object.id)) continue;
    const run = runFor(object, objects);
    if (!run) continue;
    const { name } = freeInRun(run, taken, 0);
    given.set(object.id, name);
    taken.add(name);
  }
  return given;
}

/**
 * How a sketch written before a label kept its name was lettered: everything
 * took its turn in the run for its kind, labelled or not. Read once, as such a
 * file is opened, so that writing those letters down letters the figure exactly
 * as the version that saved it did.
 */
export function namesAsBuilt(objects: SketchObject[]): Map<string, string> {
  return lettering(objects, true);
}
