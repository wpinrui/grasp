import { quantityOf, sayQuantity } from "./measure";
import { measurementUnits, placesFor, units } from "./measure/units";
import { isMeasurement, type Settled, type SketchObject } from "./model";
import { PLACES } from "./prefs";

export interface LinkFormat {
  places: number;
  unit: string;
  showUnit: boolean;
}

export interface CaptionReading {
  places: number;
  unit: string;
  units: readonly string[];
  value: (format: LinkFormat) => string;
}

/** Link overrides live in caption markup, independently of the source reading. */
export function linkFormat(link: Element, reading: CaptionReading): LinkFormat {
  const places = Number(link.getAttribute("data-places") ?? reading.places);
  const unit = link.getAttribute("data-unit") ?? reading.unit;
  return {
    places:
      Number.isInteger(places) && places >= PLACES[0] && places <= PLACES[PLACES.length - 1]
        ? places
        : reading.places,
    unit: reading.units.includes(unit) ? unit : reading.unit,
    showUnit: link.getAttribute("data-show-unit") !== "false",
  };
}

/** Current values and defaults; conversion starts from the unrounded quantity. */
export function captionReadings(
  objects: SketchObject[],
  settled: Settled,
): Map<string, CaptionReading> {
  const readings = new Map<string, CaptionReading>();
  for (const object of objects) {
    if (!isMeasurement(object)) continue;
    const quantity = quantityOf(object, objects, settled);
    const angle = object.measure === "angle" || object.measure === "arc-angle";
    const scalar = object.measure === "ratio" || object.measure === "value";
    const unit = scalar ? "" : angle ? units.angle : units.distance;
    const available = measurementUnits(object.measure);
    readings.set(object.id, {
      places: object.places ?? placesFor(object.measure),
      unit,
      units: available,
      value: (format) => sayQuantity(quantity, format.places, format),
    });
  }
  return readings;
}
