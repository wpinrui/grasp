/**
 * What a new reading has to be able to say. A measurement reads out the names
 * of what it measures, so taking one names whatever it spells out. Without a
 * name there the reading would say "?? = 5 cm".
 *
 * It names them and nothing more: a label already showing goes on showing, one
 * put away stays away, and one never asked for stays unasked for. Taking a
 * measurement says what the reading needs, not what the figure shows.
 */

import { spelledOutBy } from "./measure";
import { isMeasurement, namedAmong, namesFor, type SketchObject } from "./model";

/** The page with a name on everything a reading that has just landed spells out. */
export function spelledOutNamed(objects: SketchObject[], already: Set<string>): SketchObject[] {
  const fresh = objects.filter((object) => isMeasurement(object) && !already.has(object.id));
  if (fresh.length === 0) return objects;
  const names = namesFor(objects);
  const spelled = new Set(
    fresh.flatMap((one) => (isMeasurement(one) ? spelledOutBy(one, { objects, names }) : [])),
  );
  return namedAmong(
    objects,
    objects
      .filter((object) => spelled.has(object.id) && !object.label?.name)
      .map((object) => object.id),
  );
}
