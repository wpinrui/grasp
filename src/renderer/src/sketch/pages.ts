import { useCallback, useRef, useState } from "react";
import {
  asDuplicated,
  DEFAULT_VIEW,
  EMPTY_SKETCH,
  type SketchObject,
  type SketchState,
  type View,
} from "./model";

/**
 * The sketch's pages: the row of them, which one is up, and what the File menu
 * saves and loads.
 *
 * Every page carries its own history and its own view, both kept here, so undo
 * on one page never reaches into another and a page is where you left it when
 * you come back. The last-saved pages are held here too: the sketch is dirty
 * while any of them differs.
 */

export interface Page {
  id: string;
  name: string;
  state: SketchState;
  view: View;
}

/**
 * A page as Document Options wants it: an existing one to keep, or one to add,
 * blank or as a copy of another. Nothing is done to the sketch until the dialog
 * is answered, so this is what it holds in the meantime.
 */
export interface WantedPage {
  /** The page it stands for. Absent on one being added. */
  id?: string;
  name: string;
  /** The page it is a copy of, for one being added as a duplicate. */
  from?: string;
}

/** What a page looks like in a file: no selection, no view, no id. */
export interface PageContent {
  name: string;
  objects: SketchObject[];
}

/**
 * Ids are counted out and stamped with a token this run picked, the way object
 * ids are in `model/create.ts` and for the same reason: the counter is module state,
 * so anything that reloads the module starts it again. Without the token a page
 * made after a hot reload takes an id a page already on screen is using, and
 * two pages sharing an id are one page as far as everything keyed by it goes.
 */
const RUN = Math.random().toString(36).slice(2, 8);

let created = 0;

/**
 * A page made off another one, named after it: `Page 1 (copy)`, and numbered on
 * where a page of that name is already there.
 */
function pageNamed(name: string, said: string, taken: string[]): string {
  const wanted = `${name} (${said})`;
  if (!taken.includes(wanted)) return wanted;
  let number = 2;
  while (taken.includes(`${wanted} ${number}`)) number += 1;
  return `${wanted} ${number}`;
}

/** Named for where it lands, counting on past any name already in use. */
function nextPageName(pages: Page[]): string {
  const taken = new Set(pages.map((page) => page.name));
  let number = pages.length + 1;
  while (taken.has(`Page ${number}`)) number += 1;
  return `Page ${number}`;
}

/** Whether anything worth saving differs. A view is not worth saving. */
function changed(now: Page[], was: Page[]): boolean {
  if (now.length !== was.length) return true;
  return now.some(
    (page, index) =>
      page.id !== was[index].id ||
      page.name !== was[index].name ||
      page.state.objects !== was[index].state.objects,
  );
}

function newPage(name: string, state: SketchState = EMPTY_SKETCH): Page {
  created += 1;
  return { id: `page-${created}-${RUN}`, name, state, view: DEFAULT_VIEW };
}

/** The row with one page renamed. An empty name is refused, so a page always has one. */
export function renamed(pages: Page[], id: string, name: string): Page[] | null {
  const wanted = name.trim();
  if (!wanted) return null;
  return pages.map((page) => (page.id === id ? { ...page, name: wanted } : page));
}

/**
 * The row with one page taken out and put back in at `to`, which is what a drag
 * on the page bar comes to. Null when the move would change nothing.
 */
export function moved(pages: Page[], id: string, to: number): Page[] | null {
  const from = pages.findIndex((page) => page.id === id);
  if (from === -1 || from === to || to < 0 || to >= pages.length) return null;
  const next = pages.filter((page) => page.id !== id);
  next.splice(to, 0, pages[from]);
  return next;
}

/**
 * The row Document Options was left holding, in its order: existing pages
 * renamed and reordered, missing ones gone, and new ones made blank or copied.
 * One pass, since the dialog answers all of it at once.
 */
export function reshaped(pages: Page[], wanted: WantedPage[]): Page[] {
  const held = new Map(pages.map((page) => [page.id, page]));
  return wanted.map((one) => {
    const found = one.id ? held.get(one.id) : undefined;
    if (found) return found.name === one.name ? found : { ...found, name: one.name };
    const copy = one.from ? held.get(one.from) : undefined;
    const made = newPage(one.name);
    if (!copy) return made;
    return {
      ...made,
      state: { objects: asDuplicated(copy.state.objects), selection: [] },
      view: copy.view,
    };
  });
}

/** The row with a page made off `from` landing straight after it, named after it. */
export function landedAfter(
  pages: Page[],
  from: Page,
  made: { said: string; objects: SketchObject[] },
): { pages: Page[]; page: Page } {
  const page = {
    ...newPage(
      pageNamed(
        from.name,
        made.said,
        pages.map((one) => one.name),
      ),
      { objects: made.objects, selection: [] },
    ),
    view: from.view,
  };
  const next = [...pages];
  next.splice(pages.indexOf(from) + 1, 0, page);
  return { pages: next, page };
}

