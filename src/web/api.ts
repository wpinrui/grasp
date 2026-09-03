/**
 * `window.api` for the web app.
 *
 * The renderer only ever reaches its host through this one surface, so the web
 * app is the same renderer with the main process swapped for a tab. What a
 * window does and a tab cannot is reworked rather than dropped: a new sketch
 * opens a new tab, Open Recent goes back through the browser's own store, and
 * Print hands the sheets to the browser's dialog.
 *
 * The reads the renderer makes on its first frame are synchronous in the
 * desktop app so the chrome comes up the way it was left. `localStorage` is
 * synchronous too, so those stay synchronous here.
 */

import type { OpenedDocument, SavedDocument, StartingDocument } from "../main/files";
import type { PictureToSave } from "../shared/picture";
import { type PrintJob, pageHtml } from "../shared/print";
import { DEFAULT_SETTINGS, type Settings } from "../shared/settings";
import { askDeletePage, askUnsaved, sayError } from "./dialogs";
import {
  allowed,
  download,
  dropHandle,
  hasPicker,
  heldHandle,
  keepHandle,
  nameOf,
  pathFor,
  upload,
} from "./files";

/** How many sketches the Open Recent list holds, as the desktop app holds them. */
const RECENT_CAP = 10;

const RECENT = "grasp:recent";
const SETTINGS = "grasp:settings";
const CLIPBOARD = "grasp:objects";
const UNTITLED = "grasp:untitled";
/** A sketch one tab is handing to another, waiting for that tab to open. */
const HANDOFF = "grasp:handoff:";

function held<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : (JSON.parse(stored) as T);
  } catch {
    return fallback;
  }
}

function keep(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser with storage turned off still draws sketches; it just forgets.
  }
}

/** Newest first, and one file is in the list once however often it is opened. */
function remember(path: string): void {
  const was = held<string[]>(RECENT, []).filter((one) => one !== path);
  keep(RECENT, [path, ...was].slice(0, RECENT_CAP));
}

function forget(path: string): void {
  keep(
    RECENT,
    held<string[]>(RECENT, []).filter((one) => one !== path),
  );
  void dropHandle(path);
}

/**
 * The Untitled numbers in use across every tab. A tab takes the lowest number
 * nobody holds and gives it back once its sketch has a name of its own, so two
 * blank tabs are never both Untitled 1.
 */
function taken(): number[] {
  return held<number[]>(UNTITLED, []);
}

let mine: number | null = null;

function takeUntitled(): number {
  const inUse = new Set(taken());
  let number = 1;
  while (inUse.has(number)) number += 1;
  mine = number;
  keep(UNTITLED, [...inUse, number]);
  return number;
}

function releaseUntitled(): void {
  if (mine === null) return;
  const number = mine;
  mine = null;
  keep(
    UNTITLED,
    taken().filter((one) => one !== number),
  );
}

// A tab that went without saying so would hold its number for ever.
window.addEventListener("pagehide", releaseUntitled);

/**
 * The sketch `?sketch=` names, fetched and handed over as the document the app
 * opens on. Same origin only: the address bar is not a place anyone should be
 * able to point GRASP at somebody else's server from.
 *
 * It opens read-only in the sense that matters here, which is that it carries
 * no path: Save behaves as Save As, so an embedded copy cannot be written back
 * over the file the page is serving.
 */
async function askedForSketch(): Promise<StartingDocument | null> {
  const asked = new URLSearchParams(window.location.search).get("sketch");
  if (!asked) return null;

  let at: URL;
  try {
    at = new URL(asked, window.location.href);
  } catch {
    return null;
  }
  if (at.origin !== window.location.origin) return null;

  try {
    const got = await fetch(at);
    if (!got.ok) return null;
    const text = await got.text();
    const file = at.pathname.split("/").pop() ?? "";
    return { name: file.replace(/\.grasp$/i, "") || "Sketch", path: null, text, embedded: true };
  } catch {
    return null;
  }
}

/** The types the file pickers offer, in the shape the picker wants them. */
const SKETCH_TYPES = [{ description: "GRASP Sketch", accept: { "application/json": [".grasp"] } }];

