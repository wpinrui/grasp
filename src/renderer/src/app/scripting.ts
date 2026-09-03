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
export interface ScriptContext {
  sketch: Sketch;
  /** Which page a run is to draw on, and what was typed for it. */
  scriptTarget: string;
  request: string;
  script: string;
  setScriptRunning: (running: boolean) => void;
  setScriptErrors: (errors: string[]) => void;
  setScriptWay: (way: null) => void;
  /** How big the sheet is on screen, which is what a script sizes itself against. */
  viewport: { width: number; height: number };
  pointSize: PointSize;
}

export function scriptActions(context: ScriptContext) {
  const {
    sketch,
    scriptTarget,
    request,
    script,
    setScriptRunning,
    setScriptErrors,
    setScriptWay,
    viewport,
    pointSize,
  } = context;
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
    const editing = scriptTarget !== NEW_PAGE;
    const page = sketch.pages.find((one) => one.id === scriptTarget);
    return buildPrompt({
      request: request,
      sheet: scriptSheet(),
      target:
        editing && page
          ? { kind: "edit", page: page.name, objects: sketch.objectsOn(page.id) }
          : { kind: "new" },
    });
  }

  async function runTheScript() {
    setScriptRunning(true);
    setScriptErrors([]);
    const wanted = sketch.pages.find((one) => one.id === scriptTarget);
    // The page a script works on is the page it is run from, so GRASP goes
    // there first and the objects it hands back are committed where they land.
    if (wanted) sketch.selectPage(wanted.id);
    else sketch.addPage();
    const before = sketch.read();
    const result = await runScript(script, {
      objects: before.objects,
      sheet: scriptSheet(),
      pointSize: pointSize,
    });
    setScriptRunning(false);
    if (!result.ok) {
      setScriptErrors(result.errors);
      return;
    }
    sketch.commit({ objects: result.objects, selection: [] });
    setScriptErrors([]);
    setScriptWay(null);
  }

  return { promptForRequest, runTheScript };
}
