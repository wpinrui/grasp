/**
 * The augmented prompt: what GRASP hands the user to paste into a language
 * model, built from what they asked for and what the window is doing now.
 */

import {
  isArc,
  isCaption,
  isCircle,
  isInterior,
  isLine,
  isMark,
  isMeasurement,
  isPoint,
  namesFor,
  type SketchObject,
} from "./model";
import { API_REFERENCE, type ScriptSheet } from "./scriptApi";

/** Where a script is to work: a page GRASP will add, or one already there. */
export type ScriptTarget =
  | { kind: "new" }
  | { kind: "edit"; page: string; objects: SketchObject[] };

export interface PromptContext {
  request: string;
  target: ScriptTarget;
  sheet: ScriptSheet;
}

function round(value: number): string {
  return `${Math.round(value)}`;
}

/** One object, said the way the page would say it. */
function describe(object: SketchObject, names: Map<string, string>): string {
  const name = names.get(object.id);
  const called = name ? `${name}: ` : "";
  if (isPoint(object)) return `${called}point at (${round(object.x)}, ${round(object.y)})`;
  if (isLine(object)) {
    const span = object.span;
    if (span.kind === "through") {
      const ends = span.ends.map((id) => names.get(id) ?? "?").join(" to ");
      return `${called}${object.form} ${ends}`;
    }
    if (span.kind === "bisector") return `${called}${object.form}, bisecting an angle`;
    return `${called}${object.form}, ${span.kind} at ${names.get(span.at) ?? "?"}`;
  }
  if (isCircle(object)) {
    const centre = names.get(object.span.centre) ?? "?";
    return `${called}circle about ${centre}`;
  }
  if (isArc(object)) return `${called}arc`;
  if (isInterior(object)) return `${called}fill`;
  if (isMark(object)) return `${called}${object.form} marking`;
  if (isCaption(object)) return `${called}caption`;
  if (isMeasurement(object)) return `${called}${object.measure} measurement`;
  return `${called}${object.kind}`;
}

/** The page a script is editing, written out so the edit can be planned. */
function describePage(objects: SketchObject[]): string {
  if (objects.length === 0) return "The page is empty.";
  const names = namesFor(objects);
  return objects.map((object) => `- ${describe(object, names)}`).join("\n");
}

function apiText(): string {
  return API_REFERENCE.map((group) => {
    const lines = group.entries.map((entry) => `- \`${entry.call}\`\n  ${entry.says}`);
    return `### ${group.heading}\n\n${lines.join("\n")}`;
  }).join("\n\n");
}

/** What GRASP puts on the clipboard. */
export function buildPrompt({ request, target, sheet }: PromptContext): string {
  const editing = target.kind === "edit";
  return `You are writing a script for GRASP, a geometry drawing app, to draw a figure a teacher has asked for.

## What was asked for

${request.trim()}

## Ask before you answer

If anything about the figure is unclear, ask the user about it and wait for an answer. Do not write any script until you are sure what is wanted. When you are sure, answer with the script and nothing else: no explanation, no commentary, no code fence.

## The script

The script is JavaScript. Only the calls listed below are in scope; there is no console, no DOM and no network. Every call that makes something hands back a handle, and every call that takes an object takes a handle. \`const\`, loops, functions and \`Math\` all work.

A call GRASP does not have stops the whole script before anything is drawn, so use only what is listed.

## Where it will be drawn

${
  editing
    ? `This script edits ${target.page}, which already holds:\n\n${describePage(target.objects)}\n\nFind what you need with \`byLabel\`, rather than assuming a handle. You may add to it, restyle it and remove from it.`
    : "This script draws on a new, empty page."
}

The sheet is ${round(sheet.width)} by ${round(sheet.height)} in sheet units at the size it is being looked at, on a display at a pixel ratio of ${sheet.pixelRatio}. One centimetre is 37.8 sheet units. y runs down the screen, so a positive y is lower.

Put the figure around the origin, (0, 0), which is the middle of what the user is looking at, and make it big enough to fill most of the sheet. Read the size off \`sheet.width\` and \`sheet.height\` rather than writing those numbers into the script, so the same script draws right in a window of another size.

## The calls

${apiText()}

## Drawing well

- Name the points a proof talks about, with \`label\`, and leave the rest unnamed.
- Build what is constructed rather than working out where it lands: use \`intersect\`, \`midpoint\`, \`perpendicular\` and the rest, so the figure holds together when anything is dragged.
- A point or line that is only there to build something else, the foot of a perpendicular or the third point an arc was drawn through, wants \`hide\` once it has done its work. The figure still holds together and nothing stray is left drawn.
- A right angle wants an \`angleMark\`; equal sides want \`tick\` with the same number of strokes.
- Say what the figure shows in a \`caption\` clear of the drawing.
- Keep it to what was asked for.
`;
}
