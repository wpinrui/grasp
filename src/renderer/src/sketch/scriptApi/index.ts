/**
 * The API a script is run with, and the evaluation of it: `calls` builds the
 * page, `sandbox` runs the script over it, `reference` describes it for the
 * prompt. Each says how it works; this is only the way in.
 */

export type { ScriptApi, ScriptSheet } from "./calls";
export { apiNames } from "./calls";
export type { ApiEntry } from "./reference";
export { API_REFERENCE, apiReferenceDrift } from "./reference";
export type { ScriptResult } from "./sandbox";
export { evaluate, unknownCalls } from "./sandbox";
