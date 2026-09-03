import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { OpenedDocument, SavedDocument, SavePrompt, StartingDocument } from "../main/files";
import type { PrintJob } from "../main/printing";
import type { Settings } from "../main/settings";
import type { PictureToSave } from "../shared/picture";

/** The typed surface exposed to the renderer as `window.api`. Keep it minimal. */
const api = {
  /** Which host is running the renderer, since not everything a window does a tab can. */
  platform: "electron" as "electron" | "web",
  versions: process.versions,
  window: {
    minimise: () => ipcRenderer.send("window:minimise"),
    toggleMaximise: () => ipcRenderer.send("window:toggle-maximise"),
    close: () => ipcRenderer.send("window:close"),
    /**
     * A quit asks every window before any of them closes. `answer` says whether
     * this one is ready to go, and `off` is called when the quit was called
     * off, so a window that already agreed goes back to guarding its own work.
     * Returns the way to stop listening.
     */
    onQuit: (answer: () => Promise<boolean>, off: () => void): (() => void) => {
      const ask = (_event: IpcRendererEvent, reply: string) => {
        void answer().then((ready) => ipcRenderer.send(reply, ready));
      };
      const called = () => off();
      ipcRenderer.on("window:may-close", ask);
      ipcRenderer.on("window:quit-off", called);
      return () => {
        ipcRenderer.off("window:may-close", ask);
        ipcRenderer.off("window:quit-off", called);
      };
    },
  },
  file: {
    /** The blank sketch or the file this window was opened with. */
    startingDocument: (): Promise<StartingDocument> => ipcRenderer.invoke("file:starting-document"),
    /** Give the Untitled number back once the sketch has a file name. */
    releaseUntitled: (): Promise<void> => ipcRenderer.invoke("file:release-untitled"),
    /** New Sketch: another window, so a new sketch is visible as one. */
    newSketch: (): Promise<void> => ipcRenderer.invoke("file:new"),
    open: (): Promise<OpenedDocument | null> => ipcRenderer.invoke("file:open"),
    /** Open Recent: a file straight off the list. Null once it is not there. */
    openPath: (path: string): Promise<OpenedDocument | null> =>
      ipcRenderer.invoke("file:open-path", path),
    /** The sketches opened or saved most recently, newest first. */
    recent: (): string[] => ipcRenderer.sendSync("file:recent"),
    clearRecent: (): Promise<void> => ipcRenderer.invoke("file:clear-recent"),
    /** Show an already read and checked sketch in a window of its own. */
    openWindow: (file: OpenedDocument): Promise<void> =>
      ipcRenderer.invoke("file:open-window", file),
    write: (path: string, text: string): Promise<void> =>
      ipcRenderer.invoke("file:write", path, text),
    saveAs: (text: string, suggested: string): Promise<SavedDocument | null> =>
      ipcRenderer.invoke("file:save-as", text, suggested),
    /**
     * Hand the sketch to whatever the device shares with, answering whether it
     * went. A desktop has no share sheet to hand it to: saving is how a file
     * leaves GRASP here, so this always declines and the caller saves instead.
     */
    share: (_text: string, _suggested: string): Promise<boolean> => Promise.resolve(false),
    confirmUnsaved: (name: string): Promise<SavePrompt> =>
      ipcRenderer.invoke("file:confirm-unsaved", name),
    reportError: (message: string): Promise<void> =>
      ipcRenderer.invoke("file:report-error", message),
    quit: (): Promise<void> => ipcRenderer.invoke("file:quit"),
  },
  image: {
    /** Export to the clipboard, which takes the picture as a PNG. */
    copy: (png: Uint8Array): Promise<void> => ipcRenderer.invoke("image:copy", png),
    /**
     * Export to a file. Both forms go over, since which one is wanted is only
     * settled by the file the save dialog comes back with. True once written.
     */
    save: (drawn: PictureToSave): Promise<boolean> => ipcRenderer.invoke("image:save", drawn),
  },
  about: {
    /** The version GRASP was built as, shown in the About box. */
    version: (): string => ipcRenderer.sendSync("app:version"),
    /** Open one of GRASP's own addresses in the browser. */
    openLink: (url: string): Promise<void> => ipcRenderer.invoke("app:open-link", url),
  },
  /** The clipboard objects are cut and copied to, shared by every window. */
  objects: {
    write: (text: string): void => ipcRenderer.send("objects:write", text),
    /** What is held, for deciding whether Paste has anything to do. */
    peek: (): string | null => ipcRenderer.sendSync("objects:peek"),
    /** What is held, and which step off the original this paste is. */
    take: (): { text: string; step: number } | null => ipcRenderer.sendSync("objects:take"),
  },
  /** Print: the picture the renderer drew, on the paper Page Setup says. */
  print: {
    page: (job: PrintJob): Promise<boolean> => ipcRenderer.invoke("print:page", job),
  },
  settings: {
    /** Read on the first frame, so the chrome comes up the way it was left. */
    read: (): Settings => ipcRenderer.sendSync("settings:read"),
    /** Sent on every change; the main process merges them and writes once. */
    write: (part: Partial<Settings>): void => ipcRenderer.send("settings:write", part),
  },
  pages: {
    /** True when the warning was answered with Delete. */
    confirmDelete: (name: string): Promise<boolean> =>
      ipcRenderer.invoke("dialog:confirm-delete-page", name),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
