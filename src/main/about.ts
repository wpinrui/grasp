/**
 * What the About box needs from outside the renderer: the version GRASP was
 * built as, and the one way a link is allowed to leave the app.
 *
 * The renderer cannot open a link itself. A plain anchor would navigate the
 * window GRASP is drawn in, so the link goes to the browser from here instead,
 * and only ever to the addresses named below.
 */

import { app, ipcMain, shell } from "electron";

/** Where GRASP lives. Nothing else opens, whatever the renderer asks for. */
const ALLOWED = ["https://github.com/wpinrui/grasp", "https://github.com/wpinrui"];

export function registerAboutHandlers(): void {
  ipcMain.on("app:version", (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle("app:open-link", async (_event, url: string) => {
    if (!ALLOWED.includes(url)) return;
    await shell.openExternal(url);
  });
}
