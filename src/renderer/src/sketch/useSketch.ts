import { useCallback, useRef } from "react";
import { type Arming, armedOnto } from "./armed";
import {
  namesToGive,
  type PointSize,
  resolve,
  type SketchObject,
  type SketchState,
  withDependents,
} from "./model";
import { demotedUnder } from "./overlaps";
import { type PageContent, usePages } from "./pages";

/**
 * The sketch: what a tool does to the page that is up.
 *
 * Plotting, moving and deleting are undoable, one step per gesture; changing
 * the selection or a point's size is not. A drag reports itself with
 * begin/update/end so that the whole move collapses into a single step.
 *
 * The pages themselves, their parked histories and what the File menu saves
 * live in `pages.ts`. Nothing here reaches into that: it reads and writes the
 * page that is up through the store, which is what keeps one page's undo out of
 * another's.
 */
export function useSketch() {
  const store = usePages();
  const { read, write, record, stepBack, stepForward, reworkHistory, shown } = store;
  /** What the gesture in progress found, so cancelling can put it back. */
  const gestureStart = useRef<SketchState | null>(null);
  /** Whether a point that has just been made comes out with its label showing. */
  const naming = useRef(false);
  /** What the palette has armed for the tool that is up, or null under one that draws nothing. */
  const arming = useRef<Arming | null>(null);

  /** The ids already on the page, so a pass can tell what has just landed. */
  const alreadyThere = useCallback(
    () => new Set(read().objects.map((object) => object.id)),
    [read],
  );

  /**
   * The armed style on whatever has just landed. Undo and redo put back a state
   * that was arrived at once already, so they go round this: what they hand
   * back is restored, not drawn.
   */
  const armed = useCallback(
    (objects: SketchObject[]): SketchObject[] =>
      arming.current ? armedOnto(objects, alreadyThere(), arming.current) : objects,
    [alreadyThere],
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
      const already = alreadyThere();
      return objects.map((object) =>
        object.kind === "point" && !already.has(object.id) && object.label === undefined
          ? { ...object, label: { shown: true } }
          : object,
      );
    },
    [alreadyThere],
  );

  const labelNewPoints = useCallback((on: boolean) => {
    naming.current = on;
  }, []);

  /**
   * A label shown on something that has never carried a name takes one now, and
   * keeps it. It is done here rather than at every place a label can be shown,
   * so one asked for by the panel, by a key, by a paste, by a transform or by a
   * script is named the same way. Undo and redo go round it: what they hand
   * back was arrived at once already.
   */
  const lettered = useCallback((objects: SketchObject[]): SketchObject[] => {
    const wanting = objects.filter(
      (object) => object.label?.shown === true && object.label.name === undefined,
    );
    if (wanting.length === 0) return objects;
    const given = namesToGive(
      objects,
      wanting.map((object) => object.id),
    );
    if (given.size === 0) return objects;
    return objects.map((object) => {
      const name = given.get(object.id);
      return name ? { ...object, label: { ...object.label, name } } : object;
    });
  }, []);

  /**
   * Every change goes through here, so an image is never left behind by the
   * point it came from: `resolve` settles them all before anything is shown.
   */
  const apply = useCallback(
    (next: SketchState, arm = true) => {
      const objects = arm ? armed(lettered(namedIfWanted(next.objects))) : next.objects;
      write({ ...next, objects: resolve(objects) });
    },
    [write, armed, lettered, namedIfWanted],
  );

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
    const previous = stepBack(read());
    if (previous) apply(previous, false);
  }, [apply, read, stepBack]);

  const redo = useCallback(() => {
    const next = stepForward(read());
    if (next) apply(next, false);
  }, [apply, read, stepForward]);

  const restyle = useCallback(
    (size: PointSize) => {
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
      reworkHistory(resize);
      apply(resize(read()));
    },
    [apply, read, reworkHistory],
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

  /** A sketch read from disk drops whatever gesture was half done. */
  const loadPages = store.load;
  const load = useCallback(
    (loaded: PageContent[]) => {
      gestureStart.current = null;
      loadPages(loaded);
    },
    [loadPages],
  );

  return {
    /** The active page's objects and selection. */
    state: shown.state,
    dirty: store.dirty,
    view: shown.view,
    addObjects,
    setView: store.setView,
    pages: store.row,
    activeId: shown.id,
    selectPage: store.selectPage,
    objectsOn: store.objectsOn,
    addPage: store.addPage,
    renamePage: store.renamePage,
    movePage: store.movePage,
    reshapePages: store.reshapePages,
    removePage: store.removePage,
    duplicatePage: store.duplicatePage,
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
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    remove,
    restyle,
    touch: store.touch,
    isDirty: store.isDirty,
    markSaved: store.markSaved,
    load,
    snapshot: store.snapshot,
  };
}

export type Sketch = ReturnType<typeof useSketch>;
