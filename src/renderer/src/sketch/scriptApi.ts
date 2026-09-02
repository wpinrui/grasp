/**
 * The API a script is run with, and the evaluation of it.
 *
 * None of this touches the app. Every call builds a plain object into a list
 * held here and hands back its id, so the page a script is working on is
 * untouched until the script returns and the host lands what came back. A call
 * that fails throws, the list is dropped, and there is nothing to put back.
 *
 * This runs inside a worker, which is what keeps a script away from the app:
 * see `script.ts`. It is written to need nothing but its arguments so that it
 * can.
 */

import {
  createAngleMark,
  createArc,
  createCaption,
  createCircle,
  createFill,
  createInterior,
  createLine,
  createMeasurement,
  createPoint,
  createTick,
  createWedge,
  DEFAULT_POINT_SIZE,
  isLine,
  isPoint,
  type LineForm,
  type LinePattern,
  type LineWidth,
  type MeasureKind,
  namesFor,
  type PointSize,
  resolve,
  type SketchObject,
  withDependents,
} from "./model";

/** How big the sheet is on screen, which is what a script sizes itself against. */
export interface ScriptSheet {
  /** The view's size in sheet units. */
  width: number;
  height: number;
  pixelRatio: number;
}

/** What a run comes to: the page's objects after it, or what went wrong. */
export type ScriptResult = { ok: true; objects: SketchObject[] } | { ok: false; errors: string[] };

/** The strokes a mark carries unless the script says otherwise. */
const STROKES = 1;

/** How far an angle mark's arcs stand from the corner, in sheet units. */
const MARK_RADIUS = 28;

/** How wide a caption's box is dragged out when the script does not say. */
const CAPTION_WIDTH = 160;

/** What a caption written by a script is set in. */
const CAPTION_LOOK = { font: "Times New Roman", size: 14, colour: "--color-ink-black" };

/**
 * Names shadowed with nothing before a script runs. A worker has no DOM and no
 * bridge to the app, so what is left worth taking away is the network: a script
 * that wanted to could otherwise post the figure somewhere. This makes the
 * obvious calls absent. It does not seal the realm, and cannot: `new Function`
 * runs in the worker's own realm and a constructor chain still reaches out of
 * it. The worker is the boundary; this is tidiness on top of it.
 */
const SHADOWED = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "navigator",
  "postMessage",
  "self",
  "globalThis",
  "Function",
];

/** Every name a script may call that this API does not provide itself. */
const ALLOWED_GLOBALS = new Set([
  "Array",
  "Boolean",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Set",
  "String",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
]);

/** The source with its comments and its string literals blanked out. */
function bareSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, '""')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/** Every name the script binds itself: its variables, its functions, its parameters. */
function boundNames(bare: string): Set<string> {
  const bound = new Set<string>();
  const add = (name: string | undefined) => {
    if (name) bound.add(name);
  };
  for (const [, name] of bare.matchAll(
    /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    add(name);
  }
  // Destructured bindings and parameter lists, taken as a whole and split up.
  for (const [, inside] of bare.matchAll(/\b(?:const|let|var)\s*[[{]([^\]}]*)[\]}]/g)) {
    for (const part of inside.split(",")) add(part.trim().split(/[:=\s]/)[0]);
  }
  for (const [, inside] of bare.matchAll(/(?:function\s*[\w$]*\s*|\)\s*=>|)\(([^()]*)\)\s*=>/g)) {
    for (const part of inside.split(",")) add(part.trim().split(/[:=\s]/)[0]);
  }
  for (const [, name] of bare.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) add(name);
  return bound;
}

/**
 * Every call the script makes that nothing provides. A language model will
 * invent calls, so they are all found at once and reported together rather than
 * one run at a time.
 */
