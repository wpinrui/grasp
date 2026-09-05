/**
 * The File menu's main-process half: the OS dialogs and the disk reads and
 * writes. The renderer owns the sketch and decides when to call these.
 *
 * A sketch is one JSON file with the `.grasp` extension; the shape lives in
 * the renderer, which serialises and parses it. Everything here moves text.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from "electron";
import type { PictureToSave } from "../shared/picture";
import { keep, settings } from "./settings";

const EXTENSION = "grasp";

const FILTERS = [{ name: "GRASP Sketch", extensions: [EXTENSION] }];

/** What a picture can be written as. PNG first, so it is what a name defaults to. */
const PICTURE_FILTERS = [
  { name: "PNG Image", extensions: ["png"] },
  { name: "SVG Image", extensions: ["svg"] },
];

/** How many sketches the Open Recent list holds. */
const RECENT_CAP = 10;

/** Newest first, and one file is in the list once however often it is opened. */
function remember(path: string): void {
  keep({
    recent: [path, ...settings().recent.filter((held) => held !== path)].slice(0, RECENT_CAP),
  });
}

/** A file that is not there any more comes off the list. */
function forget(path: string): void {
  keep({ recent: settings().recent.filter((held) => held !== path) });
}

/** What a saved sketch is called, which is its file name without the suffix. */
function documentName(path: string): string {
  return basename(path, `.${EXTENSION}`);
}

export interface OpenedDocument {
  path: string;
  name: string;
  text: string;
}

export interface SavedDocument {
  path: string;
  name: string;
}

/** The answer to the unsaved-changes prompt. */
export type SavePrompt = "save" | "discard" | "cancel";

/** What a window shows when it opens: a file it was given, or a blank sketch. */
export interface StartingDocument {
  name: string;
  path: string | null;
  text: string | null;
  /**
   * This window is a page's embedded copy of GRASP rather than somebody's own.
   * It opens framed on the figure, since an embed has nobody to scroll it to
   * the sheet's origin and back, and it lets the page be left without asking
   * about unsaved work, since the work is the page's rather than the reader's.
   */
  embedded?: boolean;
}

interface Host {
  newWindow: (file?: OpenedDocument) => void;
  startingDocument: (webContentsId: number) => StartingDocument;
  /** The window's sketch has a file name now, so its Untitled number is free. */
  releaseUntitled: (webContentsId: number) => void;
}

/** Numbered so two windows being asked at once can never be confused. */
let asked = 0;

/** Whether a quit is already working its way through the windows. */
let quitting = false;

/**
 * Whether this window is ready to be closed. The renderer puts the unsaved
 * changes prompt up itself, so the answer comes back over IPC rather than out
 * of a dialog here.
 */
function mayClose(window: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    asked += 1;
    const reply = `window:may-close:${asked}`;
    // A window that goes while it is being asked has nothing left to say.
    const gone = () => {
      ipcMain.removeAllListeners(reply);
      resolve(true);
    };
    ipcMain.once(reply, (_event, ready: boolean) => {
      window.webContents.off("destroyed", gone);
      resolve(ready === true);
    });
    window.webContents.once("destroyed", gone);
    // Asked one at a time, so the window the prompt belongs to is the one in
    // front while it is up.
    window.focus();
    window.webContents.send("window:may-close", reply);
  });
}

/**
 * Quit ends GRASP whatever is open, so every window is asked before any of
 * them closes. One Cancel calls the whole thing off and leaves every window
 * where it was, including the ones that had already agreed.
 */
async function quit(): Promise<void> {
  if (quitting) return;
  quitting = true;
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    if (await mayClose(window)) continue;
    quitting = false;
    for (const other of BrowserWindow.getAllWindows()) {
      if (!other.isDestroyed()) other.webContents.send("window:quit-off");
    }
    return;
  }
  app.quit();
}

