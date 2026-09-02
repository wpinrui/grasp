import { useCallback, useRef, useState } from "react";
import { type Arming, armedOnto } from "./armed";
import {
  asDuplicated,
  DEFAULT_VIEW,
  EMPTY_SKETCH,
  type PointSize,
  resolve,
  type SketchObject,
  type SketchState,
  type View,
  withDependents,
} from "./model";
import { demotedUnder } from "./overlaps";

/**
 * The sketch: its pages, and the objects and selection on each.
 *
 * Plotting, moving and deleting are undoable, one step per gesture; changing
 * the selection or a point's size is not. A drag reports itself with
 * begin/update/end so that the whole move collapses into a single step.
 *
 * Every page carries its own history, so undo on one page never reaches into
 * another, and its own view, so a page is where you left it when you come back.
 * The objects are also what the File menu saves, so the last-saved pages are
 * held here: the sketch is dirty while any of them differs.
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
 * ids are in `model.ts` and for the same reason: the counter is module state,
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

export function useSketch() {
  const [pages, setPages] = useState<Page[]>(() => [newPage("Page 1")]);
  const [activeId, setActiveId] = useState(() => pages[0].id);
  const current = useRef(pages);
  const active = useRef(activeId);
  // Keyed by page, so switching pages parks a history rather than losing it.
  const past = useRef(new Map<string, SketchState[]>());
  const future = useRef(new Map<string, SketchState[]>());
  const gestureStart = useRef<SketchState | null>(null);
  /** Whether a point that has just been made comes out with its label showing. */
  const naming = useRef(false);
  /** What the palette has armed for the tool that is up, or null under one that draws nothing. */
  const arming = useRef<Arming | null>(null);
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

  const read = useCallback(() => activePage().state, [activePage]);

  /**
   * Every change goes through here, so an image is never left behind by the
   * point it came from: `resolve` settles them all before anything is shown.
   */
  const apply = useCallback(
    (next: SketchState, arm = true) => {
      const objects = arm ? armed(namedIfWanted(next.objects)) : next.objects;
      const settled = { ...next, objects: resolve(objects) };
      replacePages(
        current.current.map((page) =>
          page.id === active.current ? { ...page, state: settled } : page,
        ),
      );
    },
    [replacePages],
  );

  /**
   * The armed style on whatever has just landed. Undo and redo put back a state
   * that was arrived at once already, so they go round this: what they hand
   * back is restored, not drawn.
   */
  const armed = useCallback(
    (objects: SketchObject[]): SketchObject[] => {
      if (!arming.current) return objects;
      const already = new Set(activePage().state.objects.map((object) => object.id));
      return armedOnto(objects, already, arming.current);
    },
    [activePage],
  );

  const armStyle = useCallback((wanted: Arming | null) => {
    arming.current = wanted;
  }, []);

  /**
   * With the panel's toggle on, a point that was not on the page a moment ago
   * comes out with its label showing. It is done here rather than everywhere a
   * point is made, so a point plotted, constructed, transformed or landed by a
   * dialog all behave the same.
   */
  const namedIfWanted = useCallback(
    (objects: SketchObject[]): SketchObject[] => {
      if (!naming.current) return objects;
      const already = new Set(activePage().state.objects.map((object) => object.id));
      return objects.map((object) =>
        object.kind === "point" && !already.has(object.id) && object.label === undefined
          ? { ...object, label: { shown: true } }
          : object,
      );
    },
    [activePage],
  );

  const labelNewPoints = useCallback((on: boolean) => {
    naming.current = on;
  }, []);

  const record = useCallback((before: SketchState) => {
    const id = active.current;
    past.current.set(id, [...(past.current.get(id) ?? []), before]);
    future.current.set(id, []);
  }, []);

  const select = useCallback(
    (selection: string[]) => apply({ ...read(), selection }),
    [apply, read],
  );

  /** Every object on the page. Not an undo step, as no selection change is. */
  const selectAll = useCallback(() => {
    const { objects } = read();
    apply({ objects, selection: objects.map((object) => object.id) });
  }, [apply, read]);

  const commit = useCallback(
    (next: SketchState) => {
      record(read());
      apply(next);
    },
    [apply, read, record],
  );

  const beginGesture = useCallback(() => {
    gestureStart.current = read();
  }, [read]);

  /** Put back what the gesture found, and record nothing. */
  const cancelGesture = useCallback(() => {
    if (!gestureStart.current) return;
    apply(gestureStart.current, false);
    gestureStart.current = null;
  }, [apply]);

  const endGesture = useCallback(() => {
    if (!gestureStart.current) return;
    record(gestureStart.current);
    gestureStart.current = null;
  }, [record]);

  const undo = useCallback(() => {
    const id = active.current;
    const history = [...(past.current.get(id) ?? [])];
    const previous = history.pop();
    if (!previous) return;
    past.current.set(id, history);
    future.current.set(id, [...(future.current.get(id) ?? []), read()]);
    apply(previous, false);
  }, [apply, read]);

  const redo = useCallback(() => {
    const id = active.current;
    const undone = [...(future.current.get(id) ?? [])];
    const next = undone.pop();
    if (!next) return;
    future.current.set(id, undone);
    past.current.set(id, [...(past.current.get(id) ?? []), read()]);
    apply(next, false);
  }, [apply, read]);

  const restyle = useCallback(
    (size: PointSize) => {
      const id = active.current;
      const ids = read().selection;
      if (ids.length === 0) return;
      const resize = (state: SketchState): SketchState => ({
        ...state,
        objects: state.objects.map((object) =>
          object.kind === "point" && ids.includes(object.id) ? { ...object, size } : object,
        ),
      });
      // Not an undo step, so the history is resized too: undoing a move must
      // not drag the old size back with it.
      past.current.set(id, (past.current.get(id) ?? []).map(resize));
      future.current.set(id, (future.current.get(id) ?? []).map(resize));
      apply(resize(read()));
    },
    [apply, read],
  );

  /** Deleting a point takes its images with it, and theirs after them. */
  const remove = useCallback(() => {
    const { objects, selection } = read();
    if (selection.length === 0) return;
    const going = withDependents(objects, selection);
    commit({ objects: objects.filter((object) => !going.has(object.id)), selection: [] });
  }, [commit, read]);

  /**
   * Land new objects as one step and select them: the images a transform worked
   * out, or the points and the line a straightedge click just drew.
   */
  const addObjects = useCallback(
    (made: SketchObject[], select?: string[]) => {
      if (made.length === 0) return;
      const before = read();
      // A straight object landing along one already there steps that one down a
      // style, so the same ink in the same place does not read as one thing.
      commit({
        objects: [...demotedUnder(before.objects, made), ...made],
        selection: select ?? made.map((object) => object.id),
      });
    },
    [commit, read],
  );

  const setView = useCallback(
    (view: View) => {
      replacePages(
        current.current.map((page) => (page.id === active.current ? { ...page, view } : page)),
      );
    },
    [replacePages],
  );

  const selectPage = useCallback((id: string) => {
    if (!current.current.some((page) => page.id === id)) return;
    active.current = id;
    setActiveId(id);
  }, []);

  /** A new empty page after the last one, which the sketch switches to. */
  const addPage = useCallback(() => {
    const page = newPage(nextPageName(current.current));
    replacePages([...current.current, page]);
    active.current = page.id;
    setActiveId(page.id);
  }, [replacePages]);

  /** An empty name is refused, so a page always has one. */
  const renamePage = useCallback(
    (id: string, name: string) => {
      const wanted = name.trim();
      if (!wanted) return;
      replacePages(
        current.current.map((page) => (page.id === id ? { ...page, name: wanted } : page)),
      );
    },
    [replacePages],
  );

  /** Drag on the page bar: the page comes out of the row and goes back in at `to`. */
  const movePage = useCallback(
    (id: string, to: number) => {
      const pages = current.current;
      const from = pages.findIndex((page) => page.id === id);
      if (from === -1 || from === to || to < 0 || to >= pages.length) return;
      const next = pages.filter((page) => page.id !== id);
      next.splice(to, 0, pages[from]);
      replacePages(next);
    },
    [replacePages],
  );

  /**
   * The pages Document Options was left holding, in its order: existing ones
   * renamed and reordered, missing ones gone with their histories, and new ones
   * made blank or copied. One pass, since the dialog answers all of it at once.
   */
  const reshapePages = useCallback(
    (wanted: WantedPage[]) => {
      if (wanted.length === 0) return;
      const held = new Map(current.current.map((page) => [page.id, page]));
      const next: Page[] = wanted.map((one) => {
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
      const staying = new Set(next.map((page) => page.id));
      for (const page of current.current) {
        if (staying.has(page.id)) continue;
        past.current.delete(page.id);
        future.current.delete(page.id);
      }
      replacePages(next);
      // The page being shown may have been one of the ones removed.
      if (staying.has(active.current)) return;
      active.current = next[0].id;
      setActiveId(next[0].id);
    },
    [replacePages],
  );

  /** A page made off another one: named after it, landing after it, and shown. */
  const landAfter = useCallback(
    (from: Page, said: string, objects: SketchObject[]) => {
      const pages = current.current;
      const page = {
        ...newPage(
          pageNamed(
            from.name,
            said,
            pages.map((one) => one.name),
          ),
          { objects, selection: [] },
        ),
        view: from.view,
      };
      const next = [...pages];
      next.splice(pages.indexOf(from) + 1, 0, page);
      replacePages(next);
      active.current = page.id;
      setActiveId(page.id);
    },
    [replacePages],
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
      landAfter(from, "copy", asDuplicated(from.state.objects));
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
      const next = pages.filter((page) => page.id !== id);
      replacePages(next);
      if (active.current !== id) return;
      // The page to its left takes over, or the first one if it had none.
      const takes = next[Math.max(0, index - 1)];
      active.current = takes.id;
      setActiveId(takes.id);
    },
    [replacePages],
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
      gestureStart.current = null;
      replacePages(next);
      active.current = next[0].id;
      setActiveId(next[0].id);
      saved.current = next;
      setSavedPages(next);
      setTouched(false);
    },
    [replacePages],
  );

  const shown = pages.find((page) => page.id === activeId) ?? pages[0];

  return {
    /** The active page's objects and selection. */
    state: shown.state,
    /** Whether there is anything to save, for the title bar to say so. */
    dirty: touched || changed(pages, savedPages),
    view: shown.view,
    addObjects,
    setView,
    pages: pages.map(({ id, name }) => ({ id, name })),
    activeId: shown.id,
    selectPage,
    objectsOn,
    addPage,
    renamePage,
    movePage,
    reshapePages,
    removePage,
    duplicatePage,
    read,
    select,
    selectAll,
    commit,
    beginGesture,
    labelNewPoints,
    armStyle,
    updateGesture: apply,
    endGesture,
    cancelGesture,
    undo,
    redo,
    remove,
    restyle,
    touch,
    isDirty,
    markSaved,
    load,
    snapshot,
  };
}

export type Sketch = ReturnType<typeof useSketch>;
