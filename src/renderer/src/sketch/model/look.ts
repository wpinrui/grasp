import type { CSSProperties } from "react";
import type { LinePattern, LineWidth } from "./figures";
import type { SketchObject } from "./values";

/** What each weight is worth on screen, in pixels. Strokes do not scale. */
const WEIGHTS: Record<LineWidth, number> = {
  hairline: 0.75,
  thin: 1.5,
  medium: 2.5,
  thick: 4,
};

/** How each pattern dashes, in pixels. Solid says nothing at all. */
const DASHES: Record<LinePattern, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "0.1 3.5",
};

/** How heavy a fill sits, so what is drawn on top of it stays readable. */
const FILL_ALPHA = 0.25;

/**
 * What a stroked object says about how it is drawn: its colour, how heavy it
 * is and how it dashes. What it does not say is left to the stylesheet, which
 * is where every object's default lives.
 */
export function strokeLook(object: SketchObject): CSSProperties {
  const look: CSSProperties = {};
  if (object.colour) look.stroke = `var(${object.colour})`;
  if (object.weight) look.strokeWidth = WEIGHTS[object.weight];
  if (object.pattern) {
    look.strokeDasharray = DASHES[object.pattern];
    if (object.pattern === "dotted") look.strokeLinecap = "round";
  }
  return look;
}

/** The same for a fill: a point's dot, a polygon's interior, a locus's wash. */
export function fillLook(object: SketchObject, wash: boolean): CSSProperties {
  if (!object.colour) return {};
  return wash
    ? { fill: `var(${object.colour})`, fillOpacity: FILL_ALPHA }
    : { fill: `var(${object.colour})`, fillOpacity: 1 };
}
