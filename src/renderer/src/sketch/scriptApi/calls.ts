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
  type SketchObject,
  withDependents,
} from "../model";
/**
 * The API a script is run with: every call it can make, and the list of objects
 * those calls build.
 *
 * None of this touches the app. Every call that makes something appends a plain
 * object to a list held here and hands back its id, so the page a script is
 * working on is untouched until the script returns and the host lands what came
 * back. A call that fails throws, the list is dropped, and there is nothing to
 * put back.
 */

/** How big the sheet is on screen, which is what a script sizes itself against. */
export interface ScriptSheet {
  /** The view's size in sheet units. */
  width: number;
  height: number;
  pixelRatio: number;
}

/** The strokes a mark carries unless the script says otherwise. */
const STROKES = 1;

/** How far an angle mark's arcs stand from the corner, in sheet units. */
const MARK_RADIUS = 28;

/** How wide a caption's box is dragged out when the script does not say. */
const CAPTION_WIDTH = 160;

/** What a caption written by a script is set in. */
const CAPTION_LOOK = { font: "Times New Roman", size: 14, colour: "--color-ink-black" };

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

/** The bookkeeping every group of calls shares: what is held, and how to reach it. */
interface PageOps {
  held: SketchObject[];
  put: <T extends SketchObject>(object: T) => string;
  find: (id: string) => SketchObject;
  point: (id: string) => string;
  change: (id: string, part: Partial<SketchObject>) => void;
}

function pageOps(held: SketchObject[]): PageOps {
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

  return { held, put, find, point, change };
}

/** The calls that put a point on the page, plotted or worked out from others. */
function plotting({ put, point }: PageOps, size: PointSize) {
  return {
    point: (x: number, y: number) => put(createPoint({ x, y }, size)),
    midpoint: (a: string, b: string) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "midpoint", of: point(a), and: point(b) })),
    /** Where two paths cross. `pick` chooses between two crossings, 0 or 1. */
    intersect: (one: string, other: string, pick = 0) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "cross", of: one, and: other, pick })),
    /** A point riding a path, `at` being the fraction of the way along it. */
    pointOn: (path: string, at: number) =>
      put(createPoint({ x: 0, y: 0 }, size, { kind: "on", path, at })),

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
  };
}

/** The calls that draw a path, and the calls that fill one in. */
function drawing({ put, point }: PageOps) {
  const straight = (form: LineForm) => (a: string, b: string) =>
    put(createLine(form, { kind: "through", ends: [point(a), point(b)] }));
  return {
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

    polygon: (...corners: string[]) => {
      if (corners.length < 3) throw new ScriptError("A polygon wants three corners or more.");
      return put(createInterior(corners.map(point)));
    },
    fill: (circle: string) => put(createFill(circle)),
    sector: (arc: string) => put(createWedge(arc, "sector")),
    segmentOf: (arc: string) => put(createWedge(arc, "segment")),
  };
}

/** The calls that put a mark on a path or in a corner. */
function marking({ held, put, point }: PageOps) {
  return {
    /** Equal-side ticks on a path, `at` being the fraction of the way along it. */
    tick: (path: string, at = 0.5, strokes = STROKES) =>
      put(createTick({ form: "equal", path, at, strokes, flipped: false })),
    parallelMark: (path: string, at = 0.5, strokes = STROKES) =>
      put(createTick({ form: "parallel", path, at, strokes, flipped: false })),
    angleMark: (corner: string, a: string, b: string, strokes = STROKES, reflex = false) => {
      const arms: [string, string] = [point(a), point(b)];
      const sides = arms.map((arm) => sideJoining(held, point(corner), arm));
      return put(
        createAngleMark({
          corner: point(corner),
          arms,
          sides: [sides[0], sides[1]],
          strokes,
          reflex,
          radius: MARK_RADIUS,
        }),
      );
    },
  };
}

/** The calls that write on the sheet. */
function writing({ put }: PageOps) {
  return {
    caption: (x: number, y: number, text: string, width = CAPTION_WIDTH) => {
      const made = createCaption({ x, y }, width, CAPTION_LOOK);
      return put({ ...made, html: text });
    },
    measure: (kind: MeasureKind, of: string[], x: number, y: number) =>
      put(createMeasurement(kind, of, { x, y })),
  };
}

/** The calls that name something, or change how it is drawn. */
function naming({ find, point, change }: PageOps) {
  return {
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
  };
}

/** The calls that read the page back, and the one that takes something off it. */
function reading({ held, find }: PageOps) {
  return {
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

/**
 * The API, bound to the list of objects a run is building. Every call that
 * makes something appends it and hands back its id; every call that reads or
 * changes something works on what is in the list, which for an edit is the page
 * as it stands.
 */
export function apiFor(held: SketchObject[], sheet: ScriptSheet, size: PointSize) {
  const ops = pageOps(held);
  return {
    /** How big the sheet is on screen, so a script sizes itself rather than guessing. */
    sheet,
    ...plotting(ops, size),
    ...drawing(ops),
    ...marking(ops),
    ...writing(ops),
    ...naming(ops),
    ...reading(ops),
  };
}

/** Every name a script may call. */
export function apiNames(): string[] {
  return Object.keys(apiFor([], { width: 0, height: 0, pixelRatio: 1 }, DEFAULT_POINT_SIZE));
}

export type ScriptApi = ReturnType<typeof apiFor>;
