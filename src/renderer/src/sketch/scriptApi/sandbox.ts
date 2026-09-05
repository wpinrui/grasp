import { DEFAULT_POINT_SIZE, type PointSize, resolve, type SketchObject } from "../model";
import { apiFor, apiNames, ScriptError, type ScriptSheet } from "./calls";
/**
 * What a script may reach, and the run itself.
 *
 * This runs inside a worker, which is what keeps a script away from the app:
 * see `script.ts`. It is written to need nothing but its arguments so that it
 * can.
 */

/** What a run comes to: the page's objects after it, or what went wrong. */
export type ScriptResult = { ok: true; objects: SketchObject[] } | { ok: false; errors: string[] };

/**
 * Names shadowed with nothing before a script runs. A worker has no DOM and no
 * bridge to the app, so what is left worth taking away is the network: a script
 * that wanted to could otherwise post the figure somewhere. This makes the
 * obvious calls absent. It does not seal the realm, and cannot: `new Function`
 * runs in the worker's own realm and a constructor chain still reaches out of
 * it. The worker is the boundary; this is tidiness on top of it.
 */
const SHADOWED = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "navigator",
  "postMessage",
  "self",
  "globalThis",
  "Function",
];

/**
 * The words of the language itself, which are not calls however much they look
 * like one. `if (a)`, `for (;;)` and `return (x)` all read as a name followed by
 * a bracket, so without this a script that branches or loops is turned away for
 * calling something GRASP does not have. Every reserved word is listed rather
 * than the handful that are usually written with a bracket after them, because
 * the ones that are not are only ever missing from this list by oversight.
 */
const KEYWORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/** Every name a script may call that this API does not provide itself. */
const ALLOWED_GLOBALS = new Set([
  "Array",
  "Boolean",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Set",
  "String",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
]);

/**
 * Put above every script. It is one line, and the line numbers a failure is
 * reported at have to be told about it.
 */
const PREAMBLE = '"use strict";\n';

/** How many lines of the body are the preamble rather than the script. */
const PREAMBLE_LINES = PREAMBLE.split("\n").length - 1;

/**
 * The line an error says it came from, read out of its stack. A body handed to
 * `new Function` has no file of its own, so its frames carry a bare line and
 * column where every other frame carries a path as well. The first such frame
 * is the innermost, which is where the call that failed was written.
 */
function reportedLine(error: Error): number | null {
  const found = (error.stack ?? "")
    .split("\n")
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
 * first line of a body of its own rather than assumed.
 */
function headerLines(): number | null {
  if (header !== undefined) return header;
  header = null;
  try {
    new Function('throw new Error("where");')();
  } catch (error) {
    const at = reportedLine(error as Error);
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
  const call = error instanceof ScriptError ? error.call : undefined;
  const line = scriptLine(error);
  if (line !== null) return call ? `Line ${line}, ${call}` : `Line ${line}`;
  if (!call) return null;
  return `${call} call ${(error as ScriptError).nth}`;
}

/** A failed call, said the way whoever wrote the script will look for it. */
function said(error: Error): string {
  const where = whereFrom(error);
  return where ? `${where}: ${error.message}` : error.message;
}

/** The source with its comments and its string literals blanked out. */
function bareSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, '""')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/** Every name the script binds itself: its variables, its functions, its parameters. */
function boundNames(bare: string): Set<string> {
  const bound = new Set<string>();
  const add = (name: string | undefined) => {
    if (name) bound.add(name);
  };
  for (const [, name] of bare.matchAll(
    /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    add(name);
  }
  // Destructured bindings and parameter lists, taken as a whole and split up.
  for (const [, inside] of bare.matchAll(/\b(?:const|let|var)\s*[[{]([^\]}]*)[\]}]/g)) {
    for (const part of inside.split(",")) add(part.trim().split(/[:=\s]/)[0]);
  }
  for (const [, inside] of bare.matchAll(/(?:function\s*[\w$]*\s*|\)\s*=>|)\(([^()]*)\)\s*=>/g)) {
    for (const part of inside.split(",")) add(part.trim().split(/[:=\s]/)[0]);
  }
  for (const [, name] of bare.matchAll(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) add(name);
  return bound;
}

/**
 * Every call the script makes that nothing provides. A language model will
 * invent calls, so they are all found at once and reported together rather than
 * one run at a time.
 */
export function unknownCalls(source: string, provided: Iterable<string>): string[] {
  const bare = bareSource(source);
  const known = new Set([
    ...provided,
    ...ALLOWED_GLOBALS,
    ...SHADOWED,
    ...KEYWORDS,
    ...boundNames(bare),
  ]);
  const missing = new Set<string>();
  for (const [, name] of bare.matchAll(/(?:^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!known.has(name)) missing.add(name);
  }
  return [...missing].sort();
}

/**
 * Run a script over a page. `objects` is what is on that page already, empty
 * for a new one. Nothing is committed here: the host lands what comes back,
 * once, so the whole script is one undo step.
 */
export function evaluate(
  source: string,
  page: { objects: SketchObject[]; sheet: ScriptSheet; pointSize?: PointSize },
): ScriptResult {
  const names = apiNames();

  const missing = unknownCalls(source, names);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: missing.map((name) => `GRASP has no ${name}(). Nothing was drawn.`),
    };
  }

  const held = [...page.objects];
  const api = apiFor(held, page.sheet, page.pointSize ?? DEFAULT_POINT_SIZE);
  const keys = Object.keys(api);

  let script: (...values: unknown[]) => void;
  try {
    // The API is in scope, and the obvious ways out of it are shadowed away.
    script = new Function(...keys, ...SHADOWED, `${PREAMBLE}${source}\n`) as typeof script;
  } catch (error) {
    return { ok: false, errors: [`That is not valid JavaScript: ${(error as Error).message}`] };
  }

  try {
    script(...keys.map((key) => api[key as keyof typeof api]));
  } catch (error) {
    return { ok: false, errors: [said(error as Error)] };
  }

  try {
    return { ok: true, objects: resolve(held) };
  } catch (error) {
    return { ok: false, errors: [`The figure could not be settled: ${(error as Error).message}`] };
  }
}
