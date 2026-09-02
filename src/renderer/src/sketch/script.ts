/**
 * Running a script, from the app's side.
 *
 * The script itself runs in a worker, which is what stands between a script and
 * the app: a worker has no DOM, no `window.api` and no bridge to the main
 * process, so the worst a script can do is fail. Nothing it builds reaches a
 * page until it has finished and the objects have come back, so a run that
 * fails leaves nothing behind and nothing to undo.
 *
 * A script that never finishes hangs its own worker rather than GRASP, so one
 * that runs too long is stopped and said so.
 */

import { DEFAULT_POINT_SIZE, type PointSize, type SketchObject } from "./model";
import type { ScriptResult, ScriptSheet } from "./scriptApi";
import type { ScriptAsk } from "./scriptWorker";

export type { ScriptResult, ScriptSheet } from "./scriptApi";
export { apiNames, unknownCalls } from "./scriptApi";

/** How long a script gets before it is taken to be stuck, in milliseconds. */
const PATIENCE = 5000;

export function runScript(
  source: string,
  page: { objects: SketchObject[]; sheet: ScriptSheet; pointSize?: PointSize },
): Promise<ScriptResult> {
  return new Promise((answer) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./scriptWorker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      answer({
        ok: false,
        errors: [`The script could not be started: ${(error as Error).message}`],
      });
      return;
    }

    let done = false;
    const finish = (result: ScriptResult) => {
      if (done) return;
      done = true;
      clearTimeout(giveUp);
      worker.terminate();
      answer(result);
    };

    const giveUp = setTimeout(() => {
      finish({
        ok: false,
        errors: [
          `The script was still running after ${PATIENCE / 1000} seconds and was stopped. Nothing was drawn.`,
        ],
      });
    }, PATIENCE);

    worker.onmessage = (event: MessageEvent<ScriptResult>) => finish(event.data);
    worker.onerror = (event) =>
      finish({ ok: false, errors: [event.message || "The script failed."] });

    const ask: ScriptAsk = {
      source,
      objects: page.objects,
      sheet: page.sheet,
      pointSize: page.pointSize ?? DEFAULT_POINT_SIZE,
    };
    worker.postMessage(ask);
  });
}
