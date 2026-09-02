import { plain, type Quantity } from "../expression";
import {
  PX_PER_CM,
  type Settled,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
} from "../model";
import { amountOf } from "./amount";
import { PER_CM, said, units } from "./units";
/**
 * What a measurement comes to, in the units readings are written in and with
 * what it is a quantity of carried alongside. This is the number, so it is what
 * the sheet writes and what a calculation reading the measurement works on.
 */
export function quantityOf(
  measurement: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): Quantity | null {
  const amount = amountOf(measurement, objects, settled);
  if (amount === null) return null;
  const measure = measurement.measure;
  if (measure === "area") {
    const scale = PER_CM[units.distance];
    return { value: (amount / (PX_PER_CM * PX_PER_CM)) * scale * scale, length: 2, angle: 0 };
  }
  if (measure === "angle" || measure === "arc-angle") {
    // The angle between two arms is the small one. Read the long way round, it
    // is the rest of the turn.
    const degrees = measure === "angle" && measurement.reflex ? 360 - amount : amount;
    return {
      value: units.angle === "radians" ? (degrees * Math.PI) / 180 : degrees,
      length: 0,
      angle: 1,
    };
  }
  if (measure === "ratio" || measure === "value") return plain(amount);
  return { value: (amount / PX_PER_CM) * PER_CM[units.distance], length: 1, angle: 0 };
}

/** What a parameter is a quantity of, which is simply what it was given. */
export function quantityOfParameter(parameter: SketchParameter): Quantity {
  if (parameter.unit === "angle") return { value: parameter.value, length: 0, angle: 1 };
  if (parameter.unit === "distance") return { value: parameter.value, length: 1, angle: 0 };
  return plain(parameter.value);
}

/**
 * A quantity in the sheet's own terms: centimetres and degrees, whatever the
 * sketch is currently written in. A table keeps its rows this way, so a sketch
 * switched from centimetres to millimetres reads its old rows in millimetres
 * rather than leaving them saying the old numbers.
 */
export function inSheetTerms(quantity: Quantity): Quantity {
  const perLength = PER_CM[units.distance] ** quantity.length;
  const perAngle = (units.angle === "radians" ? 180 / Math.PI : 1) ** quantity.angle;
  return { ...quantity, value: (quantity.value / perLength) * perAngle };
}

/** And back again, for writing one out. */
export function fromSheetTerms(quantity: Quantity): Quantity {
  const perLength = PER_CM[units.distance] ** quantity.length;
  const perAngle = (units.angle === "radians" ? Math.PI / 180 : 1) ** quantity.angle;
  return { ...quantity, value: quantity.value * perLength * perAngle };
}

/** An exponent written the way it is written in print. */
const RAISED = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function raised(power: number): string {
  const digits = Math.abs(power)
    .toString()
    .split("")
    .map((digit) => RAISED[Number(digit)] ?? digit)
    .join("");
  return power < 0 ? `⁻${digits}` : digits;
}

/**
 * A worked-out number as it is written: to the places its kind is written to,
 * with the unit that what it is a quantity of calls for. A length comes out in
 * the distance unit, an area in that unit squared, an angle in the angle unit,
 * and a plain number with nothing after it. Anything stranger says its unit
 * with the exponent it carries rather than pretending to be one of those.
 */
export function sayQuantity(quantity: Quantity | null, places?: number): string {
  if (!quantity) return "—";
  const { value, length, angle } = quantity;
  const to = (asked: number) => places ?? asked;
  if (length === 0 && angle === 0) return said(value, to(units.otherPlaces));
  if (length === 0 && angle === 1) {
    return `${said(value, to(units.anglePlaces))}${units.angle === "radians" ? " rad" : "°"}`;
  }
  if (angle === 0 && (length === 1 || length === 2)) {
    return `${said(value, to(units.distancePlaces))} ${units.distance}${length === 2 ? "²" : ""}`;
  }
  const parts = [
    length === 0 ? "" : `${units.distance}${length === 1 ? "" : raised(length)}`,
    angle === 0
      ? ""
      : `${units.angle === "radians" ? "rad" : "deg"}${angle === 1 ? "" : raised(angle)}`,
  ].filter(Boolean);
  return `${said(value, to(units.otherPlaces))} ${parts.join(" ")}`;
}
