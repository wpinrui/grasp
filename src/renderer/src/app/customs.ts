/**
 * Custom transforms: a transform shown by example rather than given a number.
 * Defining one keeps the example, applying one puts every point of the
 * selection through that example again.
 */

import { canDefine, customImager } from "../sketch/custom";
import { createCustomTransform, isTransform, type SketchObject } from "../sketch/model";
import { imagedBy } from "../sketch/transforms";
import type { Sketch } from "../sketch/useSketch";

export interface CustomContext {
  sketch: Sketch;
  objects: SketchObject[];
  selection: string[];
  setCustomDialog: (next: "define" | "edit" | null) => void;
}

export function customActions({ sketch, objects, selection, setCustomDialog }: CustomContext) {
  /** The custom transforms this page holds, in the order they were defined. */
  const customs = objects.filter(isTransform);

  /** Define Custom Transform: the example is the selection, so it wants a name. */
  function defineCustom(name: string) {
    setCustomDialog(null);
    if (!canDefine(objects, selection)) return;
    // The seed keeps the selection, since it is still what the example is on.
    sketch.addObjects([createCustomTransform(name, selection[0], selection[1])], selection);
  }

  /**
   * Applying one: every point of the selection goes through the whole example
   * again, and what the selection holds is rebuilt on the images, exactly as a
   * rotation rebuilds it.
   */
  function applyCustom(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found || !isTransform(found)) return;
    const made = imagedBy(selection, objects, customImager(found, objects));
    if (made.length > 0) sketch.addObjects(made);
  }

  /**
   * Taking one off the menu. Nothing hangs off the transform itself, since what
   * it made hangs off the example's points, so its images stay where they are
   * and stay live.
   */
  function dropCustom(id: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.filter((object) => object.id !== id),
      selection: before.selection.filter((held) => held !== id),
    });
  }

  function renameCustom(id: string, name: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isTransform(object) ? { ...object, name } : object,
      ),
    });
  }

  return { customs, defineCustom, applyCustom, dropCustom, renameCustom };
}

/** The transforms shown by example, as the window holds them. */
export type Custom = ReturnType<typeof customActions>;
