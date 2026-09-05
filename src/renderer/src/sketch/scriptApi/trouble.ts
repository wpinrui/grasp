/**
 * What a script is told when it will not run.
 *
 * A script comes here written by a person or, more often, by a language model
 * working from the prompt GRASP handed out, and whoever wrote it sees only what
 * this file says. So a rejection has to carry three things: where in their own
 * source to look, which call it was, and what to do next. Wording thrown from
 * one place stays at that place, in `calls.ts`, beside the test that failed;
 * wording more than one call needs is here, along with everything that finds
 * the call and the line to put in front of it.
 */

import type { SketchObject } from "../model";
import { called, nounFor, quoted } from "./saying";

/**
 * What a script asks for that the sketch has no answer to.
 *
 * The message is written as a lowercase fragment, because `said` puts
 * "Line 4, angleMark: " in front of it. `call` and `nth` are filled in on the
 * way out by `told`, since a call knows what went wrong and does not know what
 * it is called.
 */
export class ScriptError extends Error {
  /** The call it was thrown from. */
  call?: string;
  /** Which call of that name it was in this run, counting from one. */
  nth?: number;
}

/** A handle as `nextId` writes one: a kind, a count, and the token of its run. */
const A_HANDLE = /^[a-z]+-\d+-[a-z0-9]+$/;

/**
 * A handle nothing on the page answers to.
 *
 * One the run itself issued was either taken off by `remove` or belongs to
 * another page, and saying which would be a guess. Anything else was never a
 * handle at all, and is usually a variable that was never set, so it is said
 * back as it was written. The id is not: it is no use to whoever wrote the
 * script, which is the whole reason `saying.ts` exists.
 */
export function missing(id: unknown): string {
  if (typeof id === "string" && A_HANDLE.test(id)) {
    return "that handle is not on this page. Anything taken off with remove takes what was built on it too.";
  }
  return `${quoted(id)} is not a handle from this page. Pass back what a call handed you.`;
}

/**
 * What was passed where a point was wanted. Where the thing has no name of its
 * own, `called` already leads with what kind of thing it is, and naming the
 * kind again would have it say that a segment is a segment.
 */
export function notAPoint(held: SketchObject[], found: SketchObject): string {
  const name = found.label?.name;
  const phrase = name ? `${name} is ${nounFor(found)}` : `${called(held, found.id)} was passed`;
  return `${phrase}, and a point was wanted.`;
}

/**
 * Every call, told its own name and counting how often it has been reached.
 *
 * A call knows what went wrong and does not know what it is called, and the
 * name is the word the script actually wrote, so it is worth more in a message
 * than anything the call itself could say. The count is what stands in for a
 * line number where the engine will not give one: the third `angleMark` is
 * still somewhere to look.
 */
export function told<T extends object>(api: T): T {
  const wrapped = { ...api } as Record<string, unknown>;
  for (const [name, value] of Object.entries(api)) {
    if (typeof value !== "function") continue;
    const call = value as (...args: unknown[]) => unknown;
    let reached = 0;
    wrapped[name] = (...args: unknown[]) => {
      reached += 1;
      const nth = reached;
      try {
        return call(...args);
      } catch (trouble) {
        // Left alone where it is already set, so the call the script wrote is
        // named rather than whatever it reached on the way down.
        if (trouble instanceof ScriptError && trouble.call === undefined) {
          trouble.call = name;
          trouble.nth = nth;
        }
        throw trouble;
      }
    };
  }
  // Every key is copied across first and only the functions are written over,
  // so the shape is the one that came in. Only the types cannot see that.
  return wrapped as T;
}

/**
 * Put above every script. It is one line, and the line numbers a failure is
 * reported at have to be told about it.
 */
export const PREAMBLE = '"use strict";\n';

/** How many lines of the body are the preamble rather than the script. */
const PREAMBLE_LINES = PREAMBLE.split("\n").length - 1;

/**
 * A stack without the message some engines write above it. V8 opens a stack
 * with "Error: what went wrong", which is not a frame, and a message quoting a
 * handle back could otherwise be read as one.
 */
function framesOf(error: Error): string[] {
  const stack = error.stack ?? "";
  const head = `${error.name}: ${error.message}`;
  const lines = stack.split("\n");
  return stack.startsWith(head) ? lines.slice(head.split("\n").length) : lines;
}

/**
 * The line an error says it came from. A body handed to `new Function` has no
 * file of its own, so its frames carry a bare line and column where every other
 * frame carries a path as well. The first such frame is the innermost, which is
 * where the call that failed was written.
 */
function reportedLine(error: Error): number | null {
  const found = framesOf(error)
    .map((frame) => frame.match(/<anonymous>:(\d+):\d+/))
    .find((match) => match !== null);
  return found ? Number(found[1]) : null;
}

/** What `headerLines` worked out, once, since the answer cannot change. */
let header: number | null | undefined;

/**
 * How many lines an engine writes above the body it is handed. V8 writes two,
 * being the parameter list and the brace that opens the body; nothing says
 * another engine must, so it is measured with a probe that throws from the
 * first line of a body of its own rather than assumed. Null once the probe has
 * failed, which is an engine whose stacks this cannot read at all.
 */
function headerLines(): number | null {
  if (header !== undefined) return header;
  header = null;
  try {
    new Function('throw new Error("where");')();
  } catch (trouble) {
    const at = reportedLine(trouble as Error);
    if (at !== null) header = at - 1;
  }
  return header;
}

/** Which line of the script a failure came from, where the engine will say. */
function scriptLine(error: Error): number | null {
  const at = reportedLine(error);
  const above = headerLines();
  if (at === null || above === null) return null;
  const line = at - above - PREAMBLE_LINES;
  return line >= 1 ? line : null;
}

/**
 * Where in the script a failure was, as closely as the run can say. The line is
 * what whoever wrote it will look for; failing that, which call of that name it
 * was still narrows a script down to one place in it.
 */
function whereFrom(error: Error): string | null {
  const ours = error instanceof ScriptError ? error : null;
  const line = scriptLine(error);
  if (line !== null) return ours?.call ? `Line ${line}, ${ours.call}` : `Line ${line}`;
  if (!ours?.call) return null;
  return `${ours.call} call ${ours.nth}`;
}

/** A failed call, said the way whoever wrote the script will look for it. */
export function said(error: Error): string {
  const where = whereFrom(error);
  return where ? `${where}: ${error.message}` : error.message;
}
