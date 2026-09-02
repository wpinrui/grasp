import type { MenuAction } from "../components/menus";
import { wouldMeasure } from "./measure";
import { MEASURE_OF, measurements } from "./measured";
import type { Settled, View } from "./model";
import {
  alongPath,
  arcAt,
  clipToRect,
  createArc,
  createCircle,
  createFill,
  createInterior,
  createLine,
  createLocus,
  createWedge,
  crossings,
  type Derivation,
  distance,
  isArc,
  isCircle,
  isLine,
  isLocus,
  isPoint,
  isWriting,
  type LineForm,
  type LineSpan,
  lineThrough,
  type PathGeometry,
  POINT_SAMPLES,
  type PointSize,
  type Position,
  pathIn,
  SHAPE_SAMPLES,
  type SketchArc,
  type SketchCircle,
  type SketchLine,
  type SketchObject,
  type SketchPoint,
  withDependents,
} from "./model";
import { pointsFrom } from "./transforms";
/**
 * What a Construct or Measure entry would build with the selection as it stands.
 *
 * It answers both the click and the hover: hovering an entry draws this on the
 * sheet as a ghost, which is what says which way a Ray would run. Nothing here
 * touches the page: every call takes what is on it and hands back what would
 * land, so the same answer serves the ghost and the commit.
 */

/** The page as a build reads it, so nothing here needs the app around it. */
export interface Building {
  objects: SketchObject[];
  /** The selected objects, in the order they were picked. */
  selected: SketchObject[];
  chosenLines: SketchLine[];
  /** The selected objects a point can be put on and slide along. */
  chosenPaths: (SketchLine | SketchCircle)[];
  chosenPoints: SketchPoint[];
  /** Where everything on the page runs, which is what says whether two of them cross. */
  geometry: Settled;
  /** The size a point built here comes out at. */
  pointSize: PointSize;
  view: View;
  /** The canvas in screen pixels, which is how far a locus is drawn out. */
  viewport: { width: number; height: number };
}

/**
 * Where Point on Object drops its point: somewhere along the path that looks
 * arbitrary, as the reference app's does, but the same every time so that the
 * hover preview and what lands agree.
 */
function spotOn(id: string): number {
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) % 997;
  return 0.2 + (hash / 997) * 0.6;
}

/**
 * Parallel and Perpendicular want one straight object to follow and the
 * points to run through, and nothing else in the selection.
 */
export function alongAndThrough(
  page: Building,
): { line: SketchLine; points: SketchPoint[] } | null {
  if (page.chosenLines.length !== 1 || page.chosenPoints.length === 0) return null;
  if (page.chosenLines.length + page.chosenPoints.length !== page.selected.length) return null;
  return { line: page.chosenLines[0], points: page.chosenPoints };
}

function alongObjects(page: Building, kind: "parallel" | "perpendicular"): SketchObject[] {
  const found = alongAndThrough(page);
  if (!found) return [];
  return found.points.map((point) => createLine("line", { kind, at: point.id, to: found.line.id }));
}

/** Two segments meeting at a point: that point is the corner to halve. */
export function bisector(page: Building): LineSpan | null {
  if (page.chosenLines.length !== 2 || page.chosenLines.length !== page.selected.length)
    return null;
  const [one, other] = page.chosenLines;
  if (one.form !== "segment" || other.form !== "segment") return null;
  if (one.span.kind !== "through" || other.span.kind !== "through") return null;
  const ends = other.span.ends;
  const shared = one.span.ends.filter((end) => ends.includes(end));
  if (shared.length !== 1) return null;
  const corner = shared[0];
  const a = one.span.ends.find((end) => end !== corner);
  const b = ends.find((end) => end !== corner);
  return a && b ? { kind: "bisector", corner, a, b } : null;
}

/**
 * A point at every place the two selected paths meet, since a circle can meet
 * a line or another circle twice. Empty when they do not meet where they run,
 * which is what greys the entry out.
 */
