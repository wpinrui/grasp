/**
 * What every layer of the sheet is drawn from.
 *
 * The layers all want the same handful of things: what is on the sheet, where
 * it all settled, what is picked, and how far the sheet is zoomed. Threading
 * those through a dozen components as props would be a worse file than the one
 * they came out of, so they are put here once and each layer reads what it
 * needs.
 *
 * What goes in is what more than one layer draws from, or what the sheet builds
 * once and the layers must not build again: an index rebuilt per layer is an
 * index that can come to disagree with the one the sheet is using. What one
 * layer alone cares about stays a prop on that layer.
 */

import { createContext, useContext } from "react";
import type {
  Position,
  Rect,
  Settled,
  SketchLine,
  SketchObject,
  SketchPoint,
} from "../../sketch/model";

/** The figure as this render has it, which every layer draws from. */
export interface Sheet {
  /** What is drawn, which is everything not hidden or put away by kind. */
  objects: SketchObject[];
  /**
   * Everything on the page, hidden included. A hidden object still holds the
   * figure together, and lighting one up is the only way to see where it sits
   * before it is shown again.
   */
  everything: SketchObject[];
  settled: Settled;
  selection: string[];
  /** Screen pixels per sheet pixel. */
  scale: number;
  /** Every point on the page by id, which is where a dot is drawn. */
  ends: Map<string, SketchPoint>;
  /**
   * Where a straight object is cut off by the sheet it is drawn on. It runs on
   * past its ends, so this is worked out against the viewport rather than off
   * the object.
   */
  spanOf: (line: SketchLine) => [Position, Position] | null;
  /** The sheet on screen, which anything running off it is cut off by. */
  shown: Rect;
}

const SheetContext = createContext<Sheet | null>(null);

export const SheetProvider = SheetContext.Provider;

/** The figure the layer is being drawn into. */
export function useSheet(): Sheet {
  const sheet = useContext(SheetContext);
  if (!sheet) throw new Error("A canvas layer was drawn outside the sheet it belongs to.");
  return sheet;
}
