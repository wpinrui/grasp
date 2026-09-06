import { BUILT_INS } from "./expression";
import { readingOf } from "./measure";
import { isMeasurement, namedAmong, namesFor, type Settled, type SketchObject } from "./model";

/** Typeable measurement references, with stable object IDs retained in expressions. */
export function valueNames(objects: SketchObject[], settled: Settled): Map<string, string> {
  const names = namesFor(
    namedAmong(
      objects,
      objects.map((object) => object.id),
    ),
  );
  const result = new Map(names);
  const taken = new Set(
    objects.filter((object) => !isMeasurement(object)).map((object) => names.get(object.id)),
  );
  for (const object of objects) {
    if (!isMeasurement(object)) continue;
    const reading = readingOf(object, { objects, settled, names });
    const text = reading.fraction
      ? `ratio_${reading.fraction.top.map((part) => part.text).join("")}_${reading.fraction.bottom.map((part) => part.text).join("")}`
      : reading.lead.map((part) => part.text).join("");
    const base =
      text
        .replace(/^m /, "")
        .replace(/m∠/g, "angle_")
        .replace(/[^A-Za-z0-9_']/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "") ||
      names.get(object.id) ||
      "value";
    const identifier = /^[A-Za-z_]/.test(base) ? base : `value_${base}`;
    let name = identifier;
    for (
      let suffix = 2;
      taken.has(name) || ["e", "pi", "x", ...BUILT_INS].includes(name);
      suffix += 1
    )
      name = `${identifier}_${suffix}`;
    result.set(object.id, name);
    taken.add(name);
  }
  return result;
}
