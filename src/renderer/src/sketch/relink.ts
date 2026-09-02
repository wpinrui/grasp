/**
 * Split and Merge: changing what an object hangs off, rather than what it is.
 *
 * Splitting cuts a point loose from whatever was holding it, leaving it where
 * it stands and free to be dragged anywhere. Merging is the other way: one
 * point becomes another, or takes up residence on a path and slides along it.
 * Between them they fix a construction that was built slightly wrong without
 * starting it again.
 */

import { rewrite, rewriteArc, rewriteCircle, rewriteSpan } from "./iterate";
import {
  alongPath,
  cornersOf,
  createPoint,
  familyOf,
  filledPath,
  isArc,
  isCalculation,
  isCaption,
  isCircle,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isMeasurement,
  isPoint,
  isTable,
  isTransform,
  type PathGeometry,
  type Settled,
  type SketchObject,
  type SketchPoint,
} from "./model";

/** How far apart a point splits into one per child, in sheet pixels. */
const APART = 14;

/**
 * One object with every reference to another id swapped, keeping its own id and
 * everything else about it. This is what merging does to the page and what
 * splitting a point apart does to each of its children.
 */
export function reparent(object: SketchObject, at: (id: string) => string): SketchObject {
  if (isPoint(object)) return object.from ? { ...object, from: rewrite(object.from, at) } : object;
  if (isLine(object)) return { ...object, span: rewriteSpan(object.span, at) };
  if (isCircle(object)) return { ...object, span: rewriteCircle(object.span, at) };
  if (isArc(object)) return { ...object, span: rewriteArc(object.span, at) };
  if (isInterior(object)) {
    const round = filledPath(object);
    if (round) return { ...object, of: at(round) };
    return { ...object, vertices: (cornersOf(object) ?? []).map(at) };
  }
  if (isMeasurement(object) || isTable(object)) {
    return { ...object, of: object.of.map(at) };
  }
  if (isLocus(object)) {
    return {
      ...object,
      driver: at(object.driver),
      domain: at(object.domain),
      driven: at(object.driven),
    };
  }
  if (isMark(object)) {
    if ("path" in object) return { ...object, path: at(object.path) };
    return {
      ...object,
      corner: at(object.corner),
      arms: [at(object.arms[0]), at(object.arms[1])],
      sides: [at(object.sides[0]), at(object.sides[1])],
    };
  }
  if (isTransform(object)) {
    return { ...object, seed: at(object.seed), image: at(object.image) };
  }
  // A caption names what it reads inside its own markup, and a calculation
  // reads numbers rather than points, so neither is touched by a swap of two
  // points except through the ids written into the caption itself.
  if (isCaption(object) || isCalculation(object)) return object;
  return object;
}

/** A caption's Hot Text links, which hold ids in the markup rather than beside it. */
export function relinkCaption(html: string, from: string, to: string): string {
  return html.split(`data-link="${from}"`).join(`data-link="${to}"`);
}

/** Every object that hangs directly off this one. */
export function childrenOf(objects: SketchObject[], id: string): SketchObject[] {
  return objects.filter((object) => (familyOf(object) ?? []).includes(id));
}

/** What Split/Merge would do with the selection as it stands. */
export type SplitMerge =
  /** Cut a point loose from whatever holds it, leaving it where it stands. */
  | { kind: "free"; point: string; label: string }
  /** One point per child, so things that shared a point stop sharing it. */
  | { kind: "apart"; point: string; label: string }
  /** One point becomes the other, and everything that read it reads that. */
  | { kind: "join"; from: string; to: string; label: string }
  /** A point takes up residence on a path and slides along it from then on. */
  | { kind: "onto"; point: string; path: string; label: string };

/** What a point being cut loose was being held by, for the entry to say so. */
function heldBy(point: SketchPoint): string {
  const from = point.from;
  if (!from) return "";
  if (from.kind === "on") return "Split Point from Path";
  if (from.kind === "cross") return "Split Intersection from Paths";
  if (from.kind === "midpoint") return "Split Midpoint from Points";
  return "Split Point from Definition";
}

/**
 * What Split/Merge means right now, or null when the selection is not one it
 * can act on. The entry says which of the two it would do rather than leaving
 * it to be found out by pressing.
 */