export function unknownCalls(source: string, provided: Iterable<string>): string[] {
  const bare = bareSource(source);
  const known = new Set([...provided, ...ALLOWED_GLOBALS, ...SHADOWED, ...boundNames(bare)]);
  const missing = new Set<string>();
  for (const [, name] of bare.matchAll(/(?:^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!known.has(name)) missing.add(name);
  }
  return [...missing].sort();
}

/** What a script asks for that the sketch has no answer to. */
class ScriptError extends Error {}

/**
 * The straight object running from a corner out to one of its arms. An angle
 * mark is drawn between the two sides at the corner, so it wants them named.
 */
function sideJoining(held: SketchObject[], corner: string, arm: string): string {
  const found = held.find((object) => {
    if (!isLine(object) || object.span.kind !== "through") return false;
    const [one, other] = object.span.ends;
    return (one === corner && other === arm) || (one === arm && other === corner);
  });
  if (!found) {
    throw new ScriptError(`There is no straight object from ${corner} to ${arm} to mark between.`);
  }
  return found.id;
}

/**
 * The API, bound to the list of objects a run is building. Every call that
 * makes something appends it and hands back its id; every call that reads or
 * changes something works on what is in the list, which for an edit is the page
 * as it stands.
 */
function apiFor(held: SketchObject[], sheet: ScriptSheet, size: PointSize) {
  const put = <T extends SketchObject>(object: T): string => {
    held.push(object);
    return object.id;
  };

  const find = (id: string): SketchObject => {
    const found = held.find((object) => object.id === id);
    if (!found) throw new ScriptError(`There is nothing here called ${JSON.stringify(id)}.`);
    return found;
  };

  const point = (id: string): string => {
    const found = find(id);
    if (!isPoint(found)) throw new ScriptError(`${id} is a ${found.kind}, not a point.`);
    return id;
  };

  /** Change what an object carries, leaving the rest of it alone. */
  const change = (id: string, part: Partial<SketchObject>) => {
    const at = held.findIndex((object) => object.id === id);
    if (at === -1) throw new ScriptError(`There is nothing here called ${JSON.stringify(id)}.`);
    held[at] = { ...held[at], ...part } as SketchObject;
  };

  const straight = (form: LineForm) => (a: string, b: string) =>
    put(createLine(form, { kind: "through", ends: [point(a), point(b)] }));

  return {
    /** How big the sheet is on screen, so a script sizes itself rather than guessing. */
    sheet,

    // Points.
    point: (x: number, y: number) => put(createPoint({ x, y }, size)),
    midpoint: (a: string, b: string) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "midpoint", of: point(a), and: point(b) })),
    /** Where two paths cross. `pick` chooses between two crossings, 0 or 1. */
    intersect: (one: string, other: string, pick = 0) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "cross", of: one, and: other, pick })),
    /** A point riding a path, `at` being the fraction of the way along it. */
    pointOn: (path: string, at: number) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "on", path, at })),

    // Points made by moving other points.
    translate: (of: string, dx: number, dy: number) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "translate", of: point(of), dx, dy })),
    rotate: (of: string, centre: string, degrees: number) =>
      put(
        createPoint({ x: 0, y: 0 }, size, {
          kind: "rotate",
          of: point(of),
          centre: point(centre),
          degrees,
        }),
      ),
    dilate: (of: string, centre: string, ratio: number) =>
      put(
        createPoint({ x: 0, y: 0 }, size, {
          kind: "dilate",
          of: point(of),
          centre: point(centre),
          ratio,
        }),
      ),
    reflect: (of: string, mirror: string) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "reflect", of: point(of), mirror })),

    // Straight objects.
    segment: straight("segment"),
    ray: straight("ray"),
    line: straight("line"),
    parallel: (at: string, to: string) =>
      put(createLine("line", { kind: "parallel", at: point(at), to })),
    perpendicular: (at: string, to: string) =>
      put(createLine("line", { kind: "perpendicular", at: point(at), to })),
    bisector: (corner: string, a: string, b: string) =>
      put(
        createLine("line", { kind: "bisector", corner: point(corner), a: point(a), b: point(b) }),
      ),

    // Circles and arcs.
    circle: (centre: string, edge: string) =>
      put(createCircle({ kind: "through", centre: point(centre), edge: point(edge) })),
    /** A circle whose radius is the length of a segment already drawn. */
    circleRadius: (centre: string, along: string) =>
      put(createCircle({ kind: "radius", centre: point(centre), along })),
    arcOn: (circle: string, from: string, to: string) =>
      put(createArc({ kind: "on", circle, from: point(from), to: point(to) })),
    arcAt: (centre: string, from: string, to: string) =>
      put(createArc({ kind: "centre", centre: point(centre), from: point(from), to: point(to) })),
    arcThrough: (from: string, via: string, to: string) =>
      put(createArc({ kind: "through", from: point(from), via: point(via), to: point(to) })),

    // Fills.
    polygon: (...corners: string[]) => {
      if (corners.length < 3) throw new ScriptError("A polygon wants three corners or more.");
      return put(createInterior(corners.map(point)));
    },
    fill: (circle: string) => put(createFill(circle)),
    sector: (arc: string) => put(createWedge(arc, "sector")),
    segmentOf: (arc: string) => put(createWedge(arc, "segment")),

    // Marks.
    /** Equal-side ticks on a path, `at` being the fraction of the way along it. */
    tick: (path: string, at = 0.5, strokes = STROKES) =>
      put(createTick("equal", path, at, strokes, false)),
    parallelMark: (path: string, at = 0.5, strokes = STROKES) =>
      put(createTick("parallel", path, at, strokes, false)),
    angleMark: (corner: string, a: string, b: string, strokes = STROKES, reflex = false) => {
      const arms: [string, string] = [point(a), point(b)];
      const sides = arms.map((arm) => sideJoining(held, point(corner), arm));
      return put(
        createAngleMark(point(corner), arms, [sides[0], sides[1]], strokes, reflex, MARK_RADIUS),
      );
    },

    // Writing.
    caption: (x: number, y: number, text: string, width = CAPTION_WIDTH) => {
      const made = createCaption({ x, y }, width, CAPTION_LOOK);
      return put({ ...made, html: text });
    },
    measure: (kind: MeasureKind, of: string[], x: number, y: number) =>
      put(createMeasurement(kind, of, { x, y })),

    // Names and how things are drawn.
    /** Pin a name on something and show it. */
    label: (id: string, name: string) => {
      const held = find(id);
      change(id, { label: { ...held.label, name, shown: true } });
      return id;
    },
    show: (id: string) => {
      const held = find(id);
      change(id, { label: { ...held.label, shown: true } });
      return id;
    },
    hide: (id: string) => {
      const held = find(id);
      change(id, { label: { ...held.label, shown: false } });
      return id;
    },
    style: (id: string, look: { colour?: string; weight?: LineWidth; pattern?: LinePattern }) => {
      find(id);
      change(id, look);
      return id;
    },
    size: (id: string, at: PointSize) => {
      point(id);
      change(id, { size: at } as Partial<SketchObject>);
      return id;
    },

    // Reading and taking away what is already on the page.
    /** Every object on this page, oldest first, as ids. */
    all: () => held.map((object) => object.id),
    /** What kind of thing something is. */
    kindOf: (id: string) => find(id).kind,
    /** Where a point sits. Only a plotted point has a place of its own. */
    at: (id: string) => {
      const found = find(id);
      if (!isPoint(found)) throw new ScriptError(`${id} is a ${found.kind}, not a point.`);
      return { x: found.x, y: found.y };
    },
    /** What something is called, whether the name was typed or handed out. */
    nameOf: (id: string) => namesFor(held).get(find(id).id) ?? null,
    /** The object with a given name, or null. */
    byLabel: (name: string) => {
      const names = namesFor(held);
      const found = held.find((object) => names.get(object.id) === name);
      return found ? found.id : null;
    },
    /** Take something off the page, and everything built on it with it. */
    remove: (id: string) => {
      find(id);
      const going = withDependents(held, [id]);
      for (let index = held.length - 1; index >= 0; index -= 1) {
        if (going.has(held[index].id)) held.splice(index, 1);
      }
    },
  };
}

