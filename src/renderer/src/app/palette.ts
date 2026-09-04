/**
 * The palette: what the bar is set on, what it says about it, and what setting
 * it does to the sketch.
 *
 * Two things are being described at once, which is why this is one module. The
 * bar reads what is picked, and it also arms the tool that is up, so a style
 * set with nothing selected says how the next object comes out. Every function
 * that sets anything commits once, so a palette click is one undo step.
 */

import type { ArmedText, Styling } from "../components/Palette";
import { DEFAULT_ALIGN, DEFAULT_CAPTION } from "../components/typeset";
import {
  type Armed,
  DEFAULT_PATTERN,
  DEFAULT_WEIGHT,
  takesMarks,
  takesPattern,
  takesText,
  takesWeight,
  toolDraws,
} from "../sketch/armed";
import {
  isArc,
  isCaption,
  isCircle,
  isLine,
  isLocus,
  isMark,
  type LabelState,
  type LinePattern,
  type LineWidth,
  type SketchCaption,
  type SketchObject,
  type TextLook,
} from "../sketch/model";
import type { Prefs } from "../sketch/prefs";
import {
  inkAgreed,
  isWritten,
  lookOf,
  lookOfLabel,
  marksOfLabels,
  type TextStyling,
  textStyling,
} from "../sketch/text";
import type { Sketch } from "../sketch/useSketch";

/** What a pick shares, or null where it does not share one, over any list. */
function agreed<T>(over: SketchObject[], read: (object: SketchObject) => T | undefined): T | null {
  if (over.length === 0) return null;
  const first = read(over[0]);
  if (first === undefined) return null;
  return over.every((object) => read(object) === first) ? first : null;
}

/** What GRASP draws each kind in until something says otherwise. */
function defaultColour(kind: string, prefs: Prefs): string {
  if (kind === "point") return prefs.colours.point;
  if (kind === "interior") return prefs.colours.fill;
  if (kind === "mark") return prefs.colours.mark;
  if (kind === "caption" || kind === "measurement") return DEFAULT_CAPTION.colour;
  return prefs.colours.path;
}

/** What the top row is set on, and what of it the pick can take at all. */
interface TopRow {
  /** Everything the palette would set, the caption being typed into included. */
  picked: SketchObject[];
  selected: SketchObject[];
  /** What the tool that is up draws, which is what the bar arms. */
  draws: string[];
  armed: Armed;
  prefs: Prefs;
  /** Set when labels are what the bar is on, which is a row of its own. */
  labelsPicked: boolean;
  /** How those labels read, where they agree. */
  labelText: TextStyling | null;
}

/**
 * What the palette's top row is set on: what the pick shares, and what of the
 * three it can take at all. A stroked object takes a weight and a pattern, a
 * mark takes a weight but has no pattern, and a fill or a point takes neither.
 */
function stylingFor({
  picked,
  selected,
  draws,
  armed,
  prefs,
  labelsPicked,
  labelText,
}: TopRow): Styling {
  if (labelsPicked) {
    // A label is written rather than stroked, so the ink is all of the top row
    // it can take.
    return {
      colour: labelText?.colour ?? null,
      weight: null,
      pattern: null,
      canColour: true,
      canWeight: false,
      canPattern: false,
    };
  }
  const stroked = selected.filter(
    (object) => isLine(object) || isCircle(object) || isArc(object) || isLocus(object),
  );
  /** What of the top row the selection itself has anything to say about. */
  const weighs = stroked.length > 0 || selected.some(isMark);
  const patterns = stroked.length > 0;
  // Each control on its own, not the bar as a whole: the selection where it can
  // take that one, and what the tool draws next where it cannot. A point
  // selected under the straightedge says nothing about weight, but the segment
  // about to be drawn does, so the row stays live and arms the tool instead of
  // greying out.
  //
  // The ink is judged over everything it would land on, writing included, so a
  // red segment picked with a black caption lights neither.
  return {
    colour:
      picked.length > 0
        ? inkAgreed(picked)
        : (armed.colour ?? (draws.length > 0 ? defaultColour(draws[0], prefs) : null)),
    weight: weighs
      ? agreed(selected, (object) => object.weight)
      : (armed.weight ?? (takesWeight(draws) ? DEFAULT_WEIGHT : null)),
    pattern: patterns
      ? agreed(selected, (object) => object.pattern)
      : (armed.pattern ?? (takesPattern(draws) ? DEFAULT_PATTERN : null)),
    canColour: picked.length > 0 || draws.length > 0,
    canWeight: weighs || takesWeight(draws),
    canPattern: patterns || takesPattern(draws),
  };
}

