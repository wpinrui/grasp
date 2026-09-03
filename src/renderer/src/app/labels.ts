/**
 * Names, labels and what is out of view: everything the labels panel and the
 * hidden panel act on, and the renaming a label typed into asks for.
 *
 * A name is either pinned to an object or handed out automatically, so several
 * of these read the whole page back before they write: handing a name over has
 * to pin what the old holder was called, or the automatic run would move it off
 * that name on the next pass.
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

/** A name typed into a label that something else already answers to. */
export interface Clash {
  id: string;
  name: string;
  holder: string;
}

export interface LabelContext {
  sketch: Sketch;
  objects: SketchObject[];
  selection: string[];
  /** Where everything sits, for reading a measurement out by its number. */
  geometry: Settled;
  setClash: (clash: Clash | null) => void;
}

export function labelActions({ sketch, objects, selection, geometry, setClash }: LabelContext) {
  /**
   * Give one object a name, and optionally hand it over from whatever held it,
   * which puts that one back on the automatic run. An empty name unpins.
   */
  function pinName(id: string, name: string, swap?: { freed?: string; kept?: string }) {
    const freed = swap?.freed;
    const kept = swap?.kept;
    const before = sketch.read();
    const names = namesFor(before.objects);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) {
          return { ...object, label: { ...object.label, name: name || undefined } };
        }
        // Handing the name over: the old holder goes back to automatic.
        if (object.id === freed) {
          return { ...object, label: { ...object.label, name: undefined } };
        }
        // Keeping both: the old holder has to pin what it was called, or the
        // automatic run would move it off the name on the next pass.
        if (object.id === kept) {
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

  /** What to call an object in a sentence. */
  function kindOf(object: SketchObject): string {
    if (isCaption(object)) return "a caption";
    if (isPoint(object)) return "another point";
    if (isCircle(object)) return "a circle";
    if (isArc(object)) return "an arc";
    if (isInterior(object)) return "a fill";
    if (isMeasurement(object)) return "a measurement";
    if (isLine(object)) return `a ${object.form}`;
    return "a locus";
  }

  /** A label was typed into. An empty name puts the object back on the run. */
  function rename(id: string, name: string) {
    if (!name) {
      pinName(id, "");
      return;
    }
    const names = namesFor(objects);
    const holder = objects.find((object) => object.id !== id && names.get(object.id) === name);
    if (!holder) {
      pinName(id, name);
      return;
    }
    setClash({ id, name, holder: kindOf(holder) });
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

  return {
    pinName,
    showLabels,
    hideObjects,
    hiddenRows,
    labelRows,
    kindOf,
    rename,
    toggleLabels,
  };
}
