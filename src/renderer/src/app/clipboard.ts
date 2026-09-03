/**
 * Cut, copy, paste, and walking the family tree.
 *
 * The clipboard belongs to the app rather than to this window, so a figure
 * copied here pastes into another sketch, and what is on it is read back rather
 * than remembered.
 */

import { asPasted, kinOf, type SketchObject, withFamily } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";

export interface ClipboardContext {
  sketch: Sketch;
  objects: SketchObject[];
  selection: string[];
  /** Delete, which takes the images with it as ever. */
  remove: () => void;
  /** What the clipboard is holding now, so Paste knows whether it has work. */
  setClipHeld: (held: string | null) => void;
}

export function clipboardActions({
  sketch,
  objects,
  selection,
  remove,
  setClipHeld,
}: ClipboardContext) {
  /**
   * Copy: what is selected and everything it hangs off, since a segment cannot
   * be pasted without its ends. The clipboard belongs to the app rather than to
   * this window, so a figure copied here pastes into another sketch.
   */
  function copySelection() {
    const taken = withFamily(objects, selection);
    if (taken.length === 0) return;
    window.api.objects.write(JSON.stringify(taken));
    setClipHeld(window.api.objects.peek());
  }

  /**
   * Select Parents and Select Children, one step up or down the family tree. An
   * object with none stays selected; one whose kin are hidden drops out.
   */
  function selectKin(way: "parents" | "children") {
    if (selection.length === 0) return;
    sketch.select(kinOf(objects, selection, way));
  }

  /** Cut is a copy and then a delete, which takes the images with it as ever. */
  function cutSelection() {
    copySelection();
    remove();
  }

  /**
   * Paste: the copy lands stepped off what it came from, with fresh names, and
   * comes out selected. Pasting again steps again, so two pastes give two.
   */
  function pasteObjects() {
    const held = window.api.objects.take();
    if (!held) return;
    let taken: SketchObject[];
    try {
      taken = JSON.parse(held.text) as SketchObject[];
    } catch {
      return;
    }
    sketch.addObjects(asPasted(taken, held.step));
  }

  return { copySelection, cutSelection, pasteObjects, selectKin };
}
