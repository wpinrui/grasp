import { type CSSProperties, useEffect, useState } from "react";
import { buttonActions } from "./app/buttons";
import { customActions } from "./app/customs";
import { Dialogs } from "./app/Dialogs";
import { labelActions } from "./app/labels";
import { Menus } from "./app/Menus";
import { paletteState } from "./app/palette";
import { useDialogs } from "./app/useDialogs";
import { useKeys } from "./app/useKeys";
import { prefsFrom, useSettings } from "./app/useSettings";
import { useTooling } from "./app/useTooling";
import { useTransforms } from "./app/useTransforms";
import { valueActions } from "./app/values";
import { Canvas } from "./components/Canvas";
import { Dock } from "./components/Dock";
import type { ExportTo } from "./components/ExportDialog";
import { HiddenPanel } from "./components/HiddenPanel";
import { LabelPanel } from "./components/LabelPanel";
import type { MenuAction } from "./components/menus";
import { PageBar } from "./components/PageBar";
import { Palette } from "./components/Palette";
import { NEW_PAGE } from "./components/ScriptDialog";
import { SnapPanel } from "./components/SnapPanel";
import { TitleBar } from "./components/TitleBar";
import { Toolbox } from "./components/Toolbox";
import { TouchBar } from "./components/TouchBar";
import { usePhone, useVisibleViewport } from "./phone";
import type { Building } from "./sketch/builds";
import { sheetOf } from "./sketch/measure";
import {
  asPasted,
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

  /** What the window has in hand: the tool, its arming, and what is being typed into. */
  const tools = useTooling();
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

  /**
   * Scripting. The prompt is built from the window as it is now, and a run
   * lands what the worker hands back in one commit, so a whole script is one
   * undo step. Nothing reaches a page unless the whole script comes good.
   */
  const scriptSheet = () => ({
    width: tools.viewport.width / sketch.view.scale,
    height: tools.viewport.height / sketch.view.scale,
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
      pointSize: tools.pointSize,
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
    tools.setSpotlight(null);
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
        undo={undo}
        redo={redo}
        remove={remove}
        restyle={restyle}
        selectAll={selectAll}
        cut={cutSelection}
        copy={copySelection}
        paste={pasteObjects}
        selectKin={selectKin}
        openPanel={openPanel}
      />
      <div className="app__workspace">
        <Toolbox
          activeTool={tools.activeTool}
          onShare={phone ? () => void doc.share() : undefined}
          onSelectTool={tools.setActiveTool}
          variants={tools.variants}
          onPickVariant={tools.pickVariant}
          off={tools.toolsOff}
          onDoubleClickTool={(tool) => {
            // Double-clicking the Text tool asks for a caption where the sheet
            // is, which is the other way to make one.
            if (tool === "text") tools.setCaptionWanted((asked) => asked + 1);
          }}
        />
        <div
          className={`app__canvas${settings.showPalette ? " app__canvas--barred" : ""}`}
          style={canvasTokens(settings.showing.colours) as CSSProperties}
        >
          <Canvas
            activeTool={tools.activeTool}
            cancelRef={tools.cancelSheet}
            zoomable={settings.prefs.zoom === true}
            sketch={sketch}
            pointSize={tools.pointSize}
            view={sketch.view}
            onView={sketch.setView}
            lineForm={(tools.variants.straightedge ?? "segment") as LineForm}
            polygonKind={tools.variants.polygon ?? "interior"}
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
            spotlight={settings.panels.length === 0 ? null : tools.spotlight}
            labelPick={tools.labelPick}
            onLabelPick={(id, additive) => {
              if (id === null) {
                tools.setLabelPick([]);
                return;
              }
              tools.setLabelPick((was) => togglePick(was, id, additive === true));
            }}
            onViewport={tools.setViewport}
            snapping={settings.snapping}
            measureKind={tools.variants.measure ?? "length"}
            arrowKind={tools.variants.arrow ?? "all"}
            markForm={tools.variants.marker ?? "equal"}
            hiddenKinds={tools.hiddenKinds}
            editing={tools.editing}
            onEditing={tools.setEditing}
            editor={tools.editor}
            captionWanted={tools.captionWanted}
            captionLook={palette.captionLook}
          />
          {settings.showPalette && (
            <Palette
              editor={tools.editor}
              caption={palette.chosenCaption}
              text={palette.chosenText ?? palette.armedWriting}
              editing={tools.editing !== null}
              labelMarks={palette.labelMarks}
              onLabelMark={(mark, on) => palette.styleLabel({ [mark]: on })}
              armedText={palette.armedMarks}
              onArmText={(change) => tools.setArmed((was) => ({ ...was, ...change }))}
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
                  onSpot={tools.setSpotlight}
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
                  kinds={tools.hiddenKinds}
                  onKinds={(part) => tools.setHiddenKinds((was) => ({ ...was, ...part }))}
                  rows={away}
                  onShow={(ids) => {
                    tools.setSpotlight(null);
                    naming.hideObjects(ids, false);
                  }}
                  onSpot={tools.setSpotlight}
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
