import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { buttonActions } from "./app/buttons";
import { customActions } from "./app/customs";
import { Dialogs } from "./app/Dialogs";
import { labelActions } from "./app/labels";
import { paletteState } from "./app/palette";
import { useDialogs } from "./app/useDialogs";
import { useKeys } from "./app/useKeys";
import { prefsFrom, useSettings } from "./app/useSettings";
import { useTransforms } from "./app/useTransforms";
import { valueActions } from "./app/values";
import type { ButtonForm } from "./components/ButtonDialog";
import { Canvas } from "./components/Canvas";
import { Dock } from "./components/Dock";
import type { ExportTo } from "./components/ExportDialog";
import { type HiddenKinds, HiddenPanel } from "./components/HiddenPanel";
import { LabelPanel } from "./components/LabelPanel";
import { MenuBar } from "./components/MenuBar";
import type { MenuAction } from "./components/menus";
import { PageBar } from "./components/PageBar";
import { Palette } from "./components/Palette";
import { NEW_PAGE } from "./components/ScriptDialog";
import { SnapPanel } from "./components/SnapPanel";
import { TitleBar } from "./components/TitleBar";
import { Toolbox } from "./components/Toolbox";
import { TouchBar } from "./components/TouchBar";
import { usePhone, useVisibleViewport } from "./phone";
import type { Armed } from "./sketch/armed";
import { type Building, canBuild } from "./sketch/builds";
import { canDefine } from "./sketch/custom";
import { canSeed } from "./sketch/iterate";
import {
  markableAngle,
  markableDistances,
  markableMirror,
  markableRatio,
  markableVector,
} from "./sketch/markable";
import { sheetOf } from "./sketch/measure";
import {
  asPasted,
  DEFAULT_POINT_SIZE,
  isCaption,
  isCircle,
  isLine,
  isLocus,
  isParameter,
  isPoint,
  isTable,
  kinOf,
  type LineForm,
  MAX_SAMPLES,
  MIN_SAMPLES,
  namesFor,
  type PointSize,
  type SketchCircle,
  type SketchLine,
  type SketchObject,
  setPickReach,
  settle,
  sharedPointSize,
  withFamily,
} from "./sketch/model";
import { togglePick } from "./sketch/picking";
import { drawPicture } from "./sketch/picture";
import { canvasTokens } from "./sketch/prefs";
import { buildPrompt } from "./sketch/prompt";
import { runScript } from "./sketch/script";
import { transformable } from "./sketch/transforms";
import { useDocument } from "./sketch/useDocument";
import { useSketch } from "./sketch/useSketch";
import "./App.css";

