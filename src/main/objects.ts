/**
 * The clipboard objects are cut and copied to. It belongs to the app rather
 * than to any window, so a figure copied in one sketch pastes into another.
 *
 * It holds the objects as the text the renderer serialised, since the shape of
 * a sketch lives there. Nothing here reads it. It is not written to disk: a
 * clipboard is for now, the way the system one is.
 */

import { ipcMain } from "electron";

let held: string | null = null;

/** How many times what is held has been pasted, so each paste steps further. */
let pasted = 0;

export function registerObjectHandlers(): void {
  ipcMain.on("objects:write", (_event, text: string) => {
    held = text;
    pasted = 0;
  });

  /** What is held, for deciding whether Paste has anything to do. */
  ipcMain.on("objects:peek", (event) => {
    event.returnValue = held;
  });

  /** What is held, and which step off the original this paste is. */
  ipcMain.on("objects:take", (event) => {
    if (held === null) {
      event.returnValue = null;
      return;
    }
    pasted += 1;
    event.returnValue = { text: held, step: pasted };
  });
}