function intersections(page: Building): Derivation[] {
  if (page.chosenPaths.length !== 2 || page.chosenPaths.length !== page.selected.length) return [];
  const one = pathIn(page.geometry, page.chosenPaths[0].id);
  const other = pathIn(page.geometry, page.chosenPaths[1].id);
  if (!one || !other) return [];
  return crossings(one, other).map((_, pick) => ({
    kind: "cross" as const,
    of: page.chosenPaths[0].id,
    and: page.chosenPaths[1].id,
    pick,
  }));
}

/**
 * What Midpoint would build: one for every selected segment, or one for two
 * selected points. Null when the selection is neither, which greys the entry.
 */
function midpoints(page: Building): Derivation[] | null {
  if (page.selected.length === 0) return null;
  // A segment drawn between two points is the only line with a middle.
  const spans = page.selected.flatMap((object) =>
    object.kind === "line" && object.form === "segment" && object.span.kind === "through"
      ? [object.span.ends]
      : [],
  );
  if (spans.length === page.selected.length) {
    return spans.map(([of, and]) => ({ kind: "midpoint" as const, of, and }));
  }
  if (page.selected.length !== 2 || !page.selected.every(isPoint)) return null;
  return [{ kind: "midpoint", of: page.selected[0].id, and: page.selected[1].id }];
}

/**
 * A locus's three parts, read off the selection: a point on a path and
 * something built on it, or an independent point, a path it does not touch,
 * and something built on it. Null when the selection is neither.
 */
export function locusParts(page: Building): {
  driver: SketchPoint;
  domain: SketchLine | SketchCircle | SketchArc;
  along: PathGeometry;
  driven: SketchObject;
} | null {
  const parts = (driver: SketchPoint, domain: SketchObject | undefined, driven: SketchObject) => {
    const round = domain && (isLine(domain) || isCircle(domain) || isArc(domain));
    // Writing has no positions to trace out, so it cannot be driven.
    if (!domain || !round || isLocus(driven) || isWriting(driven)) return null;
    const along = pathIn(page.geometry, domain.id);
    return along ? { driver, domain, along, driven } : null;
  };
  if (page.selected.length === 2) {
    for (const driver of page.selected) {
      if (!isPoint(driver) || driver.from?.kind !== "on") continue;
      const driven = page.selected.find((object) => object.id !== driver.id);
      // The driven object has to be built on the driver, or there is nothing
      // for the driver to drive.
      if (!driven || !withDependents(page.objects, [driver.id]).has(driven.id)) continue;
      const found = parts(
        driver,
        page.objects.find((object) => object.id === (driver.from as { path: string }).path),
        driven,
      );
      if (found) return found;
    }
    return null;
  }
  if (page.selected.length !== 3) return null;
  for (const driver of page.selected) {
    // An independent point brings its own path, which must not be one the
    // point itself moves.
    if (!isPoint(driver) || driver.from) continue;
    const family = withDependents(page.objects, [driver.id]);
    const rest = page.selected.filter((object) => object.id !== driver.id);
    for (const domain of rest) {
      if (family.has(domain.id)) continue;
      const driven = rest.find((object) => object.id !== domain.id);
      if (!driven || !family.has(driven.id)) continue;
      const found = parts(driver, domain, driven);
      if (found) return found;
    }
  }
  return null;
}

/**
 * How much of the domain the driver runs over: the whole of a segment, and
 * as much of a ray or a line as is on screen when the locus is built, since
 * neither of those ends.
 */
function spanOver(
  page: Building,
  domain: SketchLine | SketchCircle | SketchArc,
  along: PathGeometry,
): [number, number] {
  // A circle closes on itself, and a segment has two ends: either way the
  // driver runs the whole of it.
  // A circle closes on itself and a segment and an arc both have two ends:
  // any of them is run the whole way, with nothing to adjust.
  if (isCircle(domain) || isArc(domain) || !("form" in along) || domain.form === "segment") {
    return [0, 1];
  }
  const visible = {
    x: page.view.x,
    y: page.view.y,
    width: page.viewport.width / page.view.scale,
    height: page.viewport.height / page.view.scale,
  };
  const cut = clipToRect(along, visible);
  if (!cut) return [0, 1];
  const low = Math.min(alongPath(along, cut[0]), alongPath(along, cut[1]));
  const high = Math.max(alongPath(along, cut[0]), alongPath(along, cut[1]));
  if (high - low < 0.05) return [0, 1];
  return domain.form === "ray" ? [0, high] : [low, high];
}

