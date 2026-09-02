import { apiNames } from "./calls";
/** The API written out for the prompt, and the check that it stays complete. */

/** One call, as the prompt lists it: how it is written and what it does. */
export interface ApiEntry {
  /** The call with its parameters, and what it hands back after an arrow. */
  call: string;
  /** One line, in the terms a figure is described in. */
  says: string;
}

/**
 * The whole API, written out for the prompt. A handle is the string a call
 * hands back; every call that takes an object takes a handle.
 *
 * `apiNames` reads the API itself rather than this list, and `missingFromApiReference`
 * says where the two have parted company, so a call cannot be added without
 * being described.
 */
export const API_REFERENCE: { heading: string; entries: ApiEntry[] }[] = [
  {
    heading: "Points",
    entries: [
      { call: "point(x, y) -> handle", says: "A point where you put it, in sheet units." },
      { call: "midpoint(a, b) -> handle", says: "The point halfway between two points." },
      {
        call: "intersect(pathOne, pathOther, pick = 0) -> handle",
        says: "Where two paths cross. Two paths that cross twice give the first crossing at pick 0 and the second at pick 1.",
      },
      {
        call: "pointOn(path, at) -> handle",
        says: "A point riding a path, `at` being the fraction of the way along it, 0 to 1.",
      },
      {
        call: "translate(of, dx, dy) -> handle",
        says: "The point moved by that much in x and y.",
      },
      {
        call: "rotate(of, centre, degrees) -> handle",
        says: "The point turned about a centre. Positive turns clockwise on screen, y running down.",
      },
      {
        call: "dilate(of, centre, ratio) -> handle",
        says: "The point scaled towards or away from a centre.",
      },
      {
        call: "reflect(of, mirror) -> handle",
        says: "The point mirrored in a straight object.",
      },
    ],
  },
  {
    heading: "Straight objects",
    entries: [
      { call: "segment(a, b) -> handle", says: "The stretch between two points." },
      { call: "ray(a, b) -> handle", says: "From the first point out through the second." },
      { call: "line(a, b) -> handle", says: "Through both points and out either way." },
      {
        call: "parallel(at, to) -> handle",
        says: "A line through a point, parallel to a straight object.",
      },
      {
        call: "perpendicular(at, to) -> handle",
        says: "A line through a point, at right angles to a straight object.",
      },
      {
        call: "bisector(corner, a, b) -> handle",
        says: "The line that halves the angle at a corner between two arms.",
      },
    ],
  },
  {
    heading: "Circles and arcs",
    entries: [
      {
        call: "circle(centre, edge) -> handle",
        says: "A circle about a centre, through a point on its rim.",
      },
      {
        call: "circleRadius(centre, along) -> handle",
        says: "A circle about a centre, as wide as a straight object already drawn.",
      },
      {
        call: "arcOn(circle, from, to) -> handle",
        says: "The stretch of a circle between two points on it.",
      },
      {
        call: "arcAt(centre, from, to) -> handle",
        says: "An arc about a centre, from one point to another.",
      },
      { call: "arcThrough(from, via, to) -> handle", says: "The arc through three points." },
    ],
  },
  {
    heading: "Fills",
    entries: [
      {
        call: "polygon(...corners) -> handle",
        says: "The inside of a ring of three corners or more.",
      },
      { call: "fill(circle) -> handle", says: "The inside of a circle." },
      { call: "sector(arc) -> handle", says: "The wedge of an arc, out to its centre." },
      { call: "segmentOf(arc) -> handle", says: "The piece an arc's chord cuts off." },
    ],
  },
  {
    heading: "Markings",
    entries: [
      {
        call: "tick(path, at = 0.5, strokes = 1) -> handle",
        says: "Equal-side ticks on a path. Sides that match carry the same number of strokes.",
      },
      {
        call: "parallelMark(path, at = 0.5, strokes = 1) -> handle",
        says: "Parallel arrows on a path.",
      },
      {
        call: "angleMark(corner, a, b, strokes = 1, reflex = false) -> handle",
        says: "Arcs on the angle at a corner between two arms. Both arms want a segment already drawn from the corner.",
      },
    ],
  },
  {
    heading: "Writing",
    entries: [
      {
        call: "caption(x, y, text, width = 160) -> handle",
        says: "A line of text on the sheet, where you put it.",
      },
      {
        call: "measure(kind, [handles], x, y) -> handle",
        says: 'A number taken off the figure, written where you put it. `kind` is "length" off a segment, "area" off a fill or a circle, "angle" off three points given as arm, corner, arm, "radius" off a circle.',
      },
    ],
  },
  {
    heading: "Names and how things are drawn",
    entries: [
      { call: "label(handle, name) -> handle", says: "Name something and show the name." },
      { call: "show(handle) -> handle", says: "Show its name." },
      { call: "hide(handle) -> handle", says: "Stop showing its name." },
      {
        call: "style(handle, { colour, weight, pattern })",
        says: 'How it is drawn. Colours are "--color-ink-black", "-grey", "-red", "-orange", "-green", "-blue", "-purple", "-magenta". Weight is "hairline", "thin", "medium" or "thick". Pattern is "solid", "dashed" or "dotted".',
      },
      {
        call: "size(point, size)",
        says: 'How big a point is drawn: "dot", "small", "medium" or "large".',
      },
    ],
  },
  {
    heading: "Reading the page",
    entries: [
      { call: "all() -> handle[]", says: "Everything on this page, oldest first." },
      {
        call: "kindOf(handle) -> string",
        says: 'What it is: "point", "line", "circle", "arc", "interior", "mark", "caption", "measurement".',
      },
      { call: "at(point) -> { x, y }", says: "Where a point sits." },
      { call: "nameOf(handle) -> string", says: "What it is called." },
      { call: "byLabel(name) -> handle", says: "The thing with that name, or null." },
      { call: "remove(handle)", says: "Take it off the page, and everything built on it with it." },
      { call: "sheet", says: "Not a call: an object carrying `width`, `height` and `pixelRatio`." },
    ],
  },
];

/** The names the reference describes, one per entry. */
function describedNames(): string[] {
  return API_REFERENCE.flatMap((group) => group.entries).map(
    (entry) => entry.call.split(/[( ]/)[0],
  );
}

/**
 * Where the API and its reference have parted company: a call the reference
 * does not describe, or an entry describing a call the API no longer has.
 * Either way a script is being prompted with something untrue.
 */
export function missingFromApiReference(): string[] {
  const described = new Set(describedNames());
  const offered = new Set(apiNames());
  return [
    ...apiNames().filter((name) => !described.has(name)),
    ...describedNames().filter((name) => !offered.has(name)),
  ];
}
