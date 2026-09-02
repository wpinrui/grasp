/**
 * The worker a script runs in.
 *
 * It is handed the page's objects and the size of the sheet, evaluates the
 * script against them, and posts back the objects the page should hold. It has
 * no DOM, no `window.api` and no bridge to the app, so a script that goes
 * looking for a way out of the API finds a worker global with nothing on it.
 */

import type { PointSize, SketchObject } from "./model";
import { evaluate, type ScriptResult, type ScriptSheet } from "./scriptApi";

export interface ScriptAsk {
  source: string;
  objects: SketchObject[];
  sheet: ScriptSheet;
  pointSize: PointSize;
}

self.onmessage = (event: MessageEvent<ScriptAsk>) => {
  const { source, objects, sheet, pointSize } = event.data;
  let answer: ScriptResult;
  try {
    answer = evaluate(source, { objects, sheet, pointSize });
  } catch (error) {
    answer = { ok: false, errors: [(error as Error).message] };
  }
  self.postMessage(answer);
};