function locus(page: Building): SketchObject[] {
  const found = locusParts(page);
  if (!found) return [];
  return [
    createLocus(
      found.driver.id,
      found.domain.id,
      found.driven.id,
      spanOver(page, found.domain, found.along),
      isPoint(found.driven) ? POINT_SAMPLES : SHAPE_SAMPLES,
    ),
  ];
}

/** A fill through the selected points, in the order they were picked. */
function interior(page: Building): SketchObject[] {
  if (page.chosenPoints.length < 3 || page.chosenPoints.length !== page.selected.length) return [];
  return [createInterior(page.chosenPoints.map((point) => point.id))];
}

/**
 * Arc on Circle: a circle and two points on it, or a centre and two points
 * the same distance from it, the centre picked first. Either way the arc runs
 * counter-clockwise from the first bounding point to the second.
 */
function arcOnCircle(page: Building): SketchObject[] {
  if (page.selected.length !== 3) return [];
  const round = page.selected.find(isCircle);
  if (round) {
    const ends = page.selected.filter(isPoint);
    const where = page.geometry.circles.get(round.id);
    if (ends.length !== 2 || !where) return [];
    // They have to be on the circle, not merely near it.
    const on = (spot: SketchPoint) =>
      Math.abs(distance(where.at, spot) - where.radius) <= Math.max(1e-6, where.radius * 1e-6);
    if (!ends.every(on)) return [];
    return [createArc({ kind: "on", circle: round.id, from: ends[0].id, to: ends[1].id })];
  }
  if (!page.selected.every(isPoint)) return [];
  const [centre, one, other] = page.selected;
  const reach = distance(centre, one);
  if (reach < 1e-6) return [];
  if (Math.abs(reach - distance(centre, other)) > Math.max(1e-6, reach * 1e-6)) return [];
  return [createArc({ kind: "centre", centre: centre.id, from: one.id, to: other.id })];
}

/**
 * Arc through 3 Points: it starts at the first, passes through the second and
 * ends at the third. Three points in a line with the middle one outside the
 * others describe no arc, so the entry greys out.
 */
function arcThrough(page: Building): SketchObject[] {
  if (page.selected.length !== 3 || !page.selected.every(isPoint)) return [];
  const span = {
    kind: "through" as const,
    from: page.selected[0].id,
    via: page.selected[1].id,
    to: page.selected[2].id,
  };
  return arcAt(span, page.geometry) ? [createArc(span)] : [];
}

/** The inside of every selected arc, one fill each, the way asked for. */
function arcFills(page: Building, wedge: "sector" | "segment"): SketchObject[] {
  const arcs = page.selected.filter(isArc);
  if (arcs.length === 0 || arcs.length !== page.selected.length) return [];
  return arcs.map((arc) => createWedge(arc.id, wedge));
}

/** The inside of every selected circle, one fill each. */
function circleInteriors(page: Building): SketchObject[] {
  const round = page.selected.filter(isCircle);
  if (round.length === 0 || round.length !== page.selected.length) return [];
  return round.map((circle) => createFill(circle.id));
}

/** One point on each selected path, free to slide along it. */
function pointsOnObjects(page: Building): SketchObject[] {
  if (page.chosenPaths.length === 0 || page.chosenPaths.length !== page.selected.length) return [];
  return page.chosenPaths.flatMap((path) => {
    if (!pathIn(page.geometry, path.id)) return [];
    const from = { kind: "on" as const, path: path.id, at: spotOn(path.id) };
    return pointsFrom([from], page.objects, page.pointSize);
  });
}

/**
 * A circle from two selected points, the first the centre and the second a
 * point on it, or from a point and a segment whose length is the radius.
 */
