/**
 * Writing a caption: changing one, settling what was typed, dropping a link
 * into it, and putting it away again.
 *
 * The text lives in the browser while a caption is open, so it has to be read
 * back out of the field before that field goes. A caption being written into is
 * also the one thing the palette is set on, which is why opening and closing
 * one moves the selection about.
 */

import type { RefObject } from "react";
import { insertAtCaret, linkHtml, plainText } from "../../sketch/captions";
import {
  type CaptionAlign,
  createCaption,
  isCaption,
  type Position,
  type SketchCaption,
} from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";

/** What the sheet hands the caption writing. */
export interface Writing {
  sketch: Sketch;
  /** The captions on the sheet, for reading back the one that is open. */
  captions: SketchCaption[];
  /** What a Hot Text link says, by the id it stands for. */
  linkNames: Map<string, string>;
  /** The caption being typed into. It belongs to the window, not the page. */
  editing: string | null;
  onEditing: (id: string | null) => void;
  /** Where the text palette reaches the caption being typed into. */
  editor: RefObject<HTMLDivElement | null>;
  onLabelPick: (id: string | null, additive?: boolean) => void;
  /** How a new caption comes out, from Preferences and the palette. */
  look: { font: string; size: number; colour: string; align: CaptionAlign };
}

export function useCaptions({
  sketch,
  captions,
  linkNames,
  editing,
  onEditing,
  editor,
  onLabelPick,
  look,
}: Writing) {
  /** One caption changed, as a step of its own or as part of a gesture. */
  function changeCaption(id: string, change: Partial<SketchCaption>, step: boolean) {
    const before = sketch.read();
    const next = {
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isCaption(object) ? { ...object, ...change } : object,
      ),
    };
    if (step) sketch.commit(next);
    else sketch.updateGesture(next);
  }

  /**
   * Keep what was written, unless it says nothing: a caption that is blank when
   * it is finished is taken off the sheet rather than left sitting there empty.
   */
  function settleCaption(id: string, html: string) {
    const before = sketch.read();
    const found = before.objects.find((object) => object.id === id);
    if (!found || !isCaption(found)) return;
    if (plainText(html) === "") {
      sketch.commit({
        objects: before.objects.filter((object) => object.id !== id),
        selection: before.selection.filter((one) => one !== id),
      });
      if (editing === id) onEditing(null);
      return;
    }
    if (found.html !== html) changeCaption(id, { html }, true);
  }

  /** Drop a link to what was clicked into the caption being written. */
  function insertLink(id: string) {
    const element = editor.current;
    const name = linkNames.get(id);
    if (!element || !name || !editing) return;
    insertAtCaret(element, linkHtml(id, name));
    changeCaption(editing, { html: element.innerHTML }, true);
  }

  /** Put the open caption away, or open another, keeping whatever was written. */
  function closeCaption(next: string | null) {
    const element = editor.current;
    const open = editing ? captions.find((one) => one.id === editing) : null;
    if (open && element) settleCaption(open.id, element.innerHTML);
    // A caption being written into is the one thing the palette is set on, so
    // opening one lets go of the selection and of any picked label rather than
    // setting the bar on two things at once. Putting one away hands it back to
    // the selection, so the bar is still on it and its grip is still there, and
    // a press on bare sheet with the Arrow lets go of that in its own turn. A
    // caption left empty is gone by now, and a selection cannot hold what is
    // not there.
    if (next) {
      sketch.select([]);
      onLabelPick(null);
    } else if (open && sketch.read().objects.some((one) => one.id === open.id)) {
      sketch.select([open.id]);
    }
    onEditing(next);
  }

  /** A caption of its own, made where it was asked for and opened to type in. */
  function makeCaption(at: Position, width: number) {
    const made = createCaption(at, width, look);
    const before = sketch.read();
    sketch.commit({ objects: [...before.objects, made], selection: [made.id] });
    onEditing(made.id);
  }

  return { changeCaption, closeCaption, insertLink, makeCaption, settleCaption };
}
