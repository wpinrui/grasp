/**
 * What a drag actually moves, and putting it there.
 *
 * Only a point has a place of its own. Everything else is dragged by whatever
 * holds it: a line by its ends, a circle by its centre and its radius point, a
 * fill by its corners, and so on down. Writing is the exception, since it sits
 * where it was put and what it quotes is not what holds it there.
 */

import { endsOf, frameOf, spotOf } from "../../sketch/measure";
import {
  alongPath,
  familyOf,
  isMeasurement,
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

/**
 * Whether the drag moves the geometry this object stands on, wherever down the
 * page it hangs off. A point on a path moves when the drag has hold of it, and
 * again when what holds its path up is moving, since it rides the path then.
 * Writing stops the walk: it sits where it was put and holds nothing up, so a
 * drag carrying a caption answers no here however much the caption reads.
 */
function movesWith(objects: SketchObject[], held: Held, id: string): boolean {
  const seen = new Set<string>();
  const walk = (at: string): boolean => {
    if (seen.has(at)) return false;
    seen.add(at);
    const object = objects.find((candidate) => candidate.id === at);
    if (!object || isWriting(object)) return false;
    if (held.ids.includes(at)) return true;
    return (familyOf(object) ?? []).some(walk);
  };
  return walk(id);
}

/** A path's two ends, told apart by which one the drag leaves free. */
interface LooseEnd {
  /** The end nothing in the drag is moving, which is what has to give. */
  loose: string;
  /** The end the drag has already put somewhere, which the point is measured from. */
  anchor: string;
  /** Whether the loose end is the one how far along the path is counted from. */
  looseIsFirst: boolean;
}

/**
 * The end of a path the drag is not moving, where it is moving the other one. A
 * dragged point on that path keeps how far along it sits, so this loose end is
 * what has to give for the point to follow the pointer.
 *
 * Only a straight object drawn through two points has such an end to give. A
 * point dragged on any other path rides it.
 */
function looseEnd(objects: SketchObject[], held: Held, path: string): LooseEnd | null {
  const found = objects.find((object) => object.id === path);
  const ends = found ? endsOf(found) : null;
  if (!ends) return null;
  const moving = movesWith(objects, held, ends[0]);
  if (moving === movesWith(objects, held, ends[1])) return null;
  const loose = objects.find((object) => object.id === (moving ? ends[1] : ends[0]));
  // An end placed by something else of its own cannot be put anywhere.
  if (!loose || !isPoint(loose) || loose.from) return null;
  return { loose: loose.id, anchor: moving ? ends[0] : ends[1], looseIsFirst: !moving };
}

/** Where the pointer is asking one of the objects a drag holds to be. */
function wantedAt(held: Held, index: number, by: Position): Position {
  return { x: held.from[index].x + by.x, y: held.from[index].y + by.y };
}

/** A loose end that has to move, and what the point on its path is asking for. */
interface Pull {
  ends: LooseEnd;
  /** How much of the way from the anchor to the loose end the point sits. */
  share: number;
  /** Where the point has to land. */
  at: Position;
}

/**
 * Every loose end this drag has to move. An end two points are both asking for
 * is dropped: one end cannot answer two of them, so both ride instead.
 */
function pullsIn(placed: SketchObject[], held: Held, by: Position): Pull[] {
  const wanted: Pull[] = [];
  for (const point of pointsOf(placed)) {
    const from = point.from;
    const index = held.ids.indexOf(point.id);
    if (from?.kind !== "on" || index === -1) continue;
    const ends = looseEnd(placed, held, from.path);
    if (!ends) continue;
    const share = ends.looseIsFirst ? 1 - from.at : from.at;
    // Sitting on the anchored end itself, a point says nothing about where the
    // loose one belongs, and the arithmetic below would divide by nothing.
    if (Math.abs(share) < TINY) continue;
    wanted.push({ ends, share, at: wantedAt(held, index, by) });
  }
  const asked = new Map<string, number>();
  for (const pull of wanted) asked.set(pull.ends.loose, (asked.get(pull.ends.loose) ?? 0) + 1);
  return wanted.filter((pull) => asked.get(pull.ends.loose) === 1);
}

/**
 * Everything the drag put down, with each loose end moved to where the point
 * dragged on its path needs it. The point sits a share of the way from the
 * anchored end to the loose one, so the end goes that many times as far as the
 * point was asked to.
 *
 * One at a time, settling in between, in the order the points come on the page.
 * Parents come before what hangs off them there, so an anchor riding a path an
 * earlier pull has moved is measured from where it has got to. An anchor that
 * reaches a pulled end some other way round can still be read before it moves.
 */
function pulled(placed: SketchObject[], held: Held, by: Position): SketchObject[] {
  let done = placed;
  for (const pull of pullsIn(placed, held, by)) {
    const anchor = settle(done).settled.points.get(pull.ends.anchor);
    if (!anchor) continue;
    const at = {
      x: anchor.x + (pull.at.x - anchor.x) / pull.share,
      y: anchor.y + (pull.at.y - anchor.y) / pull.share,
    };
    done = done.map((object) => (object.id === pull.ends.loose ? { ...object, ...at } : object));
  }
  return done;
}

/**
 * Everything a drag has hold of, as far along as the pointer has come, and the
 * loose end of any path that has to give for a point dragged on it to follow.
 */
export function placedBy(objects: SketchObject[], held: Held, by: Position): SketchObject[] {
  const geometry = settle(objects).settled;
  const placed = objects.map((object) => {
    const index = held.ids.indexOf(object.id);
    if (index === -1) return object;
    const to = wantedAt(held, index, by);
    const from = isPoint(object) ? object.from : undefined;
    if (from?.kind === "on") {
      // A point on a path slides along it instead of going where the pointer
      // went, unless the path is moving too. Then how far along it sits is what
      // holds and the path gives instead, and sliding it along as well would
      // count the drag twice over.
      const path = pathIn(geometry, from.path);
      if (!path || movesWith(objects, held, from.path)) return object;
      return { ...object, from: { ...from, at: alongPath(path, to) } };
    }
    if (isMeasurement(object) && object.linked) {
      // A linked number rides its figure. Where the drag is moving that figure
      // too the number is already being carried by it, and moving it again
      // would count the drag twice; dragged on its own, where it is dropped is
      // where it hangs from then on.
      if (object.of.some((id) => movesWith(objects, held, id))) return object;
      const frame = frameOf(object, objects, geometry);
      if (frame) return { ...object, linked: spotOf(frame, to) };
    }
    return { ...object, x: to.x, y: to.y };
  });
  return pulled(placed, held, by);
}

/** Put everything a drag has hold of where it has got to, as the gesture runs. */
export function moveBy(held: Held, by: Position, sketch: Sketch) {
  const before = sketch.read();
  sketch.updateGesture({ ...before, objects: placedBy(before.objects, held, by) });
}
