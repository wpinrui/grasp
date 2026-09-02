/**
 * Print: the picture the renderer drew, on paper.
 *
 * The renderer owns what the figure looks like, so it hands over one SVG and
 * the paper it is to sit on. Here that becomes a page in a window nobody sees,
 * which is what the printer is given. Doing it in a window of its own rather
 * than printing the sketch window means the chrome, the rails and the bar are
 * never on the paper.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { pageHtml, type PrintJob } from "../shared/print";

export type { PrintJob };

/** How long to wait for the page to lay itself out before giving up on it. */
const READY = 5000;

/** Ask the printer for it, and say whether it went. */
async function print(parent: BrowserWindow, job: PrintJob): Promise<boolean> {
  const path = join(app.getPath("temp"), `grasp-print-${Date.now()}.html`);
  await writeFile(path, pageHtml(job), "utf8");
  const page = new BrowserWindow({
    show: false,
    parent,
    webPreferences: { offscreen: false, sandbox: true },
  });
  try {
    await page.loadFile(path);
    // Give the layout a frame to settle before the page is handed over.
    await new Promise((settle) => setTimeout(settle, 50));
    return await new Promise<boolean>((resolve) => {
      const giveUp = setTimeout(() => resolve(false), READY);
      page.webContents.print(
        {
          silent: false,
          printBackground: true,
          pageSize: job.paper,
          landscape: job.landscape,
          margins: {
            marginType: "custom",
            top: job.margin,
            bottom: job.margin,
            left: job.margin,
            right: job.margin,
          },
        },
        (done) => {
          clearTimeout(giveUp);
          resolve(done);
        },
      );
    });
  } finally {
    // The dialog is closed by now either way, so the window has done its job.
    if (!page.isDestroyed()) page.destroy();
  }
}

export function registerPrintHandlers(): void {
  ipcMain.handle("print:page", async (event, job: PrintJob): Promise<boolean> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    return print(window, job);
  });
}
