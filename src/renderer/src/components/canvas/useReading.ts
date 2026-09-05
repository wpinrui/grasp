/**
 * A reading's panel and what it sets: how far the number is written out, how a
 * length is drawn out, and which way round an angle is read. Each is one change
 * to one reading, committed as one undo step.
 *
 * What the Measure tool is offering is kept here too, and it is one thing with
 * two faces: over somewhere a number can be taken it is a ghost of that number,
 * and over a number already on the sheet it is that number lit, since a click
 * there goes to it rather than laying a second copy on top. Never both, which
 * is why they are set together rather than one at a time.
 */

import { useState } from "react";
import { frameOf, spotOf } from "../../sketch/measure";
import { isMark, isMeasurement, type SketchMeasurement, settle } from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";
import { sameAngle } from "./readings";
import { sameReading, type Written } from "./sheet";

/** What the Measure tool is offering: a ghost of a number, or one already there. */
export interface Offering {
  ghost: Written | null;
  held: string | null;
}

/**
 * The readings, and the panel that is open on one. `panel` is the id of the
 * reading whose panel is up, which is a thing about the window, not the page.
 */
export function useReading(sketch: Sketch) {
  const [panel, setPanel] = useState<string | null>(null);
  /**
   * The ghost of a number, or the id of one already there, or neither. The
   * ghost is drawn so the number can be seen before it is asked for.
   */
  const [offering, setOffering] = useState<Offering>({ ghost: null, held: null });

  /**
   * What the Measure tool is offering from where the pointer is. A number
   * already on the sheet is lit rather than ghosted over: a click will go to
   * it, and drawing a second copy on top would say otherwise.
   */
  function offer(ghost: Written | null, held: string | null) {
    setOffering((was) => {
      const next = { ghost: held ? null : ghost, held };
      const same = sameReading(was.ghost, next.ghost) && was.held === next.held;
      return same ? was : next;
    });
  }

  /** Nothing under the pointer to take a number off, so nothing is offered. */
  function offerNothing() {
    setOffering((was) =>
      was.ghost === null && was.held === null ? was : { ghost: null, held: null },
    );
  }

  /**
   * One reading changed, committed as one undo step. Everything the panel sets
   * but the reflex is one field on one reading, so they all come through here.
   */
  function change(id: string, part: Partial<SketchMeasurement>) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, ...part } : object,
      ),
    });
  }

  /** How a length is drawn out, and whether it carries its dotted lines. */
  function setBounds(id: string, bounds: "broken" | "full" | undefined) {
    change(id, { bounds });
  }

  /**
   * How far one reading is written out. It is pinned on that reading, so it
   * keeps what it was given while the rest of the sheet follows Preferences.
   */
  function setPlaces(id: string, places: number) {
    change(id, { places });
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

  /**
   * The number tied to what it reads, or let loose again. Tying it takes the
   * spot it is at now, so nothing jumps as the chain goes on; letting it loose
   * leaves it where the figure had carried it to.
   */
  function setTied(id: string, on: boolean) {
    const before = sketch.read();
    const reading = before.objects.find((object) => object.id === id);
    if (!reading || !isMeasurement(reading)) return;
    if (!on) {
      change(id, { tied: undefined });
      return;
    }
    const frame = frameOf(reading, before.objects, settle(before.objects).settled);
    if (frame) change(id, { tied: spotOf(frame, reading) });
  }

  function setLeaders(id: string, leaders: boolean) {
    change(id, { leaders });
  }
  return {
    offer,
    offering,
    offerNothing,
    panel,
    setBounds,
    setLeaders,
    setTied,
    setPanel,
    setPlaces,
    setReflex,
  };
}
