/**
 * What a drag actually moves, and putting it there.
 *
 * Only a point has a place of its own. Everything else is dragged by whatever
 * holds it: a line by its ends, a circle by its centre and its radius point, a
 * fill by its corners, and so on down. Writing is the exception, since it sits
 * where it was put and what it quotes is not what holds it there.
 */

import {
  alongPath,
  familyOf,
  isLine,
  isPoint,
  isWriting,
  movedBy,
  type Position,
  pathIn,
  pointsOf,
  type Settled,
  type SketchObject,
  type SketchPoint,
  type SketchWriting,
  settle,
  TINY,
} from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";

/** What a drag has hold of, and where each of those objects started. */
export interface Held {
  ids: string[];
  /** Where each of them started: `from[n]` is where `ids[n]` was. */
  from: Position[];
}

/**
 * What a drag on these objects actually moves, and where each of them starts,
 * or null when there is nothing in them that can be moved.
 */
export function whatMoves(carried: string[], objects: SketchObject[]): Held | null {
  // A point that was constructed carries what it was built on, so it moves
  // like anything else and takes its whole configuration with it.
  const wanted = new Set<string>();
  const written: SketchWriting[] = [];
  for (const id of carried) {
    const object = objects.find((candidate) => candidate.id === id);
    if (!object) continue;
    // Writing travels with the drag, and the objects it names stay put unless
    // they were selected in their own right.
    if (isWriting(object)) {
      written.push(object);
      continue;
    }
    if (isPoint(object)) wanted.add(object.id);
    else for (const parent of familyOf(object) ?? []) wanted.add(parent);
  }
  const moving = new Set(movedBy(objects, [...wanted]));
  const dragged: (SketchPoint | SketchWriting)[] = [
    ...pointsOf(objects).filter((point) => moving.has(point.id)),
    ...written,
  ];
  if (dragged.length === 0) return null;
  return {
    ids: dragged.map((object) => object.id),
    from: dragged.map((object) => ({ x: object.x, y: object.y })),
  };
}

/**
 * Take hold of what a drag will move. One object already in the selection
 * carries the whole selection with it; one outside it takes the selection over
 * first.
 */
export function takeHold(hitId: string, sketch: Sketch): Held | null {
  const before = sketch.read();
  const carried = before.selection.includes(hitId) ? before.selection : [hitId];
  const held = whatMoves(carried, before.objects);
  if (!held) return null;
  sketch.beginGesture();
  if (carried !== before.selection) sketch.updateGesture({ ...before, selection: carried });
  return held;
}

/** Whether the drag moves this object, wherever down the page it hangs off. */
function movesWith(objects: SketchObject[], held: Held, id: string): boolean {
  return movedBy(objects, [id]).some((point) => held.ids.includes(point));
}

/**
 * Whether the drag is moving what holds a path up. `held.ids` names points and
 * writing, never paths, so the question goes to the path's own parents, each of
 * which is moving if the drag has hold of it or of anything it hangs off.
 */
function carrying(objects: SketchObject[], held: Held, path: string): boolean {
  const found = objects.find((object) => object.id === path);
  if (!found) return false;
  return (familyOf(found) ?? []).some((parent) => movesWith(objects, held, parent));
}

/**
 * The end of a straight object the drag leaves alone, where it is moving the
 * other one. A dragged point on that path keeps how far along it sits, so this
 * loose end is what has to give for the point to follow the pointer.
 *
 * Only a straight object drawn through two points has such an end. Every other
 * path is placed by more than a loose point, so a point on one rides it.
 */
function looseEnd(objects: SketchObject[], held: Held, path: string) {
  const found = objects.find((object) => object.id === path);
  if (!found || !isLine(found) || found.span.kind !== "through") return null;
  const [first, second] = found.span.ends;
  const moving = movesWith(objects, held, first);
  if (moving === movesWith(objects, held, second)) return null;
  const loose = objects.find((object) => object.id === (moving ? second : first));
  // A loose end that is itself placed by something else cannot be put anywhere.
  if (!loose || !isPoint(loose) || loose.from) return null;
  return { loose: loose.id, anchor: moving ? first : second, looseIsFirst: !moving };
}

/**
 * Where the loose end of a path has to go for a dragged point on it to land
 * under the pointer with how far along it sits unchanged. The point sits a
 * share of the way from the anchored end to the loose one, so the end goes that
 * many times as far as the point is being asked to.
 */
function pulledEnds(placed: SketchObject[], held: Held, by: Position): Map<string, Position> {
  const pulls = new Map<string, Position>();
  let settled: Settled | null = null;
  for (const point of pointsOf(placed)) {
    const from = point.from;
    const index = held.ids.indexOf(point.id);
    if (from?.kind !== "on" || index === -1) continue;
    const ends = looseEnd(placed, held, from.path);
    if (!ends) continue;
    const share = ends.looseIsFirst ? 1 - from.at : from.at;
    // Sitting on the anchored end itself, the point says nothing about where
    // the loose one belongs.
    if (share < TINY) continue;
    settled ??= settle(placed).settled;
    const anchor = settled.points.get(ends.anchor);
    if (!anchor) continue;
    const start = held.from[index];
    pulls.set(ends.loose, {
      x: anchor.x + (start.x + by.x - anchor.x) / share,
      y: anchor.y + (start.y + by.y - anchor.y) / share,
    });
  }
  return pulls;
}

/** Everything a drag has hold of, as far along as the pointer has come. */
export function placedBy(objects: SketchObject[], held: Held, by: Position): SketchObject[] {
  const geometry = settle(objects).settled;
  const placed = objects.map((object) => {
    const index = held.ids.indexOf(object.id);
    if (index === -1) return object;
    const start = held.from[index];
    const to = { x: start.x + by.x, y: start.y + by.y };
    const from = isPoint(object) ? object.from : undefined;
    if (from?.kind === "on") {
      // A point on a path slides along it instead of going where the pointer
      // went, unless the path is being dragged as well. Then how far along it
      // sits is what holds, and the path gives instead: sliding it as well
      // would count the drag twice over.
      const path = pathIn(geometry, from.path);
      if (!path || carrying(objects, held, from.path)) return object;
      return { ...object, from: { ...from, at: alongPath(path, to) } };
    }
    return { ...object, x: to.x, y: to.y };
  });
  const pulled = pulledEnds(placed, held, by);
  if (pulled.size === 0) return placed;
  return placed.map((object) => {
    const at = pulled.get(object.id);
    return at ? { ...object, x: at.x, y: at.y } : object;
  });
}

/** Put everything a drag has hold of where it has got to, as the gesture runs. */
export function moveBy(held: Held, by: Position, sketch: Sketch) {
  const before = sketch.read();
  sketch.updateGesture({ ...before, objects: placedBy(before.objects, held, by) });
}