export function splitMergeFor(objects: SketchObject[], selection: string[]): SplitMerge | null {
  const held = selection
    .map((id) => objects.find((object) => object.id === id))
    .filter((object): object is SketchObject => object !== undefined);
  if (held.length === 1) {
    const only = held[0];
    if (!isPoint(only)) return null;
    // Held by something: cutting it loose is the only thing to do with it.
    if (only.from) return { kind: "free", point: only.id, label: heldBy(only) };
    // Free already, but shared: it can come apart into one point per child.
    if (childrenOf(objects, only.id).length >= 2) {
      return { kind: "apart", point: only.id, label: "Split Point" };
    }
    return null;
  }
  if (held.length !== 2) return null;
  const [one, other] = held;
  if (isPoint(one) && isPoint(other)) {
    // One of them has to be free to move, and it must not be what the other is
    // built on, or the survivor would end up defined in terms of itself.
    const join = (from: SketchPoint, to: SketchPoint) =>
      !from.from && !dependsOnPoint(objects, to.id, from.id)
        ? ({ kind: "join", from: from.id, to: to.id, label: "Merge Points" } as const)
        : null;
    return join(one, other) ?? join(other, one);
  }
  const point = [one, other].find(isPoint);
  const path = [one, other].find((object) => isLine(object) || isCircle(object) || isArc(object));
  if (!point || !path || point.from) return null;
  if (dependsOnPoint(objects, path.id, point.id)) return null;
  return { kind: "onto", point: point.id, path: path.id, label: "Merge Point to Path" };
}

/** Whether one object is built on another, however far down. */
function dependsOnPoint(objects: SketchObject[], of: string, on: string): boolean {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (id === on) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const object = objects.find((candidate) => candidate.id === id);
    return (familyOf(object as SketchObject) ?? []).some(walk);
  };
  const object = objects.find((candidate) => candidate.id === of);
  return object ? (familyOf(object) ?? []).some(walk) : false;
}

/**
 * The page after a split or a merge. Everything keeps its id where it can, so
 * what was built on what carries on being built on it.
 */
export function splitMerged(
  objects: SketchObject[],
  what: SplitMerge,
  settled: Settled,
  paths: (id: string) => PathGeometry | undefined,
): SketchObject[] {
  if (what.kind === "free") {
    // It stays where it stands. The page is already settled, so the place it
    // was worked out at is the place it is written at.
    return objects.map((object) =>
      object.id === what.point && isPoint(object) ? { ...object, from: undefined } : object,
    );
  }
  if (what.kind === "onto") {
    const along = paths(what.path);
    const spot = settled.points.get(what.point);
    if (!along || !spot) return objects;
    return objects.map((object) =>
      object.id === what.point && isPoint(object)
        ? { ...object, from: { kind: "on", path: what.path, at: alongPath(along, spot) } }
        : object,
    );
  }
  if (what.kind === "join") {
    const at = (id: string) => (id === what.from ? what.to : id);
    return objects
      .filter((object) => object.id !== what.from)
      .map((object) =>
        isCaption(object)
          ? { ...object, html: relinkCaption(object.html, what.from, what.to) }
          : reparent(object, at),
      );
  }
  return comeApart(objects, what.point);
}

/**
 * One point per child. The first child keeps the point it had and the rest each
 * get one of their own, set a little way off so it is plain there are now
 * several where there was one.
 */
function comeApart(objects: SketchObject[], id: string): SketchObject[] {
  const point = objects.find((object) => object.id === id);
  if (!point || !isPoint(point)) return objects;
  const children = childrenOf(objects, id);
  if (children.length < 2) return objects;
  const made: SketchPoint[] = [];
  const takes = new Map<string, string>();
  children.slice(1).forEach((child, nth) => {
    // Round a small circle, so two come apart across and three make a triangle.
    const turn = (nth / (children.length - 1)) * Math.PI * 2;
    const copy = createPoint(
      { x: point.x + Math.cos(turn) * APART, y: point.y + Math.sin(turn) * APART },
      point.size,
    );
    made.push(copy);
    takes.set(child.id, copy.id);
  });
  const next: SketchObject[] = [];
  for (const object of objects) {
    next.push(object);
    // A copy goes in beside the point it came from, so it is settled before
    // whatever hangs off it.
    if (object.id === id) next.push(...made);
  }
  return next.map((object) => {
    const mine = takes.get(object.id);
    return mine ? reparent(object, (held) => (held === id ? mine : held)) : object;
  });
}