/**
 * The page store. It holds what every page is, which is up, and the histories
 * they are undone through; `useSketch` builds the editing on top of it.
 */
export function usePages() {
  const [pages, setPages] = useState<Page[]>(() => [newPage("Page 1")]);
  const [activeId, setActiveId] = useState(() => pages[0].id);
  const current = useRef(pages);
  const active = useRef(activeId);
  // Keyed by page, so switching pages parks a history rather than losing it.
  const past = useRef(new Map<string, SketchState[]>());
  const future = useRef(new Map<string, SketchState[]>());
  const saved = useRef<Page[]>(pages);
  // The same snapshot again, as state, so that saving redraws the title bar.
  const [savedPages, setSavedPages] = useState<Page[]>(pages);

  const replacePages = useCallback((next: Page[]) => {
    current.current = next;
    setPages(next);
  }, []);

  const activePage = useCallback(
    () => current.current.find((page) => page.id === active.current) ?? current.current[0],
    [],
  );

  /** The state the page that is up is on. */
  const read = useCallback(() => activePage().state, [activePage]);

  /** Put a state on the page that is up, leaving every other page alone. */
  const write = useCallback(
    (state: SketchState) => {
      replacePages(
        current.current.map((page) => (page.id === active.current ? { ...page, state } : page)),
      );
    },
    [replacePages],
  );

  /**
   * How much history the page that is up has either side of it. The stacks
   * themselves are refs, and stay refs: what a control needs is not the states
   * in them but whether there are any, so that is what is kept as state and
   * Undo and Redo grey out the moment they have nothing to do.
   *
   * The same numbers again is the same object, so a push that does not change
   * whether there is anything to undo does not redraw anything either.
   */
  const [depth, setDepth] = useState({ back: 0, forward: 0 });
  const noteDepth = useCallback(() => {
    const id = active.current;
    const back = past.current.get(id)?.length ?? 0;
    const forward = future.current.get(id)?.length ?? 0;
    setDepth((was) => (was.back === back && was.forward === forward ? was : { back, forward }));
  }, []);

  /** Park a state to undo back to, and drop whatever was there to redo. */
  const record = useCallback(
    (before: SketchState) => {
      const id = active.current;
      past.current.set(id, [...(past.current.get(id) ?? []), before]);
      future.current.set(id, []);
      noteDepth();
    },
    [noteDepth],
  );

  /**
   * Step the page that is up one back, or one forward. `now` is what it is on,
   * which goes onto the other stack; the state to put back comes out, or null
   * when that stack is empty.
   */
  const stepBack = useCallback(
    (now: SketchState): SketchState | null => {
      const id = active.current;
      const history = [...(past.current.get(id) ?? [])];
      const previous = history.pop();
      if (!previous) return null;
      past.current.set(id, history);
      future.current.set(id, [...(future.current.get(id) ?? []), now]);
      noteDepth();
      return previous;
    },
    [noteDepth],
  );

  const stepForward = useCallback(
    (now: SketchState): SketchState | null => {
      const id = active.current;
      const undone = [...(future.current.get(id) ?? [])];
      const next = undone.pop();
      if (!next) return null;
      future.current.set(id, undone);
      past.current.set(id, [...(past.current.get(id) ?? []), now]);
      noteDepth();
      return next;
    },
    [noteDepth],
  );

  /** Put every parked state of the page that is up through the same change. */
  const reworkHistory = useCallback((rework: (state: SketchState) => SketchState) => {
    const id = active.current;
    past.current.set(id, (past.current.get(id) ?? []).map(rework));
    future.current.set(id, (future.current.get(id) ?? []).map(rework));
  }, []);

  const setView = useCallback(
    (view: View) => {
      replacePages(
        current.current.map((page) => (page.id === active.current ? { ...page, view } : page)),
      );
    },
    [replacePages],
  );

  /** Show a page. Everything that changes which one is up goes through here. */
  const goTo = useCallback(
    (id: string) => {
      active.current = id;
      noteDepth();
      setActiveId(id);
    },
    [noteDepth],
  );

  const selectPage = useCallback(
    (id: string) => {
      if (current.current.some((page) => page.id === id)) goTo(id);
    },
    [goTo],
  );

  /** A new empty page after the last one, which the sketch switches to. */
  const addPage = useCallback(() => {
    const page = newPage(nextPageName(current.current));
    replacePages([...current.current, page]);
    goTo(page.id);
  }, [goTo, replacePages]);

  const renamePage = useCallback(
    (id: string, name: string) => {
      const next = renamed(current.current, id, name);
      if (next) replacePages(next);
    },
    [replacePages],
  );

  /** Drag on the page bar. */
  const movePage = useCallback(
    (id: string, to: number) => {
      const next = moved(current.current, id, to);
      if (next) replacePages(next);
    },
    [replacePages],
  );

  /** What Document Options was answered with, applied in one pass, histories and all. */
  const reshapePages = useCallback(
    (wanted: WantedPage[]) => {
      if (wanted.length === 0) return;
      const next = reshaped(current.current, wanted);
      const staying = new Set(next.map((page) => page.id));
      for (const page of current.current) {
        if (staying.has(page.id)) continue;
        past.current.delete(page.id);
        future.current.delete(page.id);
      }
      // Once, after the lot: what it reads is the page that is up, which the
      // loop does not touch.
      noteDepth();
      replacePages(next);
      // The page being shown may have been one of the ones removed.
      if (!staying.has(active.current)) goTo(next[0].id);
    },
    [goTo, replacePages, noteDepth],
  );

  /** A page made off another one: named after it, landing after it, and shown. */
  const landAfter = useCallback(
    (from: Page, made: { said: string; objects: SketchObject[] }) => {
      const landed = landedAfter(current.current, from, made);
      replacePages(landed.pages);
      goTo(landed.page.id);
    },
    [goTo, replacePages],
  );

  /**
   * The page again, the same objects in the same places under fresh ids, so the
   * two go their own ways from then on. It lands after the page it came from
   * and the sketch goes to it.
   */
  const duplicatePage = useCallback(
    (id?: string) => {
      const from = current.current.find((page) => page.id === (id ?? active.current));
      if (!from) return;
      landAfter(from, { said: "copy", objects: asDuplicated(from.state.objects) });
    },
    [landAfter],
  );

  /**
   * Delete a page, its history with it. There is no undo for this, which is
   * what the confirmation the caller puts up says.
   */
  const removePage = useCallback(
    (id: string) => {
      const pages = current.current;
      // A sketch always has a page, so the last one cannot go.
      if (pages.length < 2) return;
      const index = pages.findIndex((page) => page.id === id);
      if (index === -1) return;
      past.current.delete(id);
      future.current.delete(id);
      noteDepth();
      const next = pages.filter((page) => page.id !== id);
      replacePages(next);
      if (active.current !== id) return;
      // The page to its left takes over, or the first one if it had none.
      goTo(next[Math.max(0, index - 1)].id);
    },
    [goTo, replacePages, noteDepth],
  );

  /** What one page holds, without going to it. */
  const objectsOn = useCallback((id: string): SketchObject[] => {
    return current.current.find((page) => page.id === id)?.state.objects ?? [];
  }, []);

  /** What the File menu writes out. */
  const snapshot = useCallback(
    (): PageContent[] =>
      current.current.map((page) => ({ name: page.name, objects: page.state.objects })),
    [],
  );

  /**
   * A sketch carries its own preferences as well as its pages, and those are
   * not in the history. Touching says one of them changed, so the sketch reads
   * as unsaved until it is written out.
   */
  const [touched, setTouched] = useState(false);

  const touch = useCallback(() => setTouched(true), []);

  const isDirty = useCallback(
    () => touchedAt.current || changed(current.current, saved.current),
    [],
  );
  const touchedAt = useRef(touched);
  touchedAt.current = touched;

  const markSaved = useCallback(() => {
    saved.current = current.current;
    setSavedPages(current.current);
    setTouched(false);
  }, []);

  /** Replace the sketch with one read from disk, histories and all. */
  const load = useCallback(
    (loaded: PageContent[]) => {
      const next = loaded.map((page) =>
        newPage(page.name, { objects: page.objects, selection: [] }),
      );
      past.current.clear();
      future.current.clear();
      noteDepth();
      replacePages(next);
      goTo(next[0].id);
      saved.current = next;
      setSavedPages(next);
      setTouched(false);
    },
    [goTo, replacePages, noteDepth],
  );

  const shown = pages.find((page) => page.id === activeId) ?? pages[0];

  return {
    shown,
    /** Whether there is anything to save, for the title bar to say so. */
    dirty: touched || changed(pages, savedPages),
    read,
    write,
    record,
    stepBack,
    stepForward,
    /** Whether there is anything to undo, and anything to redo. */
    canUndo: depth.back > 0,
    canRedo: depth.forward > 0,
    reworkHistory,
    /** What the page bar draws. */
    row: pages.map(({ id, name }) => ({ id, name })),
    setView,
    selectPage,
    objectsOn,
    addPage,
    renamePage,
    movePage,
    reshapePages,
    removePage,
    duplicatePage,
    touch,
    isDirty,
    markSaved,
    load,
    snapshot,
  };
}
