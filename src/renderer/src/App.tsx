import { useEffect, useState } from "react";
import { buttonActions } from "./app/buttons";
import { clipboardActions } from "./app/clipboard";
import { customActions } from "./app/customs";
import { Dialogs } from "./app/Dialogs";
import { exportPicture } from "./app/exporting";
import { labelActions } from "./app/labels";
import { Menus } from "./app/Menus";
import { paletteState } from "./app/palette";
import { scriptActions } from "./app/scripting";
import { useCollecting } from "./app/useCollecting";
import { useDialogs } from "./app/useDialogs";
import { useKeys } from "./app/useKeys";
import { prefsFrom, useSettings } from "./app/useSettings";
import { useTooling } from "./app/useTooling";
import { useTransforms } from "./app/useTransforms";
import { valueActions } from "./app/values";
import { Workspace } from "./app/Workspace";
import type { MenuAction } from "./components/menus";
import { PageBar } from "./components/PageBar";
import { TitleBar } from "./components/TitleBar";
import { TouchBar } from "./components/TouchBar";
import { usePhone, useVisibleViewport } from "./phone";
import type { Building } from "./sketch/builds";
import { sheetOf } from "./sketch/measure";
import {
  isCaption,
  isCircle,
  isLine,
  isLocus,
  isParameter,
  isPoint,
  MAX_SAMPLES,
  MIN_SAMPLES,
  namesFor,
  type SketchCircle,
  type SketchLine,
  type SketchObject,
  setPickReach,
  settle,
  sharedPointSize,
} from "./sketch/model";
import { useDocument } from "./sketch/useDocument";
import { useSketch } from "./sketch/useSketch";
import "./App.css";

/** The clear sheet left round a figure a sketch was opened framed on. */
const FRAME_MARGIN = 32;

/** How far framing will shrink a figure, matching the canvas's own floor. */
const MIN_FRAME_SCALE = 0.1;