function circleFrom(
  page: Building,
  kind: "circle-centre-point" | "circle-centre-radius",
): SketchObject[] {
  if (page.selected.length !== 2) return [];
  if (kind === "circle-centre-point") {
    if (!page.selected.every(isPoint)) return [];
    return [
      createCircle({ kind: "through", centre: page.selected[0].id, edge: page.selected[1].id }),
    ];
  }
  if (page.chosenPoints.length !== 1 || page.chosenLines.length !== 1) return [];
  const along = page.chosenLines[0];
  // Only a segment has a length to lend. A ray and a line have no end.
  if (along.form !== "segment") return [];
  return [createCircle({ kind: "radius", centre: page.chosenPoints[0].id, along: along.id })];
}

/** Segment, Ray and Line take the two selected points, in the order picked. */
function lineObjects(page: Building, form: LineForm): SketchObject[] {
  if (page.selected.length !== 2 || !page.selected.every(isPoint)) return [];
  return [lineThrough(form, [page.selected[0].id, page.selected[1].id])];
}

/**
 * What a Construct entry would build with the selection as it stands. It
 * answers both the click and the hover: hovering an entry draws this on the
 * sheet as a ghost, which is what says which way a Ray would run.
 */
export function wouldBuild(page: Building, action: MenuAction | null): SketchObject[] {
  switch (action) {
    case "segment":
    case "ray":
    case "line":
      return lineObjects(page, action);
    case "parallel":
    case "perpendicular":
      return alongObjects(page, action);
    case "bisector": {
      const span = bisector(page);
      return span ? [createLine("ray", span)] : [];
    }
    case "intersection":
      return pointsFrom(intersections(page), page.objects, page.pointSize);
    case "point-on-object":
      return pointsOnObjects(page);
    case "interior":
      return interior(page);
    case "circle-interior":
      return circleInteriors(page);
    case "arc-sector":
      return arcFills(page, "sector");
    case "arc-segment":
      return arcFills(page, "segment");
    case "arc-on-circle":
      return arcOnCircle(page);
    case "arc-through":
      return arcThrough(page);
    case "locus":
      return locus(page);
    case "circle-centre-point":
    case "circle-centre-radius":
      return circleFrom(page, action);
    case "midpoint": {
      const wanted = midpoints(page);
      return wanted ? pointsFrom(wanted, page.objects, page.pointSize) : [];
    }
    default:
      // Every Measure entry, which writes a number rather than drawing one.
      return action ? measurements(page, action) : [];
  }
}

/** Whether three points lie on one straight line, near enough to read a ratio along. */
export function inLine(a: Position, b: Position, c: Position): boolean {
  const across = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const span = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
  return span > 0 && Math.abs(across) <= span * 1e-6;
}

/**
 * Whether an entry has anything to build with the selection as it stands, which
 * is what greys it out. Null for an action that builds nothing, so the caller
 * knows to answer it some other way.
 */
export function canBuild(page: Building, action: MenuAction): boolean | null {
  switch (action) {
    case "parallel":
    case "perpendicular":
      return alongAndThrough(page) !== null;
    case "bisector":
      return bisector(page) !== null;
    case "intersection":
      return intersections(page).length > 0;
    case "midpoint":
      return midpoints(page) !== null;
    case "point-on-object":
      return page.chosenPaths.length > 0 && page.chosenPaths.length === page.selected.length;
    case "interior":
      return interior(page).length > 0;
    case "circle-interior":
      return circleInteriors(page).length > 0;
    case "arc-sector":
    case "arc-segment":
      return arcFills(page, action === "arc-sector" ? "sector" : "segment").length > 0;
    case "arc-on-circle":
      return arcOnCircle(page).length > 0;
    case "arc-through":
      return arcThrough(page).length > 0;
    case "locus":
      return locusParts(page) !== null;
    case "circle-centre-point":
    case "circle-centre-radius":
      return circleFrom(page, action).length > 0;
    case "segment":
    case "ray":
    case "line":
      return page.selected.length === 2 && page.selected.every(isPoint);
    default: {
      const measure = MEASURE_OF[action];
      if (!measure) return null;
      return wouldMeasure(measure, page.selected, page.geometry).length > 0;
    }
  }
}
