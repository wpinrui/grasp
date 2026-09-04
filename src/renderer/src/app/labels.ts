/**
 * Names, labels and what is out of view: everything the labels panel and the
 * hidden panel act on, and the renaming a label typed into asks for.
 *
 * A label carries the name it was given and keeps it, so nothing here has to
 * guard a name against moving on the next pass. A name landing on one already
 * in use is allowed, but only what was typed into may change, so a write reads
 * the page back first: anything named by its own run, a measurement or a
 * parameter, is given that name in writing before it can lose it.
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
  nameable,
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
   * Give one object a name. Whatever already answers to it keeps it, written
   * down as what it is called now, so the name lands without moving a single
   * other name on the page. An empty name takes the name away, and a label
   * still showing is given the next one the run has going.
   */
  function giveName(id: string, name: string, options?: { keep?: string; show?: boolean }) {
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
        // A measurement, parameter, calculation or table letters itself, so
        // the one that was called this is given that name in writing before it
        // loses it: without that the run would move it along on the next pass.
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

  /**
   * What the hidden panel lists: one row per object out of view. A row whose
   * name is empty is something never labelled, and the panel says so its own
   * way; the row is there either way, since what is out of view has to be
   * reachable to be brought back.
   */
  function hiddenRows(): HiddenRow[] {
    const names = namesFor(objects);
    const row = (object: SketchObject, name: string) => ({
      id: object.id,
      name,
      kind: kindOf(object).replace(/^(a|an|another) /, ""),
    });
    return objects.flatMap((object) => {
      if (object.hidden !== true) return [];
      // A caption carries no name, so the row is what the caption says, and a
      // measurement is listed by its reading for the same reason: its number is
      // what tells it from the next one. Neither is listed while it says
      // nothing at all, having nothing to be told apart by.
      if (isCaption(object)) {
        const said = captionRowName(object.html);
        return said ? [row(object, said)] : [];
      }
      if (isMeasurement(object)) {
        const read = readingText(readingOf(object, { objects, names, settled: geometry }));
        return read ? [row(object, read)] : [];
      }
      if (!nameable(object, objects)) return [];
      return [row(object, names.get(object.id) ?? "")];
    });
  }

  /**
   * What the panel lists: one row per object that can carry a name, whether or
   * not it has one. A row with an empty name is something never labelled, and
   * typing a name into it is how it gets both its name and its label.
   */
  function labelRows(): LabelRow[] {
    const names = namesFor(objects);
    return objects.flatMap((object) => {
      if (!nameable(object, objects)) return [];
      return [
        {
          id: object.id,
          name: names.get(object.id) ?? "",
          kind: kindOf(object).replace(/^(a|an|another) /, ""),
          shown: object.label?.shown === true,
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
   * a name is allowed, and the one that had it keeps it. A name typed onto
   * something never labelled labels it, since a name asked for is a name meant
   * to be read. An empty name takes the name away, and a label still showing
   * takes the next one the run has going.
   */
  function rename(id: string, name: string) {
    if (!name) {
      giveName(id, "");
      return;
    }
    const first = objects.find((object) => object.id === id)?.label?.name === undefined;
    giveName(id, name, { keep: holderOf(id, name)?.id, show: first });
  }

  /**
   * Name an object and show the label, which is what a relabel run does to each
   * vertex it is pointed at: there is no sense naming what cannot be read.
   */
  function labelAs(id: string, name: string) {
    giveName(id, name, { keep: holderOf(id, name)?.id, show: true });
  }

  /**
   * Ctrl+K shows the labels of everything selected, or hides them when they are
   * all showing already. With nothing selected it acts on the whole page, so
   * labelling a figure is one keystroke rather than one per object.
   */
  function toggleLabels() {
    const before = sketch.read();
    const wanted =
      before.selection.length > 0
        ? before.objects.filter((object) => before.selection.includes(object.id))
        : before.objects;
    const able = wanted.filter((object) => nameable(object, before.objects));
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