/** Every name a script may call. */
export function apiNames(): string[] {
  return Object.keys(apiFor([], { width: 0, height: 0, pixelRatio: 1 }, DEFAULT_POINT_SIZE));
}

/**
 * Run a script over a page. `objects` is what is on that page already, empty
 * for a new one. Nothing is committed here: the host lands what comes back,
 * once, so the whole script is one undo step.
 */
export function evaluate(
  source: string,
  page: { objects: SketchObject[]; sheet: ScriptSheet; pointSize?: PointSize },
): ScriptResult {
  const names = apiNames();

  const missing = unknownCalls(source, names);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: missing.map((name) => `GRASP has no ${name}(). Nothing was drawn.`),
    };
  }

  const held = [...page.objects];
  const api = apiFor(held, page.sheet, page.pointSize ?? DEFAULT_POINT_SIZE);
  const keys = Object.keys(api);

  let script: (...values: unknown[]) => void;
  try {
    // The API is in scope, and the obvious ways out of it are shadowed away.
    script = new Function(...keys, ...SHADOWED, `"use strict";\n${source}\n`) as typeof script;
  } catch (error) {
    return { ok: false, errors: [`That is not valid JavaScript: ${(error as Error).message}`] };
  }

  try {
    script(...keys.map((key) => api[key as keyof typeof api]));
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }

  try {
    return { ok: true, objects: resolve(held) };
  } catch (error) {
    return { ok: false, errors: [`The figure could not be settled: ${(error as Error).message}`] };
  }
}

