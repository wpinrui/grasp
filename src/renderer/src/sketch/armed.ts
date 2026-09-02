/**
 * The armed style: what the palette is set to for the tool that is up, and
 * therefore how the next thing that tool draws comes out.
 *
 * The palette says how whatever is selected is drawn. With nothing selected
 * and a drawing tool up there is still something to say, which is how the next
 * object will be drawn, so the bar stays live rather than greying out. It is
 * held per tool and only for as long as that tool is up: switching tools puts
 * the palette back on the defaults, and switching back does not bring the last
 * setting with it.
 *
 * It is not the same thing as Preferences. Preferences says what everything
 * that has not been given a style of its own is drawn in, so changing it
 * restyles the figure. Arming touches nothing already on the sheet.
 */

import type { CaptionAlign, LinePattern, LineWidth, SketchObject } from "./model";

export interface Armed {
  colour?: string;
  weight?: LineWidth;
  pattern?: LinePattern;
  /** The face and size the next caption or measurement is written in. */
  font?: string;
  size?: number;
  /**
   * How the next caption is written and ranged. A measurement takes none of
   * these: it has no box to range across and no runs to mark up.
   */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: CaptionAlign;
}

/** What is armed, and the kinds of object it goes on when they land. */
export interface Arming {
  armed: Armed;
  kinds: string[];
}

/**
 * What each tool puts on the sheet. Only these take the armed style, so the
 * endpoints a straightedge plots along the way stay the colour a point is,
 * rather than following the ink the line was armed with. The Arrow draws
 * nothing, so it arms nothing and the palette is on the selection alone.
 */
export function toolDraws(tool: string, polygonKind: string): string[] {
  if (tool === "point") return ["point"];
  if (tool === "straightedge") return ["line"];
  if (tool === "compass") return ["circle"];
  if (tool === "text") return ["caption"];
  if (tool === "measure") return ["measurement"];
  if (tool === "marker") return ["mark"];
  if (tool !== "polygon") return [];
  if (polygonKind === "interior") return ["interior"];
  if (polygonKind === "edges") return ["line"];
  return ["interior", "line"];
}

/** A stroked object and a mark take a weight; a fill and a point take none. */
const TAKES_WEIGHT = new Set(["line", "circle", "arc", "locus", "mark"]);

/** The same, less the mark, which has no pattern. */
const TAKES_PATTERN = new Set(["line", "circle", "arc", "locus"]);

/** What is written rather than drawn, and so takes a face and a size. */
const TAKES_TEXT = new Set(["caption", "measurement"]);

/**
 * What is written into a box of its own, and so takes the three style keys and
 * the ranging as well. A measurement is a number set down beside what it reads,
 * with no box to range across and no runs to mark up.
 */
const TAKES_MARKS = new Set(["caption"]);

export function takesWeight(kinds: string[]): boolean {
  return kinds.some((kind) => TAKES_WEIGHT.has(kind));
}

export function takesPattern(kinds: string[]): boolean {
  return kinds.some((kind) => TAKES_PATTERN.has(kind));
}

export function takesText(kinds: string[]): boolean {
  return kinds.some((kind) => TAKES_TEXT.has(kind));
}

export function takesMarks(kinds: string[]): boolean {
  return kinds.some((kind) => TAKES_MARKS.has(kind));
}

/** What a stroke is worth when nothing has been said about it. */
export const DEFAULT_WEIGHT: LineWidth = "thin";
export const DEFAULT_PATTERN: LinePattern = "solid";

/**
 * The armed style on whatever has just landed. New objects only: what is
 * already on the sheet is the rest of the palette's job, and a style a demotion
 * or an earlier arming already wrote is left where it is.
 */
export function armedOnto(
  objects: SketchObject[],
  already: Set<string>,
  arming: Arming | null,
): SketchObject[] {
  if (!arming) return objects;
  const { armed, kinds } = arming;
  const wanted = new Set(kinds);
  return objects.map((object) => {
    if (already.has(object.id) || !wanted.has(object.kind)) return object;
    const change: Record<string, unknown> = {};
    if (armed.colour !== undefined && object.colour === undefined) change.colour = armed.colour;
    if (
      armed.weight !== undefined &&
      object.weight === undefined &&
      TAKES_WEIGHT.has(object.kind)
    ) {
      change.weight = armed.weight;
    }
    if (
      armed.pattern !== undefined &&
      object.pattern === undefined &&
      TAKES_PATTERN.has(object.kind)
    ) {
      change.pattern = armed.pattern;
    }
    if (TAKES_TEXT.has(object.kind)) {
      const written = object as { font?: string; size?: number };
      if (armed.font !== undefined && written.font === undefined) change.font = armed.font;
      if (armed.size !== undefined && written.size === undefined) change.size = armed.size;
    }
    return Object.keys(change).length > 0 ? { ...object, ...change } : object;
  });
}
