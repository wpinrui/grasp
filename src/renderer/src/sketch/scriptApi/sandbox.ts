import { DEFAULT_POINT_SIZE, type PointSize, resolve, type SketchObject } from "../model";
import { apiFor, apiNames, type ScriptSheet } from "./calls";
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
  const known = new Set([...provided, ...ALLOWED_GLOBALS, ...SHADOWED, ...boundNames(bare)]);
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
    script = new Function(...keys, ...SHADOWED, `"use strict";\n${source}\n`) as typeof script;
  } catch (error) {
    return { ok: false, errors: [`That is not valid JavaScript: ${(error as Error).message}`] };
  }

  try {
    script(...keys.map((key) => api[key as keyof typeof api]));
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }

  try {
    return { ok: true, objects: resolve(held) };
  } catch (error) {
    return { ok: false, errors: [`The figure could not be settled: ${(error as Error).message}`] };
  }
}