/** One call, as the prompt lists it: how it is written and what it does. */
export interface ApiEntry {
  /** The call with its parameters, and what it hands back after an arrow. */
  call: string;
  /** One line, in the terms a figure is described in. */
  says: string;
}

/**
 * The whole API, written out for the prompt. A handle is the string a call
 * hands back; every call that takes an object takes a handle.
 *
 * `apiNames` reads the API itself rather than this list, and `missingFromApiReference`
 * says where the two have parted company, so a call cannot be added without
 * being described.
 */
export const API_REFERENCE: { heading: string; entries: ApiEntry[] }[] = [
  {
    heading: "Points",
    entries: [
      { call: "point(x, y) -> handle", says: "A point where you put it, in sheet units." },
      { call: "midpoint(a, b) -> handle", says: "The point halfway between two points." },
      {
        call: "intersect(pathOne, pathOther, pick = 0) -> handle",
        says: "Where two paths cross. Two paths that cross twice give the first crossing at pick 0 and the second at pick 1.",
      },
      {
        call: "pointOn(path, at) -> handle",
        says: "A point riding a path, `at` being the fraction of the way along it, 0 to 1.",
      },
      {
        call: "translate(of, dx, dy) -> handle",
        says: "The point moved by that much in x and y.",
      },
      {
        call: "rotate(of, centre, degrees) -> handle",
        says: "The point turned about a centre. Positive turns clockwise on screen, y running down.",
      },
      {
        call: "dilate(of, centre, ratio) -> handle",
        says: "The point scaled towards or away from a centre.",
      },
      {
        call: "reflect(of, mirror) -> handle",
        says: "The point mirrored in a straight object.",
      },
    ],
  },
  {
    heading: "Straight objects",
    entries: [
      { call: "segment(a, b) -> handle", says: "The stretch between two points." },
      { call: "ray(a, b) -> handle", says: "From the first point out through the second." },
      { call: "line(a, b) -> handle", says: "Through both points and out either way." },
      {
        call: "parallel(at, to) -> handle",
        says: "A line through a point, parallel to a straight object.",
      },
      {
        call: "perpendicular(at, to) -> handle",
        says: "A line through a point, at right angles to a straight object.",
      },
      {
        call: "bisector(corner, a, b) -> handle",
        says: "The line that halves the angle at a corner between two arms.",
      },
    ],
  },
  {
    heading: "Circles and arcs",
    entries: [
      {
        call: "circle(centre, edge) -> handle",
        says: "A circle about a centre, through a point on its rim.",
      },
      {
        call: "circleRadius(centre, along) -> handle",
        says: "A circle about a centre, as wide as a straight object already drawn.",
      },
      {
        call: "arcOn(circle, from, to) -> handle",
        says: "The stretch of a circle between two points on it.",
      },
      {
        call: "arcAt(centre, from, to) -> handle",
        says: "An arc about a centre, from one point to another.",
      },
      { call: "arcThrough(from, via, to) -> handle", says: "The arc through three points." },
    ],
  },
  {
    heading: "Fills",
    entries: [
      {
        call: "polygon(...corners) -> handle",
        says: "The inside of a ring of three corners or more.",
      },
      { call: "fill(circle) -> handle", says: "The inside of a circle." },
      { call: "sector(arc) -> handle", says: "The wedge of an arc, out to its centre." },
      { call: "segmentOf(arc) -> handle", says: "The piece an arc's chord cuts off." },
    ],
  },
  {
    heading: "Markings",
    entries: [
      {
        call: "tick(path, at = 0.5, strokes = 1) -> handle",
        says: "Equal-side ticks on a path. Sides that match carry the same number of strokes.",
      },
      {
        call: "parallelMark(path, at = 0.5, strokes = 1) -> handle",
        says: "Parallel arrows on a path.",
      },
      {
        call: "angleMark(corner, a, b, strokes = 1, reflex = false) -> handle",
        says: "Arcs on the angle at a corner between two arms. Both arms want a segment already drawn from the corner.",
      },
    ],
  },
  {
    heading: "Writing",
    entries: [
      {
        call: "caption(x, y, text, width = 160) -> handle",
        says: "A line of text on the sheet, where you put it.",
      },
      {
        call: "measure(kind, [handles], x, y) -> handle",
        says: 'A number taken off the figure, written where you put it. `kind` is "length" off a segment, "area" off a fill or a circle, "angle" off three points given as arm, corner, arm, "radius" off a circle.',
      },
    ],
  },
  {
    heading: "Names and how things are drawn",
    entries: [
      { call: "label(handle, name) -> handle", says: "Name something and show the name." },
      { call: "show(handle) -> handle", says: "Show its name." },
      { call: "hide(handle) -> handle", says: "Stop showing its name." },
      {
        call: "style(handle, { colour, weight, pattern })",
        says: 'How it is drawn. Colours are "--color-ink-black", "-grey", "-red", "-orange", "-green", "-blue", "-purple", "-magenta". Weight is "hairline", "thin", "medium" or "thick". Pattern is "solid", "dashed" or "dotted".',
      },
      {
        call: "size(point, size)",
        says: 'How big a point is drawn: "dot", "small", "medium" or "large".',
      },
    ],
  },
  {
    heading: "Reading the page",
    entries: [
      { call: "all() -> handle[]", says: "Everything on this page, oldest first." },
      {
        call: "kindOf(handle) -> string",
        says: 'What it is: "point", "line", "circle", "arc", "interior", "mark", "caption", "measurement".',
      },
      { call: "at(point) -> { x, y }", says: "Where a point sits." },
      { call: "nameOf(handle) -> string", says: "What it is called." },
      { call: "byLabel(name) -> handle", says: "The thing with that name, or null." },
      { call: "remove(handle)", says: "Take it off the page, and everything built on it with it." },
      { call: "sheet", says: "Not a call: an object carrying `width`, `height` and `pixelRatio`." },
    ],
  },
];

/** Every call the API has that the reference does not describe. */
export function missingFromApiReference(): string[] {
  const described = new Set(
    API_REFERENCE.flatMap((group) => group.entries).map((entry) => entry.call.split(/[( ]/)[0]),
  );
  return apiNames().filter((name) => !described.has(name));
}

export type ScriptApi = ReturnType<typeof apiFor>;
