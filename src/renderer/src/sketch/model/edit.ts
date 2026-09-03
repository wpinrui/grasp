import { nextId } from "./create";
import type { PointSize } from "./figures";
import { familyOf, isCaption, isMeasurement, isPoint, pointsOf, type SketchState } from "./guards";
import type { SketchObject } from "./values";
/**
 * The size the selected points share, or null when they differ or when nothing
 * is selected. This is what Point Style ticks.
 */
export function sharedPointSize(state: SketchState): PointSize | null {
  const selected = pointsOf(state.objects).filter((object) => state.selection.includes(object.id));
  if (selected.length === 0) return null;
  const first = selected[0].size;
  return selected.every((object) => object.size === first) ? first : null;
}

/** How far a pasted copy steps off what it came from, in sheet units. */
export const PASTE_STEP = 16;

/**
 * These objects and everything they hang off, in the order the sketch holds
 * them. A segment cannot exist without its ends, so copying one takes them
 * too, and copying a figure takes whatever it was built on.
 */
export function withFamily(objects: SketchObject[], ids: string[]): SketchObject[] {
  const wanted = new Set<string>();
  const walk = (id: string) => {
    if (wanted.has(id)) return;
    const object = objects.find((candidate) => candidate.id === id);
    if (!object) return;
    wanted.add(id);
    for (const parent of familyOf(object) ?? []) walk(parent);
  };
  for (const id of ids) walk(id);
  return objects.filter((object) => wanted.has(object.id));
}

/**
 * The same objects again as a copy: new ids, no pinned names, and stepped off
 * where they came from so the copy is not hiding under the original. The step
 * grows with each paste of the same copy, so pasting twice gives two.
 *
 * The ids are swapped over the serialised text rather than field by field. An
 * object points at another in a dozen different shapes and a caption's links
 * are buried in its markup, while an id is unique enough that no other text in
 * a sketch can collide with one.
 */

/**
 * The same objects again with fresh ids, for a page being copied. Unlike a
 * paste nothing moves and nothing is renamed: a duplicate page is meant to be
 * the same page, and two pages never share a sheet for their names to clash on.
 */
export function asDuplicated(taken: SketchObject[]): SketchObject[] {
  if (taken.length === 0) return [];
  let text = JSON.stringify(taken);
  for (const object of taken) text = text.split(object.id).join(nextId(object.kind));
  return JSON.parse(text) as SketchObject[];
}

export function asPasted(taken: SketchObject[], step: number): SketchObject[] {
  if (taken.length === 0) return [];
  let text = JSON.stringify(taken);
  for (const object of taken) text = text.split(object.id).join(nextId(object.kind));
  const made = JSON.parse(text) as SketchObject[];
  const off = PASTE_STEP * step;
  for (const object of made) {
    // A copy takes the next free name of its run rather than the one it came
    // with, since two points called A can never both be on the sheet.
    if (object.label?.name !== undefined) {
      object.label = { shown: object.label.shown, off: object.label.off };
    }
    // Only what is placed by hand moves. Everything derived follows its
    // parents, and a mark rides whatever it marks.
    if (isPoint(object) && object.from) continue;
    if (isPoint(object) || isCaption(object) || isMeasurement(object)) {
      object.x += off;
      object.y += off;
    }
  }
  return made;
}

/**
 * One step up or down the family tree, which is what Select Parents and Select
 * Children take. Parents are what an object depends on directly, children what
 * depends on it directly.
 *
 * An object with none of them stays selected, since there is nowhere to go. An
 * object whose kin are hidden drops out of the selection instead, because a
 * hidden object is not on the sheet to be handed.
 */
export function kinOf(
  objects: SketchObject[],
  ids: string[],
  way: "parents" | "children",
): string[] {
  const has = (id: string) => objects.find((candidate) => candidate.id === id);
  const next = new Set<string>();
  for (const id of ids) {
    const object = has(id);
    if (!object) continue;
    const kin =
      way === "parents"
        ? (familyOf(object) ?? []).filter(has)
        : objects
            .filter((candidate) => (familyOf(candidate) ?? []).includes(id))
            .map((candidate) => candidate.id);
    if (kin.length === 0) {
      next.add(id);
      continue;
    }
    for (const relative of kin) {
      if (has(relative)?.hidden !== true) next.add(relative);
    }
  }
  return [...next];
}
