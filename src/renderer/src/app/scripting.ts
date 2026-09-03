/**
 * Asking a model for a script, and running what comes back.
 *
 * The prompt is built from the window as it is now, so the model is told how
 * big the sheet is and what is already on the page it is to edit. A run lands
 * everything in one commit, which makes a whole script one undo step, and
 * nothing reaches a page unless the whole script comes good.
 */

import { NEW_PAGE } from "../components/ScriptDialog";
import type { PointSize } from "../sketch/model";
import { buildPrompt } from "../sketch/prompt";
import { runScript } from "../sketch/script";
import type { Sketch } from "../sketch/useSketch";
import type { Dialogs } from "./useDialogs";

export interface ScriptContext {
  sketch: Sketch;
  dialogs: Dialogs;
  /** How big the sheet is on screen, which is what a script sizes itself against. */
  viewport: { width: number; height: number };
  pointSize: PointSize;
}

export function scriptActions({ sketch, dialogs, viewport, pointSize }: ScriptContext) {
  /**
   * Scripting. The prompt is built from the window as it is now, and a run
   * lands what the worker hands back in one commit, so a whole script is one
   * undo step. Nothing reaches a page unless the whole script comes good.
   */
  const scriptSheet = () => ({
    width: viewport.width / sketch.view.scale,
    height: viewport.height / sketch.view.scale,
    pixelRatio: window.devicePixelRatio,
  });

  function promptForRequest(): string {
    const editing = dialogs.scriptTarget !== NEW_PAGE;
    const page = sketch.pages.find((one) => one.id === dialogs.scriptTarget);
    return buildPrompt({
      request: dialogs.request,
      sheet: scriptSheet(),
      target:
        editing && page
          ? { kind: "edit", page: page.name, objects: sketch.objectsOn(page.id) }
          : { kind: "new" },
    });
  }

  async function runTheScript() {
    dialogs.setScriptRunning(true);
    dialogs.setScriptErrors([]);
    const wanted = sketch.pages.find((one) => one.id === dialogs.scriptTarget);
    // The page a script works on is the page it is run from, so GRASP goes
    // there first and the objects it hands back are committed where they land.
    if (wanted) sketch.selectPage(wanted.id);
    else sketch.addPage();
    const before = sketch.read();
    const result = await runScript(dialogs.script, {
      objects: before.objects,
      sheet: scriptSheet(),
      pointSize: pointSize,
    });
    dialogs.setScriptRunning(false);
    if (!result.ok) {
      dialogs.setScriptErrors(result.errors);
      return;
    }
    sketch.commit({ objects: result.objects, selection: [] });
    dialogs.setScriptErrors([]);
    dialogs.setScriptWay(null);
  }

  return { promptForRequest, runTheScript };
}
