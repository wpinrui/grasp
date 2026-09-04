/**
 * Names, labels and what is out of view: everything the labels panel and the
 * hidden panel act on, and the renaming a label typed into asks for.
 *
 * A name is either pinned to an object or handed out automatically, so several
 * of these read the whole page back before they write: a name landing on one
 * already in use has to pin what that one was called, or the automatic run
 * would move it off that name on the next pass.
 */

import type { HiddenRow } from "../components/HiddenPanel";
import type { LabelRow } from "../components/LabelPanel";
import { captionRowName } from "../sketch/captions";
import { readingOf, readingText } from "../sketch/measure";
import {
  isArc,
  isCaption,
  isCircle,
  isInterior,
  isLine,
  isMeasurement,
  isPoint,
  namesFor,
  type Settled,
  type SketchObject,
} from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";

export interface LabelContext {
  sketch: Sketch;
  objects: SketchObject[];
  selection: string[];
  /** Where everything sits, for reading a measurement out by its number. */
  geometry: Settled;
}

/** What to call an object in a sentence. */
export function kindOf(object: SketchObject): string {
  if (isCaption(object)) return "a caption";
  if (isPoint(object)) return "another point";
  if (isCircle(object)) return "a circle";
  if (isArc(object)) return "an arc";
  if (isInterior(object)) return "a fill";
  if (isMeasurement(object)) return "a measurement";
  if (isLine(object)) return `a ${object.form}`;
  return "a locus";
}

export function labelActions({ sketch, objects, selection, geometry }: LabelContext) {
  /**
   * Give one object a name. Whatever already answers to it keeps it, by pinning
   * what it is called now, so the name lands without moving a single other name
   * on the page. An empty name unpins, putting the object back on the run.
   */
  function pinName(id: string, name: string, options?: { keep?: string; show?: boolean }) {
    const keep = options?.keep;
    const before = sketch.read();
    const names = namesFor(before.objects);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) {
          const label = { ...object.label, name: name || undefined };
          return { ...object, label: options?.show ? { ...label, shown: true } : label };
        }
        // The one that was called this pins the name it has now, or the
        // automatic run would move it off the name on the next pass.
        if (object.id === keep) {
          return { ...object, label: { ...object.label, name: names.get(object.id) } };
        }
        return object;
      }),
    });
  }

  /** Show or hide the labels of the objects named, however they were named. */
  function showLabels(ids: string[], shown: boolean) {
    const before = sketch.read();
    const wanted = new Set(ids);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        wanted.has(object.id) ? { ...object, label: { ...object.label, shown } } : object,
      ),
    });
  }

  /**
   * Hide the objects named, or bring them back. A hidden object keeps its place
   * in the figure and everything built on it stays where it is; it is only out
   * of view. Hiding drops it from the selection, since what is not on the sheet
   * cannot be acted on there.
   */
  function hideObjects(ids: string[], hidden: boolean) {
    const before = sketch.read();
    const wanted = new Set(ids);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        wanted.has(object.id) ? { ...object, hidden } : object,
      ),
      selection: hidden ? before.selection.filter((id) => !wanted.has(id)) : before.selection,
    });
  }

  /** What the hidden panel lists: one row per object out of view. */
  function hiddenRows(): HiddenRow[] {
    const names = namesFor(objects);
    return objects.flatMap((object) => {
      if (object.hidden !== true) return [];
      // A caption carries no name, so the row is what the caption says, and a
      // measurement is listed by its reading for the same reason: its number is
      // what tells it from the next one.
      const name = isCaption(object)
        ? captionRowName(object.html)
        : isMeasurement(object)
          ? readingText(readingOf(object, { objects, names, settled: geometry }))
          : names.get(object.id);
      return name
        ? [{ id: object.id, name, kind: kindOf(object).replace(/^(a|an|another) /, "") }]
        : [];
    });
  }

  /** What the panel lists: one row per object that can carry a name. */
  function labelRows(): LabelRow[] {
    const names = namesFor(objects);
    return objects.flatMap((object) => {
      const name = names.get(object.id);
      if (!name) return [];
      return [
        {
          id: object.id,
          name,
          kind: kindOf(object).replace(/^(a|an|another) /, ""),
          shown: object.label?.shown === true,
          pinned: object.label?.name !== undefined,
          selected: selection.includes(object.id),
        },
      ];
    });
  }

  /** Whatever else on the page answers to a name already, if anything does. */
  function holderOf(id: string, name: string): SketchObject | undefined {
    const names = namesFor(objects);
    return objects.find((object) => object.id !== id && names.get(object.id) === name);
  }

  /**
   * A label was typed into, in the panel or on the sheet. The name lands as it
   * was typed, with nothing asked about one already in use: two objects sharing
   * a name is allowed, and the one that had it keeps it. An empty name puts the
   * object back on the run.
   */
  function rename(id: string, name: string) {
    if (!name) {
      pinName(id, "");
      return;
    }
    pinName(id, name, { keep: holderOf(id, name)?.id });
  }

  /**
   * Name an object and show the label, which is what a relabel run does to each
   * vertex it is pointed at: there is no sense naming what cannot be read.
   */
  function labelAs(id: string, name: string) {
    pinName(id, name, { keep: holderOf(id, name)?.id, show: true });
  }

  /**
   * Ctrl+K shows the labels of everything selected, or hides them when they are
   * all showing already. With nothing selected it acts on the whole page, so
   * labelling a figure is one keystroke rather than one per object.
   */
  function toggleLabels() {
    const before = sketch.read();
    const names = namesFor(before.objects);
    const wanted =
      before.selection.length > 0
        ? before.objects.filter((object) => before.selection.includes(object.id))
        : before.objects;
    const able = wanted.filter((object) => names.has(object.id));
    if (able.length === 0) return;
    const showing = able.every((object) => object.label?.shown);
    const ids = new Set(able.map((object) => object.id));
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        ids.has(object.id) ? { ...object, label: { ...object.label, shown: !showing } } : object,
      ),
    });
  }

  /** Bring back everything that is out of view, which is one menu entry and one key. */
  function showAllHidden() {
    hideObjects(
      objects.filter((object) => object.hidden === true).map((object) => object.id),
      false,
    );
  }

  return {
    labelAs,
    showAllHidden,
    showLabels,
    hideObjects,
    hiddenRows,
    labelRows,
    kindOf,
    rename,
    toggleLabels,
  };
}

/** Names, labels and what is out of view, as the window holds them. */
export type Naming = ReturnType<typeof labelActions>;
