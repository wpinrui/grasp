/**
 * The File menu's renderer half: which file the window is showing, and the
 * New, Open, Save, Save As, Close and Quit gestures over it.
 *
 * New Sketch opens another window, so a new sketch is visible as one instead of
 * being hidden behind a menu. Open does the same, unless the window it was run
 * from is blank and unsaved, which has nothing to lose and takes the sketch
 * itself. The two Saves work on the window that ran them. Anything that would
 * lose unsaved work asks first, and the same question guards the caption bar's
 * close button through `beforeunload`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Opened, parse, serialise } from "./format";
import type { Prefs } from "./prefs";
import type { Sketch } from "./useSketch";

interface Document {
  /** What the title bar shows, and what the save prompt calls the sketch. */
  name: string;
  /** Where Save writes. Null until the sketch has been saved once. */
  path: string | null;
}

/** `Untitled 1* - GRASP`, with the star only while there is something to save. */
export function titleFor(name: string, dirty: boolean): string {
  return `${name}${dirty ? "*" : ""} - GRASP`;
}

interface Preferences {
  /** Read at save time, so what is written is what the window is on now. */
  read: () => Prefs;
  /** Called with what a file was saved under, or nothing where it says none. */
  onOpen: (prefs: Prefs | undefined) => void;
}

export function useDocument(sketch: Sketch, prefs: Preferences) {
  const { snapshot, load, isDirty, markSaved } = sketch;
  const dirty = sketch.dirty;
  const [openDocument, setOpenDocument] = useState<Document>({ name: "Untitled 1", path: null });
  // The gestures are async, so they read the document from a ref rather than
  // from a closure that a dialog may have outlived.
  const current = useRef(openDocument);

  const setDocument = useCallback((next: Document) => {
    current.current = next;
    setOpenDocument(next);
    // The sketch is no longer an Untitled one, so the next new sketch may take
    // the number this window was using.
    if (next.path) void window.api.file.releaseUntitled();
  }, []);

  /** Whether a page is showing this window inside itself. */
  const [embedded, setEmbedded] = useState(false);
  /**
   * Set while an embed still wants framing. Cleared once it has been, since
   * that is about arriving and says nothing about the view from then on.
   */
  const [toFrame, setToFrame] = useState(false);
  const framed = useCallback(() => setToFrame(false), []);

  // What this window was opened with: a blank sketch, or a file another window
  // handed it, already read and parsed there.
  useEffect(() => {
    void window.api.file.startingDocument().then((start) => {
      if (start.text !== null) {
        const opened = parse(start.text);
        load(opened.pages);
        held.current.onOpen(opened.prefs);
        if (start.embedded) {
          setEmbedded(true);
          setToFrame(true);
        }
      }
      setDocument({ name: start.name, path: start.path });
    });
  }, [load, setDocument]);

  // Held in a ref so a change to either does not rebind every callback below.
  const held = useRef(prefs);
  held.current = prefs;

  const text = useCallback(() => serialise(snapshot(), held.current.read()), [snapshot]);

  // The window title, which is what the taskbar shows. The title bar draws the
  // same thing, since GRASP draws its own chrome.
  useEffect(() => {
    window.document.title = titleFor(openDocument.name, dirty);
  }, [openDocument.name, dirty]);

  /** False when the save dialog was cancelled, so the caller must stop too. */
  const saveAs = useCallback(async (): Promise<boolean> => {
    const saved = await window.api.file.saveAs(text(), current.current.name);
    if (!saved) return false;
    setDocument({ name: saved.name, path: saved.path });
    markSaved();
    return true;
  }, [markSaved, setDocument, text]);

  /**
   * Hand the sketch to the device rather than to a file. Where there is nothing
   * to hand it to, saving is what happens instead, so the button does something
   * either way.
   */
  const share = useCallback(async (): Promise<boolean> => {
    if (await window.api.file.share(text(), current.current.name)) return true;
    return saveAs();
  }, [saveAs, text]);

  const save = useCallback(async (): Promise<boolean> => {
    const { path } = current.current;
    if (!path) return saveAs();
    await window.api.file.write(path, text());
    markSaved();
    return true;
  }, [markSaved, saveAs, text]);

  /** True when it is safe to drop what is on screen. Asks only when dirty. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!isDirty()) return true;
    const answer = await window.api.file.confirmUnsaved(current.current.name);
    if (answer === "cancel") return false;
    return answer === "save" ? save() : true;
  }, [isDirty, save]);

  /** Nothing drawn, no file and nothing unsaved, so a sketch can land here. */
  const isBlank = useCallback(
    () =>
      !current.current.path && !isDirty() && snapshot().every((page) => page.objects.length === 0),
    [isDirty, snapshot],
  );

  /**
   * Open a sketch: through the file dialog, or straight from a path the Open
   * Recent list gave. A recent file that is not there any more says so, and the
   * main process has already taken it off the list.
   */
  const open = useCallback(
    async (path?: string) => {
      const opened = path ? await window.api.file.openPath(path) : await window.api.file.open();
      if (!opened) {
        if (path) {
          await window.api.file.reportError(
            "That sketch could not be opened. It may have been moved or deleted.",
          );
        }
        return;
      }
      let sketchFile: Opened;
      try {
        sketchFile = parse(opened.text);
      } catch (error) {
        await window.api.file.reportError((error as Error).message);
        return;
      }
      // Checked here, so the window it goes to is only ever handed a good sketch.
      if (!isBlank()) {
        await window.api.file.openWindow(opened);
        return;
      }
      load(sketchFile.pages);
      held.current.onOpen(sketchFile.prefs);
      setDocument({ name: opened.name, path: opened.path });
    },
    [isBlank, load, setDocument],
  );

  const newSketch = useCallback(() => void window.api.file.newSketch(), []);

  const close = useCallback(() => window.api.window.close(), []);

  // Quit is driven from the main process, which asks every window in turn: one
  // Cancel anywhere calls the whole thing off, so this one only starts it.
  const quit = useCallback(() => window.api.file.quit(), []);

  /**
   * Set once this window has agreed to a quit, so its own close guard stands
   * down and does not ask a second time. Cleared again if the quit is called
   * off, since what was not saved still is not.
   */
  const agreed = useRef(false);

  useEffect(
    () =>
      window.api.window.onQuit(
        async () => {
          agreed.current = await confirmDiscard();
          return agreed.current;
        },
        () => {
          agreed.current = false;
        },
      ),
    [confirmDiscard],
  );

  // The caption bar's close button and Ctrl+W both land here. Cancelling the
  // unload is the only way to hold the window open while the prompt is up, so
  // the answer closes it a second time, by then with nothing left to lose.
  useEffect(() => {
    function guard(event: BeforeUnloadEvent) {
      if (embedded || agreed.current || !isDirty()) return;
      event.returnValue = false;
      void (async () => {
        if (!(await confirmDiscard())) return;
        markSaved();
        window.api.window.close();
      })();
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [confirmDiscard, embedded, isDirty, markSaved]);

  // Stable, so the key handler bound to it is not rebound every render.
  return useMemo(
    () => ({
      name: openDocument.name,
      title: titleFor(openDocument.name, dirty),
      toFrame,
      framed,
      newSketch,
      open,
      save,
      saveAs,
      share,
      close,
      quit,
    }),
    [openDocument.name, dirty, toFrame, framed, newSketch, open, save, saveAs, share, close, quit],
  );
}