/** The entries that build something, and so can be previewed and constructed. */
const BUILDS = new Set<MenuAction>([
  "segment",
  "ray",
  "line",
  "parallel",
  "perpendicular",
  "bisector",
  "intersection",
  "midpoint",
  "point-on-object",
  "interior",
  "circle-interior",
  "arc-sector",
  "arc-segment",
  "arc-on-circle",
  "arc-through",
  "circle-centre-point",
  "circle-centre-radius",
  "locus",
  "measure-length",
  "measure-distance",
  "measure-perimeter",
  "measure-circumference",
  "measure-angle",
  "measure-area",
  "measure-arc-angle",
  "measure-arc-length",
  "measure-radius",
  "measure-ratio",
  "measure-value",
]);

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
  const [activeTool, setActiveTool] = useState("arrow");
  /** How big the sheet is on screen, which is how far a new locus reaches. */
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /** The sheet is plain paper until the grid is asked for. */
  /** What each tool with a flyout is armed with. */
  const [variants, setVariants] = useState<Record<string, string>>({
    straightedge: "segment",
    measure: "length",
    arrow: "all",
    marker: "equal",
  });

  /** Arm a tool's flyout with one of what it offers. */
  const pickVariant = useCallback((tool: string, variant: string) => {
    setVariants((armed) => ({ ...armed, [tool]: variant }));
  }, []);
  /**
   * The labels picked on the sheet, held as the objects they name, since a
   * label belongs to what it names rather than standing on its own. Picking one
   * lets go of the selection, but the two are held apart rather than kept in
   * step: selecting something afterwards leaves these held and simply wins, and
   * they let go on a tool switch the way the rest of what a tool was doing does.
   */
  const [labelPick, setLabelPick] = useState<string[]>([]);
  /**
   * What the palette has been set to for the tool that is up, which is how the
   * next thing that tool draws comes out. Switching tools puts it back on the
   * defaults, so a tool is always picked up on what GRASP says rather than on
   * what it was left on the last time it was held.
   */
  const [armed, setArmed] = useState<Armed>({});
  const toolWas = useRef(activeTool);
  if (toolWas.current !== activeTool) {
    toolWas.current = activeTool;
    setArmed({});
    setLabelPick([]);
  }
  /** The size a new point is born at, which every Point Style pick resets. */
  const [pointSize, setPointSize] = useState<PointSize>(DEFAULT_POINT_SIZE);
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
  /**
   * Export: the selection where there is one, and the whole page where there
   * is not. The picture goes over in both forms, since the save dialog is what
   * settles which one is written.
   */
  async function exportPicture(to: ExportTo) {
    dialogs.setExportTo(null);
    const wanted = selection.length > 0 ? new Set(selection) : null;
    try {
      const drawn = await drawPicture(settings.picture, wanted);
      if (!drawn) return;
      if (to === "clipboard") await window.api.image.copy(drawn.png);
      else await window.api.image.save({ ...drawn, suggested: doc.name });
    } catch (error) {
      await window.api.file.reportError(
        error instanceof Error ? error.message : "The picture could not be drawn.",
      );
    }
  }

  /** What Escape does to the sheet, for the phone's Cancel key to do the same. */
  const cancelSheet = useRef(() => {});

  /**
   * The kinds being kept out of the way wholesale, which is a different thing
   * from hiding an object: it says nothing about any one of them, and letting
   * them back brings back exactly what was showing before.
   */
  const [hiddenKinds, setHiddenKinds] = useState<HiddenKinds>({ marks: false, text: false });
  /**
   * The tools with nothing to do while a whole kind is being kept out of the
   * way: what they would draw would not be drawn. The Measure tool writes its
   * readings, so it goes with the text.
   */
  const toolsOff: Record<string, string> = {
    ...(hiddenKinds.marks ? { marker: "Markings are hidden" } : {}),
    ...(hiddenKinds.text ? { text: "Text is hidden", measure: "Text is hidden" } : {}),
  };
  // A tool that goes idle hands the sheet back to the Arrow rather than leaving
  // the pointer on something that can do nothing.
  if (toolsOff[activeTool]) setActiveTool("arrow");
  /** The object the label panel is pointing at, lit up on the sheet. */
  const [spotlight, setSpotlight] = useState<string | null>(null);
  /** The caption being typed into. It belongs to the window, not to the page. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Where the text palette reaches the caption being typed into. */
  const editor = useRef<HTMLDivElement | null>(null);
  /** Counted up by a double-click on the Text tool, which asks for a caption. */
  const [captionWanted, setCaptionWanted] = useState(0);
  /** Which dialog is open, and what it is holding while it is. */
  const dialogs = useDialogs();
  const sketch = useSketch();
  const { undo, redo, canUndo, canRedo, remove, restyle, selectAll } = sketch;
  /** What the window remembers between runs: the dock, the steps, the paper. */
  const settings = useSettings({ sketch, phone });
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
    pointSize,
    view: sketch.view,
    viewport,
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
    pointSize,
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
    if (!doc.toFrame || viewport.width === 0 || viewport.height === 0) return;
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
    const across = viewport.width - 2 * FRAME_MARGIN;
    const down = viewport.height - 2 * FRAME_MARGIN;
    const wide = right - left;
    const tall = bottom - top;
    const scale = Math.max(
      MIN_FRAME_SCALE,
      Math.min(1, wide > 0 ? across / wide : 1, tall > 0 ? down / tall : 1),
    );
    sketch.setView({
      x: (left + right) / 2 - viewport.width / scale / 2,
      y: (top + bottom) / 2 - viewport.height / scale / 2,
      scale,
    });
    doc.framed();
  }, [doc, viewport, geometry, sketch]);

  const named = naming.labelRows();
  const away = naming.hiddenRows();

  /** The palette: what the bar is set on, and what setting it does. */
  const palette = paletteState({
    sketch,
    objects,
    selected,
    selection,
    editing,
    labelPick,
    prefs: settings.prefs,
    armed,
    setArmed,
    activeTool,
    variants,
  });

  /**
   * Scripting. The prompt is built from the window as it is now, and a run
   * lands what the worker hands back in one commit, so a whole script is one
   * undo step. Nothing reaches a page unless the whole script comes good.
   */
  const scriptSheet = () => ({
    width: viewport.width / sketch.view.scale,
    height: viewport.height / sketch.view.scale,
    pixelRatio: window.devicePixelRatio,
  });

  function promptForRequest(): string {
    const editing = dialogs.scriptTarget !== NEW_PAGE;
    const page = sketch.pages.find((one) => one.id === dialogs.scriptTarget);
    return buildPrompt({
      request: dialogs.request,
      sheet: scriptSheet(),
      target:
        editing && page
          ? { kind: "edit", page: page.name, objects: sketch.objectsOn(page.id) }
          : { kind: "new" },
    });
  }

  async function runTheScript() {
    dialogs.setScriptRunning(true);
    dialogs.setScriptErrors([]);
    const wanted = sketch.pages.find((one) => one.id === dialogs.scriptTarget);
    // The page a script works on is the page it is run from, so GRASP goes
    // there first and the objects it hands back are committed where they land.
    if (wanted) sketch.selectPage(wanted.id);
    else sketch.addPage();
    const before = sketch.read();
    const result = await runScript(dialogs.script, {
      objects: before.objects,
      sheet: scriptSheet(),
      pointSize: pointSize,
    });
    dialogs.setScriptRunning(false);
    if (!result.ok) {
      dialogs.setScriptErrors(result.errors);
      return;
    }
    sketch.commit({ objects: result.objects, selection: [] });
    dialogs.setScriptErrors([]);
    dialogs.setScriptWay(null);
  }

  /** Open one of the dock's panels, or close it again. */
  function openPanel(id: string) {
    setSpotlight(null);
    settings.keepDock({
      panels: settings.panels.includes(id)
        ? settings.panels.filter((open) => open !== id)
        : [...settings.panels, id],
    });
  }

  /**
   * Copy: what is selected and everything it hangs off, since a segment cannot
   * be pasted without its ends. The clipboard belongs to the app rather than to
   * this window, so a figure copied here pastes into another sketch.
   */
  function copySelection() {
    const taken = withFamily(objects, selection);
    if (taken.length === 0) return;
    window.api.objects.write(JSON.stringify(taken));
    setClipHeld(window.api.objects.peek());
  }

  /**
   * Select Parents and Select Children, one step up or down the family tree. An
   * object with none stays selected; one whose kin are hidden drops out.
   */
  function selectKin(way: "parents" | "children") {
    if (selection.length === 0) return;
    sketch.select(kinOf(objects, selection, way));
  }

  /** Cut is a copy and then a delete, which takes the images with it as ever. */
  function cutSelection() {
    copySelection();
    remove();
  }

  /**
   * Paste: the copy lands stepped off what it came from, with fresh names, and
   * comes out selected. Pasting again steps again, so two pastes give two.
   */
  function pasteObjects() {
    const held = window.api.objects.take();
    if (!held) return;
    let taken: SketchObject[];
    try {
      taken = JSON.parse(held.text) as SketchObject[];
    } catch {
      return;
    }
    sketch.addObjects(asPasted(taken, held.step));
  }

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

  /** Greyed when an entry has nothing to act on. */
  function isEnabled(action: MenuAction): boolean {
    // Nothing drawn is nothing to print, the same way nothing is to export.
    if (action === "print" || action === "print-preview") {
      return objects.some((object) => object.hidden !== true);
    }
    if (action === "cut" || action === "copy") return selection.length > 0;
    if (action === "select-parents" || action === "select-children") return selection.length > 0;
    if (action === "paste") return clipHeld !== null;
    if (action === "export-file" || action === "export-clipboard") {
      // Nothing drawn is nothing to export.
      return objects.some((object) => object.hidden !== true);
    }
    if (action.startsWith("button-")) {
      const form = action.slice("button-".length) as ButtonForm;
      return form === "link" ? sketch.pages.length > 0 : buttons.buttonWants(form).length > 0;
    }
    if (action === "split-merge") return moves.splitMerge !== null;
    if (action === "edit-definition") return numbers.editable() !== null;
    if (action === "define-custom") return canDefine(objects, selection);
    if (action === "edit-custom") return custom.customs.length > 0;
    if (action.startsWith("apply-transform:")) return transformable(selection, objects);
    if (action === "mark-mirror") return markableMirror(building) !== null;
    if (action === "mark-vector") return markableVector(building) !== null;
    if (action === "mark-angle") return markableAngle(building) !== null;
    if (action === "mark-ratio") return markableRatio(building) !== null;
    if (action === "mark-distance") return markableDistances(building).length > 0;
    if (action === "derivative") return numbers.chosenFunction() !== undefined;
    if (action === "tabulate") return numbers.chosenValues().length > 0;
    if (action === "add-table-data" || action === "remove-table-data") {
      return numbers.chosenTable() !== undefined;
    }
    if (action === "hide-objects") return selection.length > 0;
    if (action === "show-all-hidden") return objects.some((object) => object.hidden === true);
    if (action === "iterate") return canSeed(objects, selection);
    // Everything the Construct and Measure menus draw or write is answered by
    // whether there is anything to draw or write.
    const built = canBuild(building, action);
    if (built !== null) return built;
    // Every transform asks for what it turns about, or mirrors across, once it
    // is open, so all any of them needs is something it can act on.
    if (
      action === "translate" ||
      action === "rotate" ||
      action === "dilate" ||
      action === "reflect"
    ) {
      return transformable(selection, objects);
    }
    return true;
  }

  /** Deleting a page cannot be undone, so it is asked about first. */
  async function deletePage(id: string) {
    const page = sketch.pages.find((candidate) => candidate.id === id);
    if (!page) return;
    if (await window.api.pages.confirmDelete(page.name)) sketch.removePage(id);
  }

  useEffect(() => {
    if (!editing) return;
    const open = objects.find((object) => object.id === editing);
    if (!open || open.hidden === true) setEditing(null);
  }, [editing, objects]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the figure moves, which is what a row records
  useEffect(() => {
    const run = dialogs.collecting.current;
    if (!run) return;
    const table = objects.find((object) => object.id === run.table);
    if (!table || !isTable(table)) {
      dialogs.collecting.current = null;
      return;
    }
    const now = Date.now();
    if (now - run.at < 1000 / run.perSecond) return;
    const row = numbers.rowNow(table);
    const last = table.rows[table.rows.length - 1];
    // Only a change is worth a row. Without this the first move would fill the
    // table with the same numbers over and over.
    const moved =
      last === undefined ||
      last.some((cell, nth) => {
        const now = row[nth];
        if (cell === null || now === null) return cell !== now;
        return cell.value !== now.value;
      });
    if (!moved) return;
    run.at = now;
    run.left -= 1;
    if (run.left <= 0) dialogs.collecting.current = null;
    numbers.captureRow(table.id);
  }, [objects]);

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
    if (!editing || !editor.current) return;
    const opened = objects.find((object) => object.id === editing);
    if (!opened || !isCaption(opened) || opened.html !== "") return;
    for (const mark of ["bold", "italic", "underline"] as const) {
      if (!armed[mark]) continue;
      try {
        if (!document.queryCommandState(mark)) document.execCommand(mark);
      } catch {
        // A host without the command leaves the caption unmarked, which reads
        // the same as never having armed it.
      }
    }
  }, [editing]);

  useKeys({
    dialogOpen: moves.dialog !== null || dialogs.anyOpen,
    pickTool: setActiveTool,
    newSketch: doc.newSketch,
    openSketch: () => void doc.open(),
    saveSketch: () => void doc.save(),
    closeSketch: doc.close,
    quit: () => void doc.quit(),
    selectAll,
    cut: cutSelection,
    copy: copySelection,
    paste: pasteObjects,
    toggleLabels: naming.toggleLabels,
    togglePalette: () => settings.keepDock({ showPalette: !settings.showPalette }),
    showHidden: () =>
      naming.hideObjects(
        objects.filter((object) => object.hidden === true).map((object) => object.id),
        false,
      ),
    hide: () => naming.hideObjects(selection, true),
    selectKin,
    labelPanel: () => openPanel("labels"),
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
    editDefinition: () => {
      const found = numbers.editable();
      if (found) numbers.editValue(found);
    },
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
      setLabelPick([]);
    },
    escape: () => {
      setActiveTool("arrow");
      pickVariant("arrow", "all");
    },
    step: stepSelection,
  });

  return (
    <div className="app">
      {/* A tab has a title bar of its own, and no window to minimise, maximise
          or close, so GRASP draws none on the web. The document name and its
          star are in the tab title either way. */}
      {window.api.platform !== "web" && <TitleBar title={doc.title} />}
      <MenuBar
        openMenu={openMenu}
        onOpenMenu={(menu) => {
          setOpenMenu(menu);
          if (menu) {
            setRecent(window.api.file.recent());
            setClipHeld(window.api.objects.peek());
          } else setHovered(null);
        }}
        onHoverAction={setHovered}
        recent={recent}
        isTicked={(action) =>
          action === `point-size:${shared}` ||
          (action === "label-panel" && settings.panels.includes("labels")) ||
          (action === "hidden-panel" && settings.panels.includes("hidden")) ||
          (action === "palette" && settings.showPalette) ||
          (action === "snap-panel" && settings.panels.includes("snap"))
        }
        isEnabled={isEnabled}
        transforms={custom.customs.map((one) => ({ id: one.id, name: one.name }))}
        labels={moves.splitMerge ? { "split-merge": moves.splitMerge.label } : {}}
        onAsk={() => {
          dialogs.setScriptErrors([]);
          dialogs.setScriptWay("ask");
        }}
        onScript={() => {
          dialogs.setScriptErrors([]);
          dialogs.setScriptWay("script");
        }}
        onAction={(action) => {
          if (action === "new-sketch") doc.newSketch();
          else if (action === "open") void doc.open();
          else if (action === "about") dialogs.setAbout(true);
          else if (action === "preferences") settings.setDrafted(settings.prefs);
          else if (action === "page-setup") settings.setSetupOpen(true);
          else if (action === "document-options") dialogs.setDocOptions(true);
          else if (action === "print-preview") settings.setPreviewing(true);
          else if (action === "print") void settings.printPage();
          else if (action === "clear-recent") {
            void window.api.file.clearRecent();
            setRecent([]);
          } else if (action.startsWith("open-recent:")) {
            void doc.open(action.slice("open-recent:".length)).then(() => {
              setRecent(window.api.file.recent());
            });
          } else if (action === "save") void doc.save();
          else if (action === "save-as") void doc.saveAs();
          else if (action === "close") doc.close();
          else if (action === "quit") void doc.quit();
          else if (action === "undo") undo();
          else if (action === "redo") redo();
          else if (action === "clear") remove();
          else if (action === "cut") cutSelection();
          else if (action === "copy") copySelection();
          else if (action === "paste") pasteObjects();
          else if (action === "select-all") selectAll();
          else if (action === "select-parents") selectKin("parents");
          else if (action === "select-children") selectKin("children");
          else if (action === "show-labels") naming.toggleLabels();
          else if (action === "label-panel") openPanel("labels");
          else if (action === "hidden-panel") openPanel("hidden");
          else if (action === "palette") settings.keepDock({ showPalette: !settings.showPalette });
          else if (action === "snap-panel") openPanel("snap");
          else if (action === "export-file") dialogs.setExportTo("file");
          else if (action === "export-clipboard") dialogs.setExportTo("clipboard");
          else if (action === "hide-objects") naming.hideObjects(selection, true);
          else if (action === "show-all-hidden") {
            naming.hideObjects(
              objects.filter((object) => object.hidden === true).map((object) => object.id),
              false,
            );
          } else if (action.startsWith("button-")) {
            dialogs.setButtonDialog(action.slice("button-".length) as ButtonForm);
          } else if (action === "split-merge") moves.runSplitMerge();
          else if (action === "edit-definition") {
            const found = numbers.editable();
            if (found) numbers.editValue(found);
          } else if (action === "define-custom") dialogs.setCustomDialog("define");
          else if (action === "edit-custom") dialogs.setCustomDialog("edit");
          else if (action.startsWith("apply-transform:")) {
            custom.applyCustom(action.slice("apply-transform:".length));
          } else if (action.startsWith("mark-")) moves.mark(action);
          else if (action === "new-function") dialogs.setCalculator({ forFunction: true });
          else if (action === "derivative") numbers.defineDerivative();
          else if (action === "tabulate") numbers.tabulate();
          else if (action === "add-table-data") dialogs.setTableDialog("add");
          else if (action === "remove-table-data") dialogs.setTableDialog("remove");
          else if (action === "new-parameter") dialogs.setParameterDialog({});
          else if (action === "calculate") dialogs.setCalculator({});
          else if (action === "iterate") moves.openIterate();
          else if (BUILDS.has(action)) moves.construct(action);
          else if (
            action === "translate" ||
            action === "rotate" ||
            action === "dilate" ||
            action === "reflect"
          ) {
            moves.openDialog(action);
          } else {
            // One move: the selection is resized and the birth size is reset.
            const size = action.slice("point-size:".length) as PointSize;
            setPointSize(size);
            restyle(size);
          }
        }}
      />
      <div className="app__workspace">
        <Toolbox
          activeTool={activeTool}
          onShare={phone ? () => void doc.share() : undefined}
          onSelectTool={setActiveTool}
          variants={variants}
          onPickVariant={pickVariant}
          off={toolsOff}
          onDoubleClickTool={(tool) => {
            // Double-clicking the Text tool asks for a caption where the sheet
            // is, which is the other way to make one.
            if (tool === "text") setCaptionWanted((asked) => asked + 1);
          }}
        />
        <div
          className={`app__canvas${settings.showPalette ? " app__canvas--barred" : ""}`}
          style={canvasTokens(settings.showing.colours) as CSSProperties}
        >
          <Canvas
            activeTool={activeTool}
            cancelRef={cancelSheet}
            zoomable={settings.prefs.zoom === true}
            sketch={sketch}
            pointSize={pointSize}
            view={sketch.view}
            onView={sketch.setView}
            lineForm={(variants.straightedge ?? "segment") as LineForm}
            polygonKind={variants.polygon ?? "interior"}
            picking={moves.dialog !== null || dialogs.calculator !== null}
            onPick={moves.pick}
            preview={moves.preview}
            marks={moves.marks}
            onRename={naming.rename}
            onEditValue={numbers.editValue}
            onMarkMirror={moves.setMirror}
            onPressButton={buttons.pressButton}
            onCaptureRow={numbers.captureRow}
            onDropRow={(id) => numbers.dropRows(id, false)}
            onToggleLabel={(id) => {
              const object = objects.find((candidate) => candidate.id === id);
              naming.showLabels([id], object?.label?.shown !== true);
            }}
            spotlight={settings.panels.length === 0 ? null : spotlight}
            labelPick={labelPick}
            onLabelPick={(id, additive) => {
              if (id === null) {
                setLabelPick([]);
                return;
              }
              setLabelPick((was) => togglePick(was, id, additive === true));
            }}
            onViewport={setViewport}
            snapping={settings.snapping}
            measureKind={variants.measure ?? "length"}
            arrowKind={variants.arrow ?? "all"}
            markForm={variants.marker ?? "equal"}
            hiddenKinds={hiddenKinds}
            editing={editing}
            onEditing={setEditing}
            editor={editor}
            captionWanted={captionWanted}
            captionLook={palette.captionLook}
          />
          {settings.showPalette && (
            <Palette
              editor={editor}
              caption={palette.chosenCaption}
              text={palette.chosenText ?? palette.armedWriting}
              editing={editing !== null}
              labelMarks={palette.labelMarks}
              onLabelMark={(mark, on) => palette.styleLabel({ [mark]: on })}
              armedText={palette.armedMarks}
              onArmText={(change) => setArmed((was) => ({ ...was, ...change }))}
              onCaption={palette.styleWriting}
              styling={palette.styling}
              onStyle={palette.styleSelection}
            />
          )}
        </div>
        <Dock
          open={settings.panels}
          onToggle={openPanel}
          width={settings.dock.panelWidth}
          onWidth={(panelWidth) => settings.keepDock({ panelWidth })}
          panes={{
            labels: {
              count: `${named.filter((row) => row.shown).length} of ${named.length}`,
              body: (
                <LabelPanel
                  rows={named}
                  onRename={naming.rename}
                  onShow={naming.showLabels}
                  onSpot={setSpotlight}
                  labelNew={settings.labelNew}
                  onLabelNew={(on) => settings.keepDock({ labelNewPoints: on })}
                />
              ),
            },
            snap: {
              count: `${
                [
                  settings.snapping.objects,
                  settings.snapping.length,
                  settings.snapping.angle,
                  settings.snapping.moving,
                ].filter(Boolean).length
              } of 4`,
              body: <SnapPanel snapping={settings.snapping} onChange={settings.keepSnapping} />,
            },
            hidden: {
              count: `${away.length}`,
              body: (
                <HiddenPanel
                  kinds={hiddenKinds}
                  onKinds={(part) => setHiddenKinds((was) => ({ ...was, ...part }))}
                  rows={away}
                  onShow={(ids) => {
                    setSpotlight(null);
                    naming.hideObjects(ids, false);
                  }}
                  onSpot={setSpotlight}
                />
              ),
            },
          }}
        />
      </div>
      {phone && (
        <TouchBar
          canUndo={canUndo}
          onUndo={undo}
          canRedo={canRedo}
          onRedo={redo}
          snapping={settings.snapping.length || settings.snapping.angle}
          onSnapping={(on) => settings.keepSnapping({ length: on, angle: on })}
          onCancel={() => {
            cancelSheet.current();
            setActiveTool("arrow");
            pickVariant("arrow", "all");
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
        onExport={(to) => void exportPicture(to)}
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