export function App() {
  const phone = usePhone();
  useVisibleViewport();
  // How much room a click is given is settled once, here, where what kind of
  // screen this is is already known. The model does not ask the browser.
  useEffect(() => setPickReach(phone), [phone]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /** The Construct entry under the pointer, which the sheet previews. */
  const [hovered, setHovered] = useState<MenuAction | null>(null);
  /**
   * What the object clipboard is holding, so Paste knows whether it has
   * anything to do. It belongs to the app, so it is read again as a menu opens:
   * another window may have copied something since this one last looked.
   */
  const [clipHeld, setClipHeld] = useState<string | null>(() => window.api.objects.peek());
  /**
   * The sketches opened or saved most recently. It belongs to the app rather
   * than to any window, so it is read again as a menu opens: another window may
   * have opened something since this one last looked.
   */
  const [recent, setRecent] = useState<string[]>(() => window.api.file.recent());

  /** What the window has in hand: the tool, its arming, and what is being typed into. */
  const tools = useTooling();
  /** Which dialog is open, and what it is holding while it is. */
  const dialogs = useDialogs();
  const sketch = useSketch();
  const { undo, redo, canUndo, canRedo, remove, selectAll } = sketch;
  /** What the window remembers between runs: the dock, the steps, the paper. */
  const settings = useSettings({ sketch, phone, setSpotlight: tools.setSpotlight });
  // Whether a point that lands says its name straight away, told to the sketch
  // rather than read there, since every way of making a point goes through it.
  sketch.labelNewPoints(settings.labelNew);
  const doc = useDocument(sketch, {
    read: () => settings.prefsAt.current,
    onOpen: (opened) => settings.setPrefs(opened ?? prefsFrom(window.api.settings.read())),
  });
  const shared = sharedPointSize(sketch.state);
  const { objects, selection } = sketch.state;

  const selected = selection
    .map((id) => objects.find((object) => object.id === id))
    .filter((object): object is SketchObject => object !== undefined);
  const chosenLines = selected.filter(isLine);
  // Anything a point can be put on and slide along.
  const chosenPaths = selected.filter(
    (object): object is SketchLine | SketchCircle => isLine(object) || isCircle(object),
  );
  const chosenPoints = selected.filter(isPoint);
  // Where every line runs, which is what says whether two of them cross.
  const geometry = settle(objects).settled;
  const building: Building = {
    objects,
    selected,
    chosenLines,
    chosenPaths,
    chosenPoints,
    geometry,
    pointSize: tools.pointSize,
    view: sketch.view,
    viewport: tools.viewport,
  };

  /** The sketch as an expression reads it, for the Calculator's preview. */
  const readable = sheetOf(objects, geometry);
  const names = namesFor(objects);
  /** The transform dialogs, what they are holding, and what they would make. */
  const moves = useTransforms({
    sketch,
    building,
    objects,
    selection,
    geometry,
    names,
    pointSize: tools.pointSize,
    hovered,
    calculating: dialogs.calculator !== null,
    setInsert: dialogs.setInsert,
  });

  /** The numbers the sketch holds, and the dialogs that write them. */
  const numbers = valueActions({
    sketch,
    building,
    selection,
    names,
    readable,
    calculator: dialogs.calculator,
    setCalculator: dialogs.setCalculator,
    parameterDialog: dialogs.parameterDialog,
    setParameterDialog: dialogs.setParameterDialog,
    setInsert: dialogs.setInsert,
    setTableDialog: dialogs.setTableDialog,
    collecting: dialogs.collecting,
  });
  /** Names, labels, and what is out of view. */
  const naming = labelActions({ sketch, objects, selection, geometry, setClash: dialogs.setClash });
  /** The buttons on the sheet, and what pressing one does. */
  const buttons = buttonActions({
    sketch,
    building,
    selection,
    setButtonDialog: dialogs.setButtonDialog,
    spot: numbers.valueSpot,
    hideObjects: naming.hideObjects,
  });
  /** The transforms this page was shown by example. */
  const custom = customActions({
    sketch,
    objects,
    selection,
    setCustomDialog: dialogs.setCustomDialog,
  });

  // A sketch that asked to be framed is put on its figure rather than on the
  // sheet's origin. It waits for the canvas to have a size, since there is no
  // framing anything without one, and happens once: from then on the view is
  // whatever it has been panned and zoomed to.
  useEffect(() => {
    if (!doc.toFrame || tools.viewport.width === 0 || tools.viewport.height === 0) return;
    const spots = [...geometry.points.values()];
    if (spots.length === 0) {
      doc.framed();
      return;
    }
    const xs = spots.map((one) => one.x);
    const ys = spots.map((one) => one.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    // Never past its own size: a small figure is shown at 100% rather than
    // blown up to fill the frame, which is what a sketch opens at everywhere.
    const across = tools.viewport.width - 2 * FRAME_MARGIN;
    const down = tools.viewport.height - 2 * FRAME_MARGIN;
    const wide = right - left;
    const tall = bottom - top;
    const scale = Math.max(
      MIN_FRAME_SCALE,
      Math.min(1, wide > 0 ? across / wide : 1, tall > 0 ? down / tall : 1),
    );
    sketch.setView({
      x: (left + right) / 2 - tools.viewport.width / scale / 2,
      y: (top + bottom) / 2 - tools.viewport.height / scale / 2,
      scale,
    });
    doc.framed();
  }, [doc, tools.viewport, geometry, sketch]);

  const named = naming.labelRows();
  const away = naming.hiddenRows();

  /** The palette: what the bar is set on, and what setting it does. */
  const palette = paletteState({
    sketch,
    objects,
    selected,
    selection,
    editing: tools.editing,
    labelPick: tools.labelPick,
    prefs: settings.prefs,
    armed: tools.armed,
    setArmed: tools.setArmed,
    activeTool: tools.activeTool,
    variants: tools.variants,
  });

  /** Asking a model for a script, and running what comes back. */
  const { promptForRequest, runTheScript } = scriptActions({
    sketch,
    scriptTarget: dialogs.scriptTarget,
    request: dialogs.request,
    script: dialogs.script,
    setScriptRunning: dialogs.setScriptRunning,
    setScriptErrors: dialogs.setScriptErrors,
    setScriptWay: dialogs.setScriptWay,
    viewport: tools.viewport,
    pointSize: tools.pointSize,
  });
  /** Cut, copy, paste, and walking the family tree. */
  const clipboard = clipboardActions({
    sketch,
    objects,
    selection,
    remove,
    setClipHeld,
  });

  useCollecting({
    objects,
    collecting: dialogs.collecting,
    rowNow: numbers.rowNow,
    captureRow: numbers.captureRow,
  });

  /**
   * Plus and minus step what is selected: a locus by its samples, a parameter by
   * the adjustment the places it was typed to set. Both at once where both are
   * selected, since either key means the same thing to either.
   */
  function stepSelection(step: number) {
    const before = sketch.read();
    const held = (object: SketchObject) => before.selection.includes(object.id);
    const wanted = before.objects.filter(
      (object) => (isLocus(object) || isParameter(object)) && held(object),
    );
    if (wanted.length === 0) return;
    const way = Math.sign(step);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (!held(object)) return object;
        if (isLocus(object)) {
          return {
            ...object,
            samples: Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, object.samples + step)),
          };
        }
        if (isParameter(object)) {
          // Typed to two places asked for hundredths, so hundredths is what the
          // keys move it by. Said back to those places, so it never drifts.
          const adjust = way * 10 ** -object.places;
          return { ...object, value: Number((object.value + adjust).toFixed(object.places)) };
        }
        return object;
      }),
    });
  }

  /** Deleting a page cannot be undone, so it is asked about first. */
  async function deletePage(id: string) {
    const page = sketch.pages.find((candidate) => candidate.id === id);
    if (!page) return;
    if (await window.api.pages.confirmDelete(page.name)) sketch.removePage(id);
  }

  useEffect(() => {
    if (!tools.editing) return;
    const open = objects.find((object) => object.id === tools.editing);
    if (!open || open.hidden === true) tools.setEditing(null);
  }, [tools.editing, objects, tools.setEditing]);

  /**
   * The marks the Text tool was armed with, put on at the caret the moment a
   * caption opens with nothing written in it yet. Bold, italic and underline
   * live in a caption's own markup rather than as a setting on it, so arming
   * one is arming how the next keystroke lands, which is what the caret holds.
   * Only an empty caption: reopening one that has been written in leaves what
   * is there alone.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caption opening is the trigger
  useEffect(() => {
    if (!tools.editing || !tools.editor.current) return;
    const opened = objects.find((object) => object.id === tools.editing);
    if (!opened || !isCaption(opened) || opened.html !== "") return;
    for (const mark of ["bold", "italic", "underline"] as const) {
      if (!tools.armed[mark]) continue;
      try {
        if (!document.queryCommandState(mark)) document.execCommand(mark);
      } catch {
        // A host without the command leaves the caption unmarked, which reads
        // the same as never having armed it.
      }
    }
  }, [tools.editing]);

  useKeys({
    dialogOpen: moves.dialog !== null || dialogs.anyOpen,
    pickTool: tools.setActiveTool,
    newSketch: doc.newSketch,
    openSketch: () => void doc.open(),
    saveSketch: () => void doc.save(),
    closeSketch: doc.close,
    quit: () => void doc.quit(),
    selectAll,
    cut: clipboard.cutSelection,
    copy: clipboard.copySelection,
    paste: clipboard.pasteObjects,
    toggleLabels: naming.toggleLabels,
    togglePalette: () => settings.keepDock({ showPalette: !settings.showPalette }),
    showHidden: naming.showAllHidden,
    hide: () => naming.hideObjects(selection, true),
    selectKin: clipboard.selectKin,
    labelPanel: () => settings.openPanel("labels"),
    calculate: () => dialogs.setCalculator({}),
    midpoint: () => moves.construct("midpoint"),
    segment: () => moves.construct("segment"),
    cross: () => moves.construct("intersection"),
    newParameter: () => dialogs.setParameterDialog({}),
    fill: () => moves.construct("interior"),
    applyCustom: (nth) => {
      const found = custom.customs[nth];
      if (found) custom.applyCustom(found.id);
    },
    documentOptions: () => dialogs.setDocOptions(true),
    editDefinition: numbers.editSelected,
    undo,
    redo,
    // Del on a picked label takes the label off and leaves what it names. With
    // no label picked it deletes the selection, the way it always has.
    remove: () => {
      if (!palette.labelsPicked) {
        remove();
        return;
      }
      palette.styleLabel({ shown: false });
      tools.setLabelPick([]);
    },
    escape: () => {
      tools.setActiveTool("arrow");
      tools.pickVariant("arrow", "all");
    },
    step: stepSelection,
  });

  return (
    <div className="app">
      {/* A tab has a title bar of its own, and no window to minimise, maximise
          or close, so GRASP draws none on the web. The document name and its
          star are in the tab title either way. */}
      {window.api.platform !== "web" && <TitleBar title={doc.title} />}
      <Menus
        sketch={sketch}
        doc={doc}
        dialogs={dialogs}
        numbers={numbers}
        naming={naming}
        buttons={buttons}
        custom={custom}
        settings={settings}
        moves={moves}
        building={building}
        objects={objects}
        selection={selection}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        setHovered={setHovered}
        recent={recent}
        setRecent={setRecent}
        clipHeld={clipHeld}
        setClipHeld={setClipHeld}
        shared={shared}
        setPointSize={tools.setPointSize}
        clipboard={clipboard}
      />
      <Workspace
        sketch={sketch}
        doc={doc}
        tools={tools}
        settings={settings}
        moves={moves}
        dialogs={dialogs}
        naming={naming}
        numbers={numbers}
        buttons={buttons}
        palette={palette}
        objects={objects}
        named={named}
        away={away}
        phone={phone}
      />
      {phone && (
        <TouchBar
          canUndo={canUndo}
          onUndo={undo}
          canRedo={canRedo}
          onRedo={redo}
          snapping={settings.snapping.length || settings.snapping.angle}
          onSnapping={(on) => settings.keepSnapping({ length: on, angle: on })}
          onCancel={() => {
            tools.cancelSheet.current();
            tools.setActiveTool("arrow");
            tools.pickVariant("arrow", "all");
          }}
        />
      )}
      <PageBar
        pages={sketch.pages}
        activeId={sketch.activeId}
        onSelectPage={sketch.selectPage}
        onAddPage={sketch.addPage}
        onRenamePage={sketch.renamePage}
        onDeletePage={deletePage}
        onDuplicatePage={sketch.duplicatePage}
        onMovePage={sketch.movePage}
        tabs={settings.prefs.pageTabs !== false}
        objectCount={sketch.state.objects.length}
      />
      <Dialogs
        dialogs={dialogs}
        numbers={numbers}
        naming={naming}
        buttons={buttons}
        custom={custom}
        settings={settings}
        moves={moves}
        sketch={sketch}
        objects={objects}
        names={names}
        readable={readable}
        buildPrompt={promptForRequest}
        onRunScript={() => void runTheScript()}
        onExport={(to) =>
          void exportPicture(to, {
            options: settings.picture,
            selection,
            suggested: doc.name,
            onDone: () => dialogs.setExportTo(null),
          })
        }
      />
      {openMenu && (
        // biome-ignore lint/a11y/noStaticElementInteractions: dismiss layer, the menu items stay reachable
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by the menu button itself
        <div
          className="app__dismiss"
          onClick={() => {
            setOpenMenu(null);
            setHovered(null);
          }}
        />
      )}
    </div>
  );
}
