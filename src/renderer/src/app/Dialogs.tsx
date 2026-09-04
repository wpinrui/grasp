/**
 * Every modal the window can put up, and nothing else. Each one is its own
 * question: what a number holds, what a button does, what a page prints on.
 *
 * They are gathered here rather than in the window because none of them draws
 * anything until it is opened, and what each one needs is already gathered into
 * the handles below.
 */

import { AboutDialog } from "../components/AboutDialog";
import { ButtonDialog } from "../components/ButtonDialog";
import { CalculatorDialog } from "../components/CalculatorDialog";
import { DefineTransformDialog, EditTransformsDialog } from "../components/CustomTransformDialog";
import { DocumentOptionsDialog } from "../components/DocumentOptionsDialog";
import { ExportDialog, type ExportTo } from "../components/ExportDialog";
import { IterateDialog } from "../components/IterateDialog";
import { PageSetupDialog } from "../components/PageSetupDialog";
import { ParameterDialog } from "../components/ParameterDialog";
import { PreferencesDialog } from "../components/PreferencesDialog";
import { PrintPreviewDialog } from "../components/PrintPreviewDialog";
import { ScriptDialog } from "../components/ScriptDialog";
import { AddTableDataDialog, RemoveTableDataDialog } from "../components/TableDataDialog";
import { TransformDialog } from "../components/TransformDialog";
import type { Sheet } from "../sketch/expression";
import type { Sketch } from "../sketch/useSketch";
import type { Buttons } from "./buttons";
import type { Custom } from "./customs";
import { pagePicture, printPage } from "./printing";
import type { Dialogs as DialogState } from "./useDialogs";
import type { Settings } from "./useSettings";
import type { Moves } from "./useTransforms";
import type { Numbers } from "./values";

interface DialogsProps {
  dialogs: DialogState;
  numbers: Numbers;
  buttons: Buttons;
  custom: Custom;
  settings: Settings;
  moves: Moves;
  sketch: Sketch;
  /** What everything on the page is called. */
  names: Map<string, string>;
  /** The page as an expression reads it, for the Calculator's preview. */
  readable: Sheet;
  /** The prompt as the window would build it now. */
  buildPrompt: () => string;
  onRunScript: () => void;
  onExport: (to: ExportTo) => void;
}

