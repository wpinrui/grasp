/**
 * What the palette's Text row is set on.
 *
 * Writing on the sheet is not one kind of object. A caption, a reading, a
 * parameter, a calculation, a function, a table and a button are each drawn by
 * their own component, and every one of them carries a face and a size. The row
 * treats them alike, so what counts as writing, and how a mixed pick of it
 * reads, is worked out here rather than in the bar.
 */

import { DEFAULT_CAPTION } from "../components/typeset";
import {
  DEFAULT_LABEL,
  isButton,
  isCaption,
  isFunction,
  isTable,
  isValue,
  type LabelState,
  type SketchButton,
  type SketchCalculation,
  type SketchCaption,
  type SketchFunction,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
  type SketchTable,
  type TextLook,
} from "./model";

/** Everything written on the sheet, which is everything that takes a face and a size. */
export type Written =
  | SketchCaption
  | SketchMeasurement
  | SketchParameter
  | SketchCalculation
  | SketchFunction
  | SketchTable
  | SketchButton;

export function isWritten(object: SketchObject): object is Written {
  return (
    isCaption(object) ||
    isValue(object) ||
    isFunction(object) ||
    isTable(object) ||
    isButton(object)
  );
}

/**
 * How a piece of writing is drawn, rather than what it holds. Only a caption
 * carries all three; the rest fall back to what a caption starts in where they
 * say nothing. Two of them can hold the same thing and still be drawn
 * differently, which is why the bar reads what is on the sheet.
 */
export function lookOf(object: Written): TextLook {
  return {
    font: object.font ?? DEFAULT_CAPTION.font,
    size: object.size ?? DEFAULT_CAPTION.size,
    colour: object.colour ?? DEFAULT_CAPTION.colour,
  };
}

/** The same for a label, which falls back to the way geometry is set in print. */
export function labelLook(label: LabelState, ink: string): TextLook {
  return {
    font: label.font ?? DEFAULT_LABEL.font,
    size: label.size ?? DEFAULT_LABEL.size,
    colour: label.colour ?? ink,
  };
}

/**
 * What the Text row is set on, and what of it whatever it is set on agrees
 * about. A key they do not agree on is null, the way the top row leaves a key
 * unlit, and the size carries the smallest with it, since that is how a
 * disagreement over size is written.
 */
export interface TextStyling {
  font: string | null;
  size: number | null;
  smallest: number;
  colour: string | null;
}

/** What a set of writing agrees on. Nothing to read leaves the row with nothing to say. */
export function textStyling(looks: TextLook[]): TextStyling | null {
  if (looks.length === 0) return null;
  const shared = <T>(read: (look: TextLook) => T): T | null => {
    const first = read(looks[0]);
    return looks.every((look) => read(look) === first) ? first : null;
  };
  return {
    font: shared((look) => look.font),
    size: shared((look) => look.size),
    smallest: Math.min(...looks.map((look) => look.size)),
    colour: shared((look) => look.colour),
  };
}