const PICTURE_TYPES: FilePickerType[] = [
  { description: "PNG Image", accept: { "image/png": [".png"] } },
  { description: "SVG Image", accept: { "image/svg+xml": [".svg"] } },
];

async function readHandle(handle: FileSystemFileHandle): Promise<OpenedDocument | null> {
  if (!(await allowed(handle, false))) return null;
  const file = await handle.getFile();
  return { path: "", name: nameOf(file.name), text: await file.text() };
}

async function openSketch(): Promise<OpenedDocument | null> {
  if (hasPicker()) {
    let handle: FileSystemFileHandle;
    try {
      [handle] = await window.showOpenFilePicker({ types: SKETCH_TYPES, multiple: false });
    } catch {
      // The picker was cancelled, which is not an error worth reporting.
      return null;
    }
    const read = await readHandle(handle);
    if (!read) return null;
    const path = pathFor(read.name);
    await keepHandle(path, handle);
    remember(path);
    return { ...read, path };
  }
  const file = await upload(".grasp,application/json");
  if (!file) return null;
  // An upload is a copy: there is nothing behind it to write back to.
  return { path: "", name: nameOf(file.name), text: await file.text() };
}

async function writeTo(path: string, text: string): Promise<void> {
  const handle = path ? await heldHandle(path) : undefined;
  if (handle && (await allowed(handle, true))) {
    const writing = await handle.createWritable();
    await writing.write(text);
    await writing.close();
    remember(path);
    return;
  }
  // No handle behind it, so the only Save this browser has is a copy.
  const name = nameOf(path) || "Untitled";
  download(new Blob([text], { type: "application/json" }), `${name}.grasp`);
}

async function saveSketchAs(text: string, suggested: string): Promise<SavedDocument | null> {
  if (hasPicker()) {
    let handle: FileSystemFileHandle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: `${suggested}.grasp`,
        types: SKETCH_TYPES,
      });
    } catch {
      return null;
    }
    const writing = await handle.createWritable();
    await writing.write(text);
    await writing.close();
    const name = nameOf(handle.name);
    const path = pathFor(name);
    await keepHandle(path, handle);
    remember(path);
    return { path, name };
  }
  download(new Blob([text], { type: "application/json" }), `${suggested}.grasp`);
  // The download has no handle behind it, so every later Save pushes another
  // copy under the same name, which is the whole of Save in this browser.
  return { path: `grasp:download/${suggested}.grasp`, name: suggested };
}

/**
 * The bytes of a picture as a blob will take them. A `Uint8Array` can be backed
 * by memory a blob cannot be built on, so the bytes are copied into one it can.
 */
function pngPart(png: Uint8Array): ArrayBuffer {
  return png.slice().buffer as ArrayBuffer;
}

/** Print: the sheets in a frame nobody sees, handed to the browser's dialog. */
function printPage(job: PrintJob): Promise<boolean> {
  return new Promise((done) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const page = frame.contentWindow;
    if (!page) {
      frame.remove();
      done(false);
      return;
    }
    // The paper and the margins are the printer's, so they go in as a page rule
    // rather than as a layout the sheets have to be built around.
    const paper = job.landscape ? `${job.paper} landscape` : job.paper;
    const rule = `<style>@page { size: ${paper}; margin: ${job.margin}px; }</style>`;
    page.document.open();
    page.document.write(pageHtml(job).replace("</head>", `${rule}</head>`));
    page.document.close();
    // The layout wants a frame to settle before the dialog goes up, and the
    // frame stays until the dialog is done with it.
    setTimeout(() => {
      page.focus();
      page.print();
      setTimeout(() => frame.remove(), 1000);
      done(true);
    }, 100);
  });
}