/** Everything the File menu asks the OS for: opening, saving and the recent list. */
function registerDocumentHandlers(host: Host): void {
  ipcMain.handle("file:starting-document", (event) => host.startingDocument(event.sender.id));

  ipcMain.handle("file:release-untitled", (event) => host.releaseUntitled(event.sender.id));

  ipcMain.handle("file:new", () => host.newWindow());

  // The sketch is already read and checked by the window that ran Open, so the
  // new window is only ever handed a file it can show.
  ipcMain.handle("file:open-window", (_event, file: OpenedDocument) => host.newWindow(file));

  ipcMain.handle("file:open", async (event): Promise<OpenedDocument | null> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: "Open Sketch",
      properties: ["openFile"],
      filters: FILTERS,
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    remember(path);
    return { path, name: documentName(path), text: await readFile(path, "utf8") };
  });

  // Open Recent: read straight from a path the list gave. A file that is not
  // there any more comes off the list, and the window says so.
  ipcMain.handle("file:open-path", async (_event, path: string): Promise<OpenedDocument | null> => {
    try {
      const text = await readFile(path, "utf8");
      remember(path);
      return { path, name: documentName(path), text };
    } catch {
      forget(path);
      return null;
    }
  });

  ipcMain.on("file:recent", (event) => {
    event.returnValue = settings().recent;
  });

  ipcMain.handle("file:clear-recent", () => keep({ recent: [] }));

  ipcMain.handle("file:write", async (_event, path: string, text: string) => {
    await writeFile(path, text, "utf8");
  });

  ipcMain.handle(
    "file:save-as",
    async (event, text: string, suggested: string): Promise<SavedDocument | null> => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return null;
      const result = await dialog.showSaveDialog(window, {
        title: "Save Sketch As",
        defaultPath: `${suggested}.${EXTENSION}`,
        filters: FILTERS,
      });
      const path = result.filePath;
      if (result.canceled || !path) return null;
      await writeFile(path, text, "utf8");
      remember(path);
      return { path, name: documentName(path) };
    },
  );
}

/** The message boxes GRASP puts up, which are the OS's rather than the window's. */
function registerPromptHandlers(): void {
  ipcMain.handle("file:confirm-unsaved", async (event, name: string): Promise<SavePrompt> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return "cancel";
    const { response } = await dialog.showMessageBox(window, {
      type: "warning",
      title: "GRASP",
      message: `Save changes to ${name}?`,
      detail: "Your changes will be lost if you do not save them.",
      buttons: ["Save", "Don't Save", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 0) return "save";
    return response === 1 ? "discard" : "cancel";
  });

  ipcMain.handle("file:report-error", async (event, message: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    await dialog.showMessageBox(window, {
      type: "error",
      title: "GRASP",
      message,
      buttons: ["OK"],
      noLink: true,
    });
  });

  // Not the File menu, but this is where the OS dialogs are put up.
  ipcMain.handle("dialog:confirm-delete-page", async (event, name: string): Promise<boolean> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    const { response } = await dialog.showMessageBox(window, {
      type: "warning",
      title: "GRASP",
      message: `This will delete ${name}.`,
      detail: "It cannot be undone.",
      buttons: ["Delete", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    return response === 0;
  });
}

/**
 * Export: the sheet as a picture. The renderer draws it and hands over both
 * forms, since which one is wanted is only settled by the file that comes back.
 */
function registerPictureHandlers(): void {
  ipcMain.handle("image:copy", (_event, png: Uint8Array) => {
    clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(png)));
  });

  ipcMain.handle("image:save", async (event, drawn: PictureToSave): Promise<boolean> => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    const result = await dialog.showSaveDialog(window, {
      title: "Export Image to File",
      defaultPath: `${drawn.suggested}.png`,
      filters: PICTURE_FILTERS,
    });
    const path = result.filePath;
    if (result.canceled || !path) return false;
    if (path.toLowerCase().endsWith(".svg")) await writeFile(path, drawn.svg, "utf8");
    else await writeFile(path, Buffer.from(drawn.png));
    return true;
  });
}

export function registerFileHandlers(host: Host): void {
  registerDocumentHandlers(host);
  registerPromptHandlers();
  registerPictureHandlers();
  ipcMain.handle("file:quit", quit);
}
