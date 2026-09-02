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
