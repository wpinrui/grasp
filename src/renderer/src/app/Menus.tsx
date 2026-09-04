/**
 * The menu bar, what each entry does, and which entries are greyed.
 *
 * The three belong together: an entry that does nothing has to say so before it
 * is clicked, and both answers are read off the same handles. Everything the
 * window owns arrives as one of those handles rather than as thirty callbacks.
 */

import type { ButtonForm } from "../components/ButtonDialog";
import { MenuBar } from "../components/MenuBar";
import type { MenuAction } from "../components/menus";
import type { Building } from "../sketch/builds";
import { canBuild } from "../sketch/builds";
import { canDefine } from "../sketch/custom";
import { canSeed } from "../sketch/iterate";
import {
  markableAngle,
  markableDistances,
  markableMirror,
  markableRatio,
  markableVector,
} from "../sketch/markable";
import type { PointSize, SketchObject } from "../sketch/model";
import { transformable } from "../sketch/transforms";
import type { useDocument } from "../sketch/useDocument";
import type { Sketch } from "../sketch/useSketch";
import type { Buttons } from "./buttons";
import type { Clipboard } from "./clipboard";
import type { Custom } from "./customs";
import type { Naming } from "./labels";
import { printPage } from "./printing";
import type { Dialogs } from "./useDialogs";
import type { Settings } from "./useSettings";
import type { Moves } from "./useTransforms";
import type { Numbers } from "./values";

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

interface MenusProps {
  sketch: Sketch;
  doc: ReturnType<typeof useDocument>;
  dialogs: Dialogs;
  numbers: Numbers;
  naming: Naming;
  buttons: Buttons;
  custom: Custom;
  settings: Settings;
  moves: Moves;
  building: Building;
  objects: SketchObject[];
  selection: string[];
  /** Which menu is down, and what the pointer is over inside it. */
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
  setHovered: (action: MenuAction | null) => void;
  /** The sketches opened or saved most recently, read again as a menu opens. */
  recent: string[];
  setRecent: (recent: string[]) => void;
  /** What the object clipboard is holding, read again as a menu opens. */
  clipHeld: string | null;
  /** Undo and redo as the window does them, a relabel run stepping back too. */
  onUndo: () => void;
  onRedo: () => void;
  setClipHeld: (held: string | null) => void;
  /** The size the selection shares, which is what the menu ticks. */
  shared: PointSize | null;
  setPointSize: (size: PointSize) => void;
  /** Cut, copy, paste and walking the family tree. */
  clipboard: Clipboard;
}

export function Menus({
  sketch,
  doc,
  dialogs,
  numbers,
  naming,
  buttons,
  custom,
  settings,
  moves,
  building,
  objects,
  selection,
  openMenu,
  setOpenMenu,
  setHovered,
  recent,
  setRecent,
  clipHeld,
  setClipHeld,
  shared,
  setPointSize,
  clipboard,
  onUndo,
  onRedo,
}: MenusProps) {
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

  return (
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
        else if (action === "print") {
          void printPage(settings.pageSetup, () => {
            settings.setSetupOpen(false);
            settings.setPreviewing(false);
          });
        } else if (action === "clear-recent") {
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
        else if (action === "undo") onUndo();
        else if (action === "redo") onRedo();
        else if (action === "clear") sketch.remove();
        else if (action === "cut") clipboard.cutSelection();
        else if (action === "copy") clipboard.copySelection();
        else if (action === "paste") clipboard.pasteObjects();
        else if (action === "select-all") sketch.selectAll();
        else if (action === "select-parents") clipboard.selectKin("parents");
        else if (action === "select-children") clipboard.selectKin("children");
        else if (action === "show-labels") naming.toggleLabels();
        else if (action === "label-panel") settings.openPanel("labels");
        else if (action === "hidden-panel") settings.openPanel("hidden");
        else if (action === "palette") settings.keepDock({ showPalette: !settings.showPalette });
        else if (action === "snap-panel") settings.openPanel("snap");
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
          sketch.restyle(size);
        }
      }}
    />
  );
}
