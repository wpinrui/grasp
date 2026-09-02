import { type MeasureKind, PX_PER_CM } from "../model";
import { DEFAULT_PREFS, type DistanceUnit, type Units } from "../prefs";
export const TURN = Math.PI * 2;

/**
 * The units and precision every reading is written in. They belong to the
 * window rather than to any measurement, so they are held here and set from
 * Preferences: threading them through every reading, and through every guide a
 * tool draws as it drags one out, would be a prop on half the app to say one
 * thing.
 */
export let units: Units = DEFAULT_PREFS.units;

export function writeIn(next: Units): void {
  units = next;
}

/** How many of each unit make a centimetre, since the sheet is measured in them. */
export const PER_CM: Record<DistanceUnit, number> = { cm: 1, mm: 10, in: 1 / 2.54 };

/**
 * A number said the way it is: a rounded one keeps every place it was given, and
 * an exact one keeps none it does not need.
 *
 * Dropping the zeros off 0.610 says it was rounded to two places when it was
 * rounded to three, so a number the places have actually rounded keeps them
 * all. A right angle is not rounded to anything, so it is 90 and not 90.0.
 */
export function said(value: number, places: number): string {
  const fixed = value.toFixed(places);
  if (!fixed.includes(".")) return fixed;
  // Whether anything was lost in the rounding. The slack is for the arithmetic
  // the number came out of: a constructed right angle is ninety to within it.
  const lost = Math.abs(value - Number(fixed));
  if (lost > Math.max(1e-9, Math.abs(value) * 1e-9)) return fixed;
  return fixed.replace(/\.?0+$/, "");
}

/**
 * A length, an angle and an area said the way a measurement says them, for
 * anything that has to read one out before it is an object with a measurement
 * on it: an object being drawn says how long it is as it is dragged out.
 */
export function sayLength(px: number): string {
  const value = (px / PX_PER_CM) * PER_CM[units.distance];
  return `${said(value, units.distancePlaces)} ${units.distance}`;
}

export function sayAngle(degrees: number): string {
  if (units.angle === "radians") {
    return `${said((degrees * Math.PI) / 180, units.anglePlaces)} rad`;
  }
  return `${said(degrees, units.anglePlaces)}°`;
}

export function sayArea(px: number): string {
  const per = PER_CM[units.distance];
  const value = (px / (PX_PER_CM * PX_PER_CM)) * per * per;
  return `${said(value, units.distancePlaces)} ${units.distance}²`;
}

/**
 * How many places a kind of reading is written to when it says nothing of its
 * own: what Preferences asks for. The panel starts from this, so raising the
 * places on one reading raises them from wherever that sketch is set.
 */
export function placesFor(measure: MeasureKind): number {
  if (measure === "angle" || measure === "arc-angle") return units.anglePlaces;
  if (measure === "ratio" || measure === "value") return units.otherPlaces;
  return units.distancePlaces;
}
