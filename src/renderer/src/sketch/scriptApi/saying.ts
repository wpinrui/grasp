/**
 * What to call an object when telling a script what went wrong.
 *
 * A script is written by a person or, more often these days, by a language
 * model, and either way what it holds are variables and labels. Never ids:
 * those are counted out as the run goes and are stamped with a token the run
 * picked, so they appear nowhere in the source and match nothing in it. A
 * message that names one has told the reader nothing they can act on.
 *
 * So an object is said by its label where it carries one, since that is a word
 * the script itself wrote, and otherwise by how it was built, which is the
 * other thing a script can recognise as its own work. Never by a letter GRASP
 * would hand out for the sheet: the script did not write that either, and it
 * reads like a variable that is not there.
 *
 * `describe` in `prompt.ts` answers a question next to this one and is
 * deliberately not shared with it. That lists a page which has been settled, so
 * it can say where each point sits. Nothing here has been settled: a derived
 * point is still at the origin until the run returns and the host resolves what
 * came back, so its position would be a lie.
 *
 * `kindOf` in `app/labels.ts` is a third near neighbour, and stays apart for a
 * plainer reason: it feeds a sentence about names clashing, so a point there is
 * "another point", which is nonsense in a message about what a call was handed.
 */

import { isArc, isCircle, isInterior, isLine, isMark, isPoint, type SketchObject } from "../model";

/** A handle the page does not answer to, said back as the script wrote it. */
export function quoted(id: unknown): string {
  return typeof id === "string" ? JSON.stringify(id) : String(id);
}

/** A number said to a reader rather than held, which wants no decimals on it. */
export function round(value: number): string {
  return `${Math.round(value)}`;
}

/** What one kind of thing is called where there is no name and no room to say more. */
export function nounFor(object: SketchObject): string {
  if (isPoint(object)) return "a point";
  if (isLine(object)) return `a ${object.form}`;
  if (isCircle(object)) return "a circle";
  if (isArc(object)) return "an arc";
  if (isInterior(object)) return "a fill";
  if (isMark(object)) return "a marking";
  return `a ${object.kind}`;
}

/**
 * A part of a description: its name where it has one, and what kind of thing it
 * is where it has not. It stops at one part deep on purpose, because a chain of
 * unnamed points would otherwise describe itself all the way back to the first
 * thing drawn and say nothing on the way.
 */
function part(held: SketchObject[], id: string): string {
  const object = held.find((candidate) => candidate.id === id);
  // Said back as it was written rather than described. Nothing that was on the
  // page can go: `remove` takes the dependents with it, so an id here that
  // answers to nothing was never a handle in the first place, and calling it
  // gone would send the reader looking for a removal that never happened.
  if (!object) return quoted(id);
  return object.label?.name ?? nounFor(object);
}

/** How an object was built, which is what a script recognises where a name is missing. */
function built(held: SketchObject[], object: SketchObject): string {
  const said = (id: string) => part(held, id);
  if (isPoint(object)) {
    const from = object.from;
    // Only a plotted point has a place of its own this early. A derived one is
    // still at the origin, so it says how it was made instead.
    if (!from) return `the point at (${round(object.x)}, ${round(object.y)})`;
    if (from.kind === "midpoint") {
      return `the point halfway between ${said(from.of)} and ${said(from.and)}`;
    }
    if (from.kind === "cross")
      return `the point where ${said(from.of)} and ${said(from.and)} cross`;
    if (from.kind === "on") return `the point riding ${said(from.path)}`;
    if (from.kind === "reflect") return `${said(from.of)} mirrored in ${said(from.mirror)}`;
    if (from.kind === "translate") return `${said(from.of)} moved`;
    if (from.kind === "rotate") return `${said(from.of)} turned about ${said(from.centre)}`;
    if (from.kind === "dilate") return `${said(from.of)} scaled about ${said(from.centre)}`;
    return nounFor(object);
  }
  if (isLine(object)) {
    const span = object.span;
    if (span.kind === "through") {
      return `the ${object.form} from ${said(span.ends[0])} to ${said(span.ends[1])}`;
    }
    if (span.kind === "bisector") {
      return `the ${object.form} halving the angle at ${said(span.corner)}`;
    }
    return `the ${object.form} through ${said(span.at)}, ${span.kind} to ${said(span.to)}`;
  }
  if (isCircle(object)) return `the circle about ${said(object.span.centre)}`;
  return nounFor(object);
}

/**
 * What to call the thing a handle points at. Its label, else how it was built,
 * else the handle itself where nothing on the page answers to it, which is
 * worth saying plainly because it is usually a variable that was never set.
 */
export function called(held: SketchObject[], id: string): string {
  const object = held.find((candidate) => candidate.id === id);
  if (!object) return quoted(id);
  return object.label?.name ?? built(held, object);
}