export function Dialogs({
  dialogs,
  numbers,
  buttons,
  custom,
  settings,
  moves,
  sketch,
  names,
  readable,
  buildPrompt,
  onRunScript,
  onExport,
}: DialogsProps) {
  // Read out of the bundle so what is open narrows inside the callbacks below.
  const { exportTo } = dialogs;
  return (
    <>
      {dialogs.calculator && (
        <CalculatorDialog
          start={numbers.calculationHeld(dialogs.calculator.editing)}
          forFunction={dialogs.calculator.forFunction}
          lead={
            dialogs.calculator.editing
              ? (names.get(dialogs.calculator.editing) ?? "f")
              : numbers.nextFunctionName()
          }
          values={numbers.offeredValues()}
          functions={numbers.offeredFunctions()}
          named={numbers.namedInSketch}
          sheet={readable}
          names={names}
          insert={dialogs.insert}
          onInserted={() => dialogs.setInsert(null)}
          onNewParameter={() => dialogs.setParameterDialog({ fromCalculator: true })}
          quiet={dialogs.parameterDialog !== null}
          onApply={numbers.landCalculation}
          onCancel={() => dialogs.setCalculator(null)}
        />
      )}

      {dialogs.parameterDialog && (
        <ParameterDialog
          start={numbers.parameterHeld(dialogs.parameterDialog.editing)}
          angleUnit={settings.prefs.units.angle === "radians" ? "radians" : "degrees"}
          distanceUnit={settings.prefs.units.distance}
          onApply={numbers.landParameter}
          onCancel={() => dialogs.setParameterDialog(null)}
        />
      )}

      {dialogs.docOptions && (
        <DocumentOptionsDialog
          pages={sketch.pages}
          activeId={sketch.activeId}
          tabs={settings.prefs.pageTabs !== false}
          onShow={sketch.selectPage}
          onApply={(wanted, tabs) => {
            dialogs.setDocOptions(false);
            sketch.reshapePages(wanted);
            if (tabs !== (settings.prefs.pageTabs !== false)) {
              // The tabs are saved with the sketch, so the title bar has to say
              // there is something to save.
              settings.setPrefs({ ...settings.prefs, pageTabs: tabs });
              sketch.touch();
            }
          }}
          onCancel={() => dialogs.setDocOptions(false)}
        />
      )}

      {dialogs.buttonDialog && (
        <ButtonDialog
          form={dialogs.buttonDialog}
          count={buttons.buttonWants(dialogs.buttonDialog).length}
          pages={sketch.pages}
          onApply={buttons.landButton}
          onCancel={() => dialogs.setButtonDialog(null)}
        />
      )}

      {dialogs.customDialog === "define" && (
        <DefineTransformDialog
          onApply={custom.defineCustom}
          onCancel={() => dialogs.setCustomDialog(null)}
        />
      )}

      {dialogs.customDialog === "edit" && (
        <EditTransformsDialog
          transforms={custom.customs.map((one) => ({ id: one.id, name: one.name }))}
          onRename={custom.renameCustom}
          onDelete={custom.dropCustom}
          onClose={() => dialogs.setCustomDialog(null)}
        />
      )}

      {dialogs.tableDialog === "add" && (
        <AddTableDataDialog
          onApply={numbers.startAdding}
          onCancel={() => dialogs.setTableDialog(null)}
        />
      )}

      {dialogs.tableDialog === "remove" && (
        <RemoveTableDataDialog
          rows={numbers.chosenTable()?.rows.length ?? 0}
          onApply={(all) => {
            const table = numbers.chosenTable();
            dialogs.setTableDialog(null);
            if (table) numbers.dropRows(table.id, all);
          }}
          onCancel={() => dialogs.setTableDialog(null)}
        />
      )}

      {dialogs.scriptWay && (
        <ScriptDialog
          way={dialogs.scriptWay}
          request={dialogs.request}
          onRequest={dialogs.setRequest}
          script={dialogs.script}
          onScript={dialogs.setScript}
          target={dialogs.scriptTarget}
          onTarget={dialogs.setScriptTarget}
          pages={sketch.pages}
          buildPrompt={buildPrompt}
          onCopied={() => dialogs.setRequest("")}
          onRun={onRunScript}
          errors={dialogs.scriptErrors}
          running={dialogs.scriptRunning}
          onClose={() => dialogs.setScriptWay(null)}
        />
      )}

      {dialogs.about && <AboutDialog onClose={() => dialogs.setAbout(false)} />}
      {settings.drafted && (
        <PreferencesDialog
          prefs={settings.drafted}
          onChange={settings.setDrafted}
          toSketch={settings.scope.toSketch}
          toNew={settings.scope.toNew}
          onScope={(part) => settings.setScope((was) => ({ ...was, ...part }))}
          onApply={settings.applyPrefs}
          onCancel={() => settings.setDrafted(null)}
        />
      )}
      {settings.setupOpen && (
        <PageSetupDialog
          setup={settings.pageSetup}
          onChange={settings.keepPage}
          onApply={() => settings.setSetupOpen(false)}
          onCancel={() => settings.setSetupOpen(false)}
          onPreview={() => {
            settings.setSetupOpen(false);
            settings.setPreviewing(true);
          }}
        />
      )}
      {settings.previewing && (
        <PrintPreviewDialog
          setup={settings.pageSetup}
          picture={pagePicture(settings.pageSetup)}
          onPrint={() =>
            void printPage(settings.pageSetup, () => {
              settings.setSetupOpen(false);
              settings.setPreviewing(false);
            })
          }
          onSetup={() => {
            settings.setPreviewing(false);
            settings.setSetupOpen(true);
          }}
          onClose={() => settings.setPreviewing(false)}
        />
      )}
      {exportTo && (
        <ExportDialog
          to={exportTo}
          options={settings.picture}
          onChange={settings.keepPicture}
          onApply={() => onExport(exportTo)}
          onCancel={() => dialogs.setExportTo(null)}
        />
      )}
      {moves.dialog === "iterate" && (
        <IterateDialog
          targets={moves.targets}
          active={moves.nextSeed}
          depth={moves.depth}
          onDepth={moves.setDepth}
          canApply={moves.orbit.length > 0}
          onApply={moves.applyIterate}
          onCancel={() => moves.setDialog(null)}
        />
      )}
      {moves.transform && (
        <TransformDialog
          kind={moves.transform}
          values={moves.values}
          onChange={moves.setValues}
          marked={{
            angle: moves.follows.angle !== null,
            ratio: moves.follows.ratio !== null,
            distances: moves.follows.distances.length,
          }}
          canApply={moves.maker !== null}
          centred={moves.transform === "reflect" ? moves.mirror !== null : moves.centre !== null}
          onApply={moves.applyDialog}
          onCancel={() => moves.setDialog(null)}
        />
      )}
    </>
  );
}
