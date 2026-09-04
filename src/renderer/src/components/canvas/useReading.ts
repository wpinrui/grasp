/**
 * What a reading's panel sets: how far it is written out, how a length is drawn
 * out, and which way round an angle is read.
 *
 * Each is one change to one reading, committed as one undo step, so a panel
 * press is a thing the page remembers rather than a thing the window holds.
 */

import { useState } from "react";
import { isMark, isMeasurement } from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";
import { sameAngle } from "./readings";
import type { Written } from "./sheet";

/**
 * The readings, and the panel that is open on one. `panel` is the id of the
 * reading whose panel is up, which is a thing about the window, not the page.
 */
export function useReading(sketch: Sketch) {
  const [panel, setPanel] = useState<string | null>(null);
  /** What the Measure tool would write from where the pointer is. */
  const [preview, setPreview] = useState<Written | null>(null);

  /** How a length is drawn out, and whether it carries its dotted lines. */
  function setBounds(id: string, bounds: "broken" | "full" | undefined) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, bounds } : object,
      ),
    });
  }

  /**
   * How far one reading is written out. It is pinned on that reading, so it
   * keeps what it was given while the rest of the sheet follows Preferences.
   */
  function setPlaces(id: string, places: number) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, places } : object,
      ),
    });
  }

  /**
   * An angle read the long way round. The mark on that angle goes round with
   * it: the arcs are what say which of the angles at that corner the number is
   * about, so they cannot say one thing while the number says the other.
   */
  function setReflex(id: string, reflex: boolean) {
    const before = sketch.read();
    const reading = before.objects.find((object) => object.id === id);
    if (!reading || !isMeasurement(reading)) return;
    const [one, corner, other] = reading.of;
    // Where this is the only number on that angle, the mark goes round with it.
    // Where both sizes of the angle are written, the arcs cannot agree with
    // both, so they stay where they are.
    const alone =
      before.objects.filter(
        (object) =>
          isMeasurement(object) && object.measure === "angle" && sameAngle(object.of, reading.of),
      ).length === 1;
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) return { ...reading, reflex };
        if (
          alone &&
          isMark(object) &&
          !("path" in object) &&
          object.corner === corner &&
          object.arms.every((arm) => arm === one || arm === other)
        ) {
          return { ...object, reflex };
        }
        return object;
      }),
    });
  }

  function setLeaders(id: string, leaders: boolean) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, leaders } : object,
      ),
    });
  }
  return { panel, setPanel, preview, setPreview, setBounds, setLeaders, setPlaces, setReflex };
}
