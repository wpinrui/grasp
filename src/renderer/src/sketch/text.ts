/**
 * What the palette's Text row is set on.
 *
 * Writing on the sheet is not one kind of object. A caption, a reading, a
 * parameter, a calculation, a function and a table are each drawn by their own
 * component, and every one of them carries a face and a size. The row
 * treats them alike, so what counts as writing, and how a mixed pick of it
 * reads, is worked out here rather than in the bar.
 */

import { DEFAULT_CAPTION } from "../components/typeset";
import {
  DEFAULT_LABEL,
  isWriting,
  type LabelState,
  type SketchObject,
  type SketchWriting,
  type TextLook,
} from "./model";

/**
 * How a piece of writing is drawn, rather than what it holds. Only a caption
 * carries all three; the rest fall back to what a caption starts in where they
 * say nothing. Two of them can hold the same thing and still be drawn
 * differently, which is why the bar reads what is on the sheet.
 */
export function lookOf(object: SketchWriting): TextLook {
  return {
    font: object.font ?? DEFAULT_CAPTION.font,
    size: object.size ?? DEFAULT_CAPTION.size,
    colour: object.colour ?? DEFAULT_CAPTION.colour,
  };
}

/** The same for a label, which falls back to the way geometry is set in print. */
export function lookOfLabel(label: LabelState, ink: string): TextLook {
  return {
    font: label.font ?? DEFAULT_LABEL.font,
    size: label.size ?? DEFAULT_LABEL.size,
    colour: label.colour ?? ink,
  };
}

/** How a label is marked up, which is the whole of it: a label holds no runs. */
/** A mark a run of writing can carry, which the palette sets and reads. */
export type Mark = "bold" | "italic" | "underline";

export type LabelMarks = Record<Mark, boolean>;

/**
 * The three style keys over the picked labels. A key they do not all carry
 * reads off, the way an unshared key on the top row does, so pressing it once
 * turns it on for every one of them.
 */
export function marksOfLabels(labels: LabelState[]): LabelMarks {
  return {
    bold: labels.every((label) => (label.bold ?? DEFAULT_LABEL.bold) === true),
    italic: labels.every((label) => (label.italic ?? DEFAULT_LABEL.italic) === true),
    underline: labels.every((label) => (label.underline ?? DEFAULT_LABEL.underline) === true),
  };
}

/**
 * How a piece of writing is set where it is drawn. Every box that draws one is
 * set from here, so what the bar reads back and what the sheet shows cannot
 * drift apart.
 */
export function drawnAs(object: SketchWriting): {
  fontFamily: string;
  fontSize: string;
  color: string;
} {
  const look = lookOf(object);
  return {
    fontFamily: `"${look.font}", serif`,
    fontSize: `${look.size}pt`,
    color: `var(${look.colour})`,
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

/**
 * The ink a pick reads at, or null where it does not agree on one. Writing that
 * holds no ink is read at the ink it is drawn in, since that is what the sheet
 * shows and what the bar has to agree with; anything else that holds none says
 * nothing about the ink at all, so a pick holding one of those lights nothing.
 */
export function inkAgreed(objects: SketchObject[]): string | null {
  if (objects.length === 0) return null;
  const inkOf = (object: SketchObject) =>
    isWriting(object) ? lookOf(object).colour : object.colour;
  const first = inkOf(objects[0]);
  if (first === undefined) return null;
  return objects.every((object) => inkOf(object) === first) ? first : null;
}

/** What the Font box says where the writing it is set on does not agree on one. */
export const VARIOUS = "(various)";

/** What the Font and Size boxes read, and the face to set the Font box in. */
export interface TextBoxes {
  font: string;
  size: string;
  /**
   * The face the Font box is a specimen of, or null where there is none to be
   * a specimen of, since a disagreement is not a face.
   */
  face: string | null;
}

/**
 * What the two boxes say. The caret wins while a caption is open, since a run
 * inside a caption can say something else and the caret is where the next
 * keystroke lands; then what the writing agrees on. A box whose key is not
 * agreed says so rather than picking one of them and stating it as fact: the
 * face says so in words, and the size says the smallest with a plus after it,
 * so a 12 and a 16 read 12+. Each box is judged on its own, so an agreed size
 * survives a mixed face.
 */
export function textBoxes(caret: Partial<TextLook>, styling: TextStyling | null): TextBoxes {
  const face = caret.font ?? styling?.font ?? null;
  const point = caret.size ?? styling?.size ?? null;
  return {
    font: face ?? (styling ? VARIOUS : DEFAULT_CAPTION.font),
    size: `${point ?? (styling ? `${styling.smallest}+` : DEFAULT_CAPTION.size)}`,
    face,
  };
}