const api = {
  platform: "web" as "electron" | "web",
  versions: {} as Record<string, string>,
  window: {
    // A tab is not a window: there is nothing to minimise or to maximise, and
    // the title bar those three belong to is not drawn on the web.
    minimise: () => {},
    toggleMaximise: () => {},
    close: () => window.close(),
    /**
     * Quit belongs to an app with windows. A tab guards its own work through
     * `beforeunload`, which the renderer sets up itself, so there is nothing to
     * listen for here.
     */
    onQuit: (): (() => void) => () => {},
  },
  file: {
    startingDocument: async (): Promise<StartingDocument> => {
      // A sketch the address asked for, which is how a page embedding GRASP
      // opens it on a figure rather than on a blank sheet.
      const asked = await askedForSketch();
      if (asked) return asked;

      // A sketch another tab handed over, named in the address it opened at.
      const token = new URLSearchParams(window.location.hash.slice(1)).get("open");
      if (token) {
        const handed = held<OpenedDocument | null>(HANDOFF + token, null);
        window.localStorage.removeItem(HANDOFF + token);
        window.history.replaceState(null, "", window.location.pathname);
        if (handed) return { name: handed.name, path: handed.path, text: handed.text };
      }
      return { name: `Untitled ${takeUntitled()}`, path: null, text: null };
    },
    releaseUntitled: async (): Promise<void> => releaseUntitled(),
    newSketch: async (): Promise<void> => {
      window.open(window.location.pathname, "_blank");
    },
    open: openSketch,
    openPath: async (path: string): Promise<OpenedDocument | null> => {
      const handle = await heldHandle(path);
      if (!handle) {
        forget(path);
        return null;
      }
      const read = await readHandle(handle);
      if (!read) {
        forget(path);
        return null;
      }
      remember(path);
      return { ...read, path };
    },
    recent: (): string[] => held<string[]>(RECENT, []),
    clearRecent: async (): Promise<void> => {
      for (const path of held<string[]>(RECENT, [])) void dropHandle(path);
      keep(RECENT, []);
    },
    openWindow: async (file: OpenedDocument): Promise<void> => {
      const token = crypto.randomUUID();
      keep(HANDOFF + token, file);
      window.open(`${window.location.pathname}#open=${token}`, "_blank");
    },
    write: writeTo,
    saveAs: saveSketchAs,
    confirmUnsaved: askUnsaved,
    reportError: sayError,
    quit: async (): Promise<void> => window.close(),
  },
  image: {
    copy: async (png: Uint8Array): Promise<void> => {
      const blob = new Blob([pngPart(png)], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    },
    save: async ({ png, svg, suggested }: PictureToSave): Promise<boolean> => {
      if (!hasPicker()) {
        download(new Blob([pngPart(png)], { type: "image/png" }), `${suggested}.png`);
        return true;
      }
      let handle: FileSystemFileHandle;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: `${suggested}.png`,
          types: PICTURE_TYPES,
        });
      } catch {
        return false;
      }
      // Which of the two was wanted is only settled by the name the picker came
      // back with, which is why both forms were handed over.
      const wantsSvg = handle.name.toLowerCase().endsWith(".svg");
      const written = wantsSvg
        ? new Blob([svg], { type: "image/svg+xml" })
        : new Blob([pngPart(png)], { type: "image/png" });
      const writing = await handle.createWritable();
      await writing.write(written);
      await writing.close();
      return true;
    },
  },
  about: {
    version: (): string => __GRASP_VERSION__,
    openLink: async (url: string): Promise<void> => {
      window.open(url, "_blank", "noopener");
    },
  },
  objects: {
    write: (text: string): void => keep(CLIPBOARD, { text, step: 0 }),
    peek: (): string | null => held<{ text: string } | null>(CLIPBOARD, null)?.text ?? null,
    take: (): { text: string; step: number } | null => {
      const clip = held<{ text: string; step: number } | null>(CLIPBOARD, null);
      if (!clip) return null;
      // Each paste off the same clipboard lands one step further out, so a run
      // of them walks across the sheet rather than stacking in one place.
      keep(CLIPBOARD, { text: clip.text, step: clip.step + 1 });
      return clip;
    },
  },
  print: { page: printPage },
  settings: {
    read: (): Settings => ({ ...DEFAULT_SETTINGS, ...held<Partial<Settings>>(SETTINGS, {}) }),
    write: (part: Partial<Settings>): void =>
      keep(SETTINGS, { ...held<Partial<Settings>>(SETTINGS, {}), ...part }),
  },
  pages: { confirmDelete: askDeletePage },
};

/** Put the surface in place before the renderer's first frame reads it. */
export function installWebApi(): void {
  (window as unknown as { api: typeof api }).api = api;
}