export interface PaletteContext {
  sketch: Sketch;
  objects: SketchObject[];
  /** The objects selected, in the order they were picked. */
  selected: SketchObject[];
  selection: string[];
  /** The caption being typed into, which the bar is set on while it is open. */
  editing: string | null;
  /** The labels picked on the sheet. */
  labelPick: string[];
  prefs: Prefs;
  /** What the palette has armed the tool that is up with. */
  armed: Armed;
  setArmed: (change: (was: Armed) => Armed) => void;
  activeTool: string;
  /** Which variant each tool is armed with, for what the tool draws. */
  variants: Record<string, string>;
}

/**
 * What the palette shows and what it sets. Called while the window renders,
 * since it also tells the sketch what the tool that is up is armed with.
 */
export function paletteState(context: PaletteContext) {
  const {
    sketch,
    objects,
    selected,
    selection,
    editing,
    labelPick,
    prefs,
    armed,
    setArmed,
    activeTool,
    variants,
  } = context;

  /**
   * The caption the palette works on: the one open, or the one picked on the
   * sheet when nothing is open. Nothing to work on greys the palette out.
   */
  const captions = objects.filter(isCaption);
  const chosenCaption =
    captions.find((caption) => caption.id === editing) ??
    (selection.length === 1 ? (captions.find((one) => one.id === selection[0]) ?? null) : null);

  /**
   * The labels the palette is set on: the ones picked on the sheet. A label
   * that has since been hidden or whose object has gone is no longer there to
   * set. Anything selected wins, and so does a caption open to type into, since
   * the bar is then set on what the caret is in.
   */
  const chosenLabels =
    selection.length === 0 && editing === null
      ? objects.filter((object) => labelPick.includes(object.id) && object.label?.shown === true)
      : [];
  const labelsPicked = chosenLabels.length > 0;

  /**
   * Everything the palette would set: what is selected, and the caption being
   * typed into, which takes the bar along with it.
   */
  const written = editing ? objects.find((object) => object.id === editing) : undefined;
  const picked = written && !selection.includes(written.id) ? [...selected, written] : selected;

  /**
   * The writing among it: everything picked that carries a face and a size,
   * whatever kind of object it is. A reading, a parameter, a calculation, a
   * function, a table and a button are all set the way a caption is, so the row
   * reaches them all.
   */
  const writing = picked.filter(isWritten);

  /**
   * How whatever the palette is set on reads now, and what of it that writing
   * agrees about. Null when there is nothing to set.
   */
  const chosenText: TextStyling | null = labelsPicked
    ? textStyling(
        chosenLabels.map((object) => lookOfLabel(object.label ?? {}, prefs.colours.label)),
      )
    : textStyling(writing.map(lookOf));

  /** The three style keys over the picked labels, or null when none is picked. */
  const labelMarks = labelsPicked
    ? marksOfLabels(chosenLabels.map((object) => object.label ?? {}))
    : null;

  /**
   * What the tool that is up draws, which is what the palette arms. The Arrow
   * draws nothing, so under it the bar is on the selection alone.
   */
  const draws = toolDraws(activeTool, variants.polygon);
  const styling = stylingFor({
    picked,
    selected,
    draws,
    armed,
    prefs,
    labelsPicked,
    labelText: chosenText,
  });

  /** How every picked label is set, as one undo step. */
  function styleLabel(change: Partial<LabelState>) {
    const setting = new Set(chosenLabels.map((object) => object.id));
    if (setting.size === 0) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        setting.has(object.id) ? { ...object, label: { ...object.label, ...change } } : object,
      ),
    });
  }

  /**
   * What the text row is on with nothing selected: the face, the size and the
   * ink the tool that writes has been armed with, or what a new one comes out
   * in where it has not been touched.
   */
  const armedWriting: TextStyling | null = takesText(draws)
    ? textStyling([
        {
          font: armed.font ?? prefs.text.font,
          size: armed.size ?? prefs.text.size,
          colour: armed.colour ?? DEFAULT_CAPTION.colour,
        },
      ])
    : null;

  /**
   * The rest of how the next caption comes out: the three style keys and the
   * ranging. Only a caption carries them, so the tool that writes readings arms
   * the face and the size and no more.
   */
  const armedMarks: ArmedText | null = takesMarks(draws)
    ? {
        bold: armed.bold ?? false,
        italic: armed.italic ?? false,
        underline: armed.underline ?? false,
        align: armed.align ?? DEFAULT_ALIGN,
      }
    : null;

  /**
   * How a caption the Text tool draws comes out: what Preferences says a new one
   * is set in, with whatever the palette has armed over the top. Worked out here
   * rather than where the caption is made, since the arming lives with the bar.
   */
  const captionLook = {
    font: armed.font ?? prefs.text.font,
    size: armed.size ?? prefs.text.size,
    colour: armed.colour ?? DEFAULT_CAPTION.colour,
    align: armed.align ?? DEFAULT_ALIGN,
  };

  /**
   * How every selected object is drawn, as one undo step. A caption being
   * written into counts as selected, since the palette is set on it too.
   */
  function styleSelection(change: { colour?: string; weight?: LineWidth; pattern?: LinePattern }) {
    // A picked label takes the ink and nothing else, and takes it on its own:
    // it is not what the tool is about to draw.
    if (labelsPicked) {
      if (change.colour !== undefined) styleLabel({ colour: change.colour });
      return;
    }
    // Setting the bar also arms the tool, so restyling what was just drawn says
    // how the next one comes out as well.
    if (draws.length > 0) setArmed((was) => ({ ...was, ...change }));
    const wanted = new Set(selection);
    if (editing) wanted.add(editing);
    if (wanted.size === 0) return;
    const before = sketch.read();
    // A key goes only on what can take it, since the row is live for the tool
    // as well as for the selection: a weight set with a point selected and the
    // straightedge up arms the tool and leaves the point where it is.
    let touched = false;
    const after = before.objects.map((object) => {
      if (!wanted.has(object.id)) return object;
      const fits: typeof change = {};
      if (change.colour !== undefined) fits.colour = change.colour;
      if (change.weight !== undefined && takesWeight([object.kind])) fits.weight = change.weight;
      if (change.pattern !== undefined && takesPattern([object.kind]))
        fits.pattern = change.pattern;
      if (Object.keys(fits).length === 0) return object;
      touched = true;
      return { ...object, ...fits };
    });
    // Nothing selected could take it, so there is nothing to undo either.
    if (!touched) return;
    sketch.commit({ ...before, objects: after });
  }

  /**
   * The palette changing how writing is set, as one undo step. Face, size and
   * ink reach every selected object that carries them, whatever kind it is,
   * since they are all set the same way; the rest of the palette belongs to a
   * caption, which is the only writing with runs to range and notation to type
   * into.
   */
  function styleWriting(change: Partial<SketchCaption>) {
    if (labelsPicked) {
      const { font, size, colour } = change;
      styleLabel({
        ...(font !== undefined ? { font } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(colour !== undefined ? { colour } : {}),
      });
      return;
    }
    // The same as the top row: setting the face or the size also arms the tool
    // that writes, so the next caption comes out set that way.
    if (takesText(draws)) {
      const arming: Armed = {};
      if (change.font !== undefined) arming.font = change.font;
      if (change.size !== undefined) arming.size = change.size;
      if (change.colour !== undefined) arming.colour = change.colour;
      if (change.align !== undefined && takesMarks(draws)) arming.align = change.align;
      if (Object.keys(arming).length > 0) setArmed((was) => ({ ...was, ...arming }));
    }
    const look: Partial<TextLook> = {};
    if (change.font !== undefined) look.font = change.font;
    if (change.size !== undefined) look.size = change.size;
    if (change.colour !== undefined) look.colour = change.colour;
    // The face, the size and the ink go to every piece of writing that is
    // picked; the rest of the change is a caption's alone.
    const spread = Object.keys(look).length > 0 ? new Set(writing.map((one) => one.id)) : null;
    if (!chosenCaption && !spread?.size) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (chosenCaption && object.id === chosenCaption.id && isCaption(object)) {
          return { ...object, ...change };
        }
        if (spread?.has(object.id) && isWritten(object)) return { ...object, ...look };
        return object;
      }),
    });
  }

  // Told to the sketch rather than read there, since every way an object lands
  // goes through it and each one should come out the way the bar says.
  sketch.armStyle(draws.length > 0 ? { armed, kinds: draws } : null);

  return {
    chosenCaption,
    labelsPicked,
    chosenText,
    labelMarks,
    styling,
    styleLabel,
    armedWriting,
    armedMarks,
    captionLook,
    styleSelection,
    styleWriting,
  };
}

/** The palette, as the window holds it. */
export type Palette = ReturnType<typeof paletteState>;
