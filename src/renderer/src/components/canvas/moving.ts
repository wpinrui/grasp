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
  isPoint,
  isWriting,
  movedBy,
  type Position,
  pathIn,
  pointsOf,
  type SketchObject,
  type SketchPoint,
  type SketchWriting,
  settle,
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

/** Everything a drag has hold of, as far along as the pointer has come. */
export function placedBy(objects: SketchObject[], held: Held, by: Position): SketchObject[] {
  const geometry = settle(objects).settled;
  return objects.map((object) => {
    const index = held.ids.indexOf(object.id);
    if (index === -1) return object;
    const start = held.from[index];
    const to = { x: start.x + by.x, y: start.y + by.y };
    const from = isPoint(object) ? object.from : undefined;
    if (from?.kind === "on") {
      // A point on a path slides along it instead of going where the pointer
      // went.
      //
      // The second test means to leave it alone where its own path is being
      // dragged as well, but cannot: `held.ids` holds points and writing,
      // never paths, so it never matches and such a point moves twice.
      const path = pathIn(geometry, from.path);
      if (!path || held.ids.includes(from.path)) return object;
      return { ...object, from: { ...from, at: alongPath(path, to) } };
    }
    return { ...object, x: to.x, y: to.y };
  });
}

/** Put everything a drag has hold of where it has got to, as the gesture runs. */
export function moveBy(held: Held, by: Position, sketch: Sketch) {
  const before = sketch.read();
  sketch.updateGesture({ ...before, objects: placedBy(before.objects, held, by) });
}
