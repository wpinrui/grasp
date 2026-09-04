/**
 * The workspace: the toolbox down the side, the sheet itself, the palette under
 * it, and the dock of panels beside it.
 *
 * Everything here is about what is on screen while a figure is drawn. The
 * modals are not, and neither is the menu bar, so neither is here.
 */

import type { CSSProperties } from "react";
import { Canvas } from "../components/Canvas";
import { Dock } from "../components/Dock";
import { HiddenPanel, type HiddenRow } from "../components/HiddenPanel";
import { LabelPanel, type LabelRow } from "../components/LabelPanel";
import { Palette } from "../components/Palette";
import { SnapPanel } from "../components/SnapPanel";
import { Toolbox } from "../components/Toolbox";
import type { LineForm, SketchObject } from "../sketch/model";
import { togglePick } from "../sketch/picking";
import { canvasTokens } from "../sketch/prefs";
import type { useDocument } from "../sketch/useDocument";
import type { Sketch } from "../sketch/useSketch";
import type { Buttons } from "./buttons";
import type { Naming } from "./labels";
import type { Palette as PaletteBar } from "./palette";
import type { Dialogs } from "./useDialogs";
import type { Relabelling } from "./useRelabel";
import type { Settings } from "./useSettings";
import type { Tools } from "./useTooling";
import type { Moves } from "./useTransforms";
import type { Numbers } from "./values";

interface WorkspaceProps {
  sketch: Sketch;
  doc: ReturnType<typeof useDocument>;
  tools: Tools;
  settings: Settings;
  moves: Moves;
  dialogs: Dialogs;
  naming: Naming;
  relabel: Relabelling;
  numbers: Numbers;
  buttons: Buttons;
  palette: PaletteBar;
  objects: SketchObject[];
  /** The rows the labels panel lists, counted for its tab. */
  named: LabelRow[];
  /** The rows the hidden panel lists. */
  away: HiddenRow[];
  phone: boolean;
}

export function Workspace({
  sketch,
  doc,
  tools,
  settings,
  moves,
  dialogs,
  naming,
  relabel,
  numbers,
  buttons,
  palette,
  objects,
  named,
  away,
  phone,
}: WorkspaceProps) {
  return (
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
          labelKind={tools.variants.text ?? "caption"}
          relabelName={relabel.nextName}
          onRelabelAsk={relabel.ask}
          onRelabelGive={relabel.give}
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
        onToggle={settings.openPanel}
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
  );
}
