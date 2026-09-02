/**
 * The API a script is run with, and the evaluation of it.
 *
 * None of this touches the app. Every call builds a plain object into a list
 * held here and hands back its id, so the page a script is working on is
 * untouched until the script returns and the host lands what came back. A call
 * that fails throws, the list is dropped, and there is nothing to put back.
 *
 * This runs inside a worker, which is what keeps a script away from the app:
 * see `script.ts`. It is written to need nothing but its arguments so that it
 * can.
 */

export type { ScriptApi, ScriptSheet } from "./calls";
export { apiNames } from "./calls";
export type { ApiEntry } from "./reference";
export { API_REFERENCE, missingFromApiReference } from "./reference";
export type { ScriptResult } from "./sandbox";
export { evaluate, unknownCalls } from "./sandbox";
