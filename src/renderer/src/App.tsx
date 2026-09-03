import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { AboutDialog } from "./components/AboutDialog";
import { ButtonDialog, type ButtonForm } from "./components/ButtonDialog";
import { CalculatorDialog } from "./components/CalculatorDialog";
import { Canvas } from "./components/Canvas";
import { DefineTransformDialog, EditTransformsDialog } from "./components/CustomTransformDialog";
import { Dock } from "./components/Dock";
import { DocumentOptionsDialog } from "./components/DocumentOptionsDialog";
import { ExportDialog, type ExportTo } from "./components/ExportDialog";
import { type HiddenKinds, HiddenPanel, type HiddenRow } from "./components/HiddenPanel";
import { IterateDialog } from "./components/IterateDialog";
import { LabelClashDialog } from "./components/LabelClashDialog";
import { LabelPanel, type LabelRow } from "./components/LabelPanel";
import { MenuBar } from "./components/MenuBar";
import type { MenuAction } from "./components/menus";
import { PageBar } from "./components/PageBar";
import { PageSetupDialog } from "./components/PageSetupDialog";
import { type ArmedText, Palette, type Styling } from "./components/Palette";
import { ParameterDialog } from "./components/ParameterDialog";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { PrintPreviewDialog } from "./components/PrintPreviewDialog";
import { NEW_PAGE, ScriptDialog, type ScriptWay } from "./components/ScriptDialog";
import { SnapPanel, type Snapping } from "./components/SnapPanel";
import {
  type AddTableData,
  AddTableDataDialog,
  RemoveTableDataDialog,
} from "./components/TableDataDialog";
import { TitleBar } from "./components/TitleBar";
import { Toolbox } from "./components/Toolbox";
import { TouchBar } from "./components/TouchBar";
import { TransformDialog } from "./components/TransformDialog";
import { TOOLS } from "./components/tools";
import { DEFAULT_ALIGN, DEFAULT_CAPTION } from "./components/typeset";
import { usePhone, useVisibleViewport } from "./phone";
import {
  type Armed,
  DEFAULT_PATTERN,
  DEFAULT_WEIGHT,
  takesMarks,
  takesPattern,
  takesText,
  takesWeight,
  toolDraws,
} from "./sketch/armed";
import { type Building, canBuild, wouldBuild } from "./sketch/builds";
import { captionRowName } from "./sketch/captions";
import { canDefine, customImager } from "./sketch/custom";
import type { Expr } from "./sketch/expression";
import { canSeed, DEFAULT_DEPTH, iterated } from "./sketch/iterate";
import {
  markableAngle,
  markableDistances,
  markableMirror,
  markableRatio,
  markableVector,
} from "./sketch/markable";
import {
  inSheetTerms,
  readingOf,
  readingText,
  sayQuantity,
  sheetOf,
  writeIn,
} from "./sketch/measure";
import { landingSpots } from "./sketch/measured";
import {
  asPasted,
  type ButtonAction,
  createButton,
  createCalculation,
  createCustomTransform,
  createFunction,
  createParameter,
  createTable,
  DEFAULT_POINT_SIZE,
  isArc,
  isButton,
  isCalculation,
  isCaption,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isMeasurement,
  isParameter,
  isPoint,
  isTable,
  isTransform,
  isValue,
  kinOf,
  type LabelState,
  type LineForm,
  type LinePattern,
  type LineWidth,
  MAX_SAMPLES,
  MIN_SAMPLES,
  namesFor,
  type ParameterUnit,
  type PointSize,
  type Position,
  partsOfAngle,
  partsOfRatio,
  pathIn,
  SAMPLE_STEP,
  type SketchCaption,
  type SketchCircle,
  type SketchLine,
  type SketchObject,
  type SketchTable,
  setPickReach,
  settle,
  sharedPointSize,
  type TextLook,
  withDependents,
  withFamily,
} from "./sketch/model";
import { type PageSetup, PX_PER_CM, printableArea } from "./sketch/paper";
import { togglePick } from "./sketch/picking";
import { type Drawn, drawPicture, type PictureOptions, pictureSvg } from "./sketch/picture";
import { canvasTokens, type Prefs } from "./sketch/prefs";
import { buildPrompt } from "./sketch/prompt";
import { splitMerged, splitMergeFor } from "./sketch/relink";
import { rolesFor } from "./sketch/roles";
import { runScript } from "./sketch/script";
import {
  inkAgreed,
  isWritten,
  lookOf,
  lookOfLabel,
  marksOfLabels,
  type TextStyling,
  textStyling,
} from "./sketch/text";
import {
  DEFAULT_VALUES,
  imagedBy,
  type Marks,
  makerFor,
  NO_MARKS,
  type TransformKind,
  type TransformValues,
  transformable,
  transformed,
} from "./sketch/transforms";
import { useDocument } from "./sketch/useDocument";
import { useSketch } from "./sketch/useSketch";
import "./App.css";

/** The key each tool answers to, as the toolbox tooltips advertise it. */
const TOOL_KEYS = new Map(TOOLS.map((tool) => [tool.key.toLowerCase(), tool.id]));

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

/**
 * How long a Presentation button waits between the buttons it presses, in
 * milliseconds. One after another is only worth having if there is time to see
 * each one happen.
 */
const IN_TURN = 600;

/** The clear sheet left round a figure a sketch was opened framed on. */
const FRAME_MARGIN = 32;

/** How far framing will shrink a figure, matching the canvas's own floor. */
const MIN_FRAME_SCALE = 0.1;

type Held = ReturnType<typeof window.api.settings.read>;

/** What a new sketch starts on, out of what was remembered between runs. */
function prefsFrom(held: Held): Prefs {
  return {
    units: {
      angle: held.angleUnit,
      anglePlaces: held.anglePlaces,
      distance: held.distanceUnit,
      distancePlaces: held.distancePlaces,
      otherPlaces: held.otherPlaces,
    },
    colours: {
      point: held.colourPoint,
      path: held.colourPath,
      fill: held.colourFill,
      mark: held.colourMark,
      label: held.colourLabel,
      sheet: held.colourSheet,
    },
    text: { font: held.captionFont, size: held.captionSize },
  };
}

/** The same the other way round, for New Sketches to remember. */
function settingsFrom(prefs: Prefs): Partial<Held> {
  return {
    angleUnit: prefs.units.angle,
    anglePlaces: prefs.units.anglePlaces,
    distanceUnit: prefs.units.distance,
    distancePlaces: prefs.units.distancePlaces,
    otherPlaces: prefs.units.otherPlaces,
    colourPoint: prefs.colours.point,
    colourPath: prefs.colours.path,
    colourFill: prefs.colours.fill,
    colourMark: prefs.colours.mark,
    colourLabel: prefs.colours.label,
    colourSheet: prefs.colours.sheet,
    captionFont: prefs.text.font,
    captionSize: prefs.text.size,
  };
}

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
  /** The open dialog, and what its fields were last left holding. */
  const [dialog, setDialog] = useState<TransformKind | "iterate" | null>(null);
  /**
   * The Calculator: whether it is making a calculation or a function, and which
   * one it is changing where it is not a new one.
   */
  const [calculator, setCalculator] = useState<{
    forFunction?: boolean;
    editing?: string;
  } | null>(null);
  /**
   * New Parameter. It can be opened from the Calculator as well as from the
   * menu, and one opened that way drops the parameter it makes into the
   * expression, which is what `fromCalculator` is for.
   */
  const [parameterDialog, setParameterDialog] = useState<{
    editing?: string;
    fromCalculator?: boolean;
  } | null>(null);
  /** A name waiting to be dropped into the Calculator at its cursor. */
  const [insert, setInsert] = useState<string | null>(null);
  /**
   * What the sketch has marked for a transform to follow. It stays marked until
   * something of the same kind replaces it, so turning several things by the
   * same angle does not mean marking it again.
   */
  const [follows, setFollows] = useState<Marks>(NO_MARKS);
  /** The clicks collected so far, for a mark that takes more than one. */
  const marking = useRef<string[]>([]);
  /** Which of the two table dialogs is open, over the one table selected. */
  const [tableDialog, setTableDialog] = useState<"add" | "remove" | null>(null);
  /** Which of the two custom transform dialogs is open. */
  const [customDialog, setCustomDialog] = useState<"define" | "edit" | null>(null);
  /** The kind of action button being made, while its dialog is open. */
  const [buttonDialog, setButtonDialog] = useState<ButtonForm | null>(null);
  const [docOptions, setDocOptions] = useState(false);
  /**
   * A run of automatic collection: the table filling up, how many rows are
   * still wanted, how fast they may be taken, and when the last one was. It
   * ends of its own accord once the rows are in.
   */
  const collecting = useRef<{
    table: string;
    left: number;
    perSecond: number;
    at: number;
  } | null>(null);
  /** Which export is open, and so where its picture goes. */
  const [exportTo, setExportTo] = useState<ExportTo | null>(null);
  /** Whether the About box is up. */
  const [about, setAbout] = useState(false);
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
  const [values, setValues] = useState<TransformValues>(DEFAULT_VALUES);
  /**
   * The point Rotate and Dilate turn about. It belongs to the dialogs, which is
   * where it is picked, and it is kept between them so that turning several
   * things about the same point does not mean picking it every time.
   */
  const [centre, setCentre] = useState<string | null>(null);
  /** The straight object Reflect mirrors across, picked the same way. */
  const [mirror, setMirror] = useState<string | null>(null);
  /**
   * The dock as it was left last run, read on the first frame so the chrome
   * comes up in place rather than opening a default and correcting it.
   */
  const [dock, setDock] = useState(() => window.api.settings.read());
  const panels = dock.panels;
  /** Whether the palette bar is under the sheet. It comes up on. */
  const showPalette = dock.showPalette;
  /** Remembered as it changes, so quitting is not a thing to think about. */
  function keepDock(part: {
    panels?: string[];
    showPalette?: boolean;
    panelWidth?: number;
    labelNewPoints?: boolean;
    snapObjects?: boolean;
    snapLength?: boolean;
    snapLengthCm?: number;
    snapAngle?: boolean;
    snapAngleDegrees?: number;
    exportBackground?: PictureOptions["background"];
    exportInk?: PictureOptions["ink"];
    exportPoints?: boolean;
    exportFill?: PictureOptions["fill"];
    paper?: PageSetup["paper"];
    landscape?: boolean;
    marginCm?: number;
    printFit?: PageSetup["fit"];
    printInk?: PageSetup["ink"];
    printPoints?: boolean;
    printFill?: PageSetup["fill"];
  }) {
    setDock((was) => ({ ...was, ...part }));
    window.api.settings.write(part);
  }
  /**
   * Whether a new point comes out with its label showing. It stays where it is
   * left for as long as this sketch is open, and a sketch opened after it
   * starts wherever the toggle was last left anywhere, which is what was
   * remembered between runs.
   */
  const labelNew = dock.labelNewPoints;
  /**
   * What the drawing tools hold themselves to. It keeps itself the same way the
   * labels toggle does: where it is left for as long as this sketch is open,
   * and remembered so the next sketch starts where this one was left.
   */
  const snapping: Snapping = {
    objects: dock.snapObjects,
    length: dock.snapLength,
    lengthCm: dock.snapLengthCm,
    angle: dock.snapAngle,
    angleDegrees: dock.snapAngleDegrees,
    // A finger is nowhere near accurate enough for the steps to help while
    // dragging something that is already drawn, and a phone has no Snap panel
    // to turn it off with, so there it is off whatever a desk was left set to.
    moving: phone ? false : dock.snapMoving,
  };
  /**
   * How a picture is drawn. The dialog remembers the last used options for the
   * sketch that is open, and the most recent options are the ones a sketch
   * opened afterwards starts on.
   */
  const picture: PictureOptions = {
    background: dock.exportBackground,
    ink: dock.exportInk,
    points: dock.exportPoints,
    fill: dock.exportFill,
  };
  function keepPicture(next: PictureOptions) {
    keepDock({
      exportBackground: next.background,
      exportInk: next.ink,
      exportPoints: next.points,
      exportFill: next.fill,
    });
  }

  /**
   * What this sketch does by default. A new one starts on what Preferences was
   * last left set for new sketches; one opened from a file starts on whatever
   * it was saved under, which is why a sketch carries its own.
   */
  const [prefs, setPrefs] = useState<Prefs>(() => prefsFrom(window.api.settings.read()));
  /** What the dialog is holding while it is open, and where its changes land. */
  const [drafted, setDrafted] = useState<Prefs | null>(null);
  const [scope, setScope] = useState({ toSketch: true, toNew: false });
  const showing = drafted ?? prefs;
  // Every reading is written in this sketch's units, so they are set as it draws.
  writeIn(showing.units);
  // Save reads what the sketch is on now, not what it was on when it rendered.
  const prefsAt = useRef(prefs);
  prefsAt.current = prefs;

  /** OK: what was drafted goes to this sketch, to new sketches, or to both. */
  function applyPrefs() {
    const next = drafted ?? prefs;
    if (scope.toSketch) {
      setPrefs(next);
      // Preferences are saved with the sketch, so changing them changes the
      // sketch and the title bar has to say there is something to save.
      sketch.touch();
    }
    if (scope.toNew) window.api.settings.write(settingsFrom(next));
    setDrafted(null);
  }

  /** Whether Page Setup and Print Preview are up. */
  const [setupOpen, setSetupOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  /**
   * Page Setup: what a printed page is, and how the figure is drawn on it. It
   * belongs to the app rather than to any sketch, and it is remembered, so the
   * paper is set once and not again.
   */
  const pageSetup: PageSetup = {
    paper: dock.paper,
    landscape: dock.landscape,
    marginCm: dock.marginCm,
    fit: dock.printFit,
    ink: dock.printInk,
    points: dock.printPoints,
    fill: dock.printFill,
  };
  function keepPage(next: PageSetup) {
    keepDock({
      paper: next.paper,
      landscape: next.landscape,
      marginCm: next.marginCm,
      printFit: next.fit,
      printInk: next.ink,
      printPoints: next.points,
      printFill: next.fill,
    });
  }

  /**
   * The whole page as it will print: the sheet's own picture, drawn the way
   * Page Setup says, on nothing so the paper shows through. A selection is not
   * what is printed; the page is.
   */
  function pagePicture(): Drawn | null {
    return pictureSvg(
      {
        background: "transparent",
        ink: pageSetup.ink,
        points: pageSetup.points,
        fill: pageSetup.fill,
      },
      null,
    );
  }

  /** Print: the picture goes to the printer on the paper Page Setup says. */
  async function printPage() {
    const drawn = pagePicture();
    if (!drawn) return;
    setSetupOpen(false);
    setPreviewing(false);
    const area = printableArea(pageSetup);
    await window.api.print.page({
      svg: drawn.svg,
      paper: pageSetup.paper,
      landscape: pageSetup.landscape,
      margin: Math.round(pageSetup.marginCm * PX_PER_CM),
      toPage: pageSetup.fit === "page",
      width: drawn.width,
      height: drawn.height,
      area,
    });
  }

  /**
   * Export: the selection where there is one, and the whole page where there
   * is not. The picture goes over in both forms, since the save dialog is what
   * settles which one is written.
   */
  async function exportPicture(to: ExportTo) {
    setExportTo(null);
    const wanted = selection.length > 0 ? new Set(selection) : null;
    try {
      const drawn = await drawPicture(picture, wanted);
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

  function keepSnapping(part: Partial<Snapping>) {
    keepDock({
      ...(part.objects === undefined ? {} : { snapObjects: part.objects }),
      ...(part.length === undefined ? {} : { snapLength: part.length }),
      ...(part.lengthCm === undefined ? {} : { snapLengthCm: part.lengthCm }),
      ...(part.angle === undefined ? {} : { snapAngle: part.angle }),
      ...(part.angleDegrees === undefined ? {} : { snapAngleDegrees: part.angleDegrees }),
      ...(part.moving === undefined ? {} : { snapMoving: part.moving }),
    });
  }
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
  /**
   * The scripting modal: which button opened it, what was asked for, the script
   * last put in the box, and where a run is to draw. The request and the script
   * outlive the modal being shut, so neither is lost by closing it.
   */
  const [scriptWay, setScriptWay] = useState<ScriptWay | null>(null);
  const [request, setRequest] = useState("");
  const [script, setScript] = useState("");
  const [scriptTarget, setScriptTarget] = useState<string>(NEW_PAGE);
  const [scriptErrors, setScriptErrors] = useState<string[]>([]);
  const [scriptRunning, setScriptRunning] = useState(false);
  /** The caption being typed into. It belongs to the window, not to the page. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Where the text palette reaches the caption being typed into. */
  const editor = useRef<HTMLDivElement | null>(null);
  /** Counted up by a double-click on the Text tool, which asks for a caption. */
  const [captionWanted, setCaptionWanted] = useState(0);
  /** A rename waiting on what to do about the name already being in use. */
  const [clash, setClash] = useState<{ id: string; name: string; holder: string } | null>(null);
  /** Iterate's map: the seeds it was opened on, and where each one goes. */
  const [seeds, setSeeds] = useState<string[]>([]);
  const [targets, setTargets] = useState<(string | null)[]>([]);
  const [depth, setDepth] = useState(DEFAULT_DEPTH);
  const sketch = useSketch();
  const { undo, redo, canUndo, canRedo, remove, restyle, selectAll } = sketch;
  // Whether a point that lands says its name straight away, told to the sketch
  // rather than read there, since every way of making a point goes through it.
  sketch.labelNewPoints(labelNew);
  const doc = useDocument(sketch, {
    read: () => prefsAt.current,
    onOpen: (opened) => setPrefs(opened ?? prefsFrom(window.api.settings.read())),
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

  // What the open dialog would make, worked out fresh on every keystroke and
  // every pick. Nothing to show means it cannot be answered yet, which is also
  // what greys its button.
  const transform = dialog === "iterate" ? null : dialog;
  const maker =
    transform && transformable(selection, objects)
      ? makerFor(transform, { values, objects, centre, mirror, marks: follows })
      : null;
  const orbit = dialog === "iterate" ? iterated(objects, { seeds, targets, depth }) : [];
  const preview: SketchObject[] = maker
    ? transformed(selection, maker, { objects, size: pointSize })
    : dialog
      ? orbit
      : // No dialog: the sheet shows what the Construct entry under the pointer
        // would build, so hovering Ray says which way it would run.
        wouldBuild(building, hovered);
  /** The row an Iterate click fills: the first empty one, then round again. */
  const nextSeed = Math.max(targets.indexOf(null), 0);

  const named = labelRows();
  const away = hiddenRows();

  /**
   * The caption the palette works on: the one open, or the one picked on the
   * sheet when nothing is open. Nothing to work on greys the palette out.
   */
  const captions = objects.filter(isCaption);
  const chosenCaption =
    captions.find((caption) => caption.id === editing) ??
    (selection.length === 1 ? (captions.find((one) => one.id === selection[0]) ?? null) : null);

  /**
   * The labels the palette is set on: the ones picked on the sheet. A label
   * that has since been hidden or whose object has gone is no longer there to
   * set. Anything selected wins, and so does a caption open to type into, since
   * the bar is then set on what the caret is in.
   */
  const chosenLabels =
    selection.length === 0 && editing === null
      ? objects.filter((object) => labelPick.includes(object.id) && object.label?.shown === true)
      : [];
  const labelsPicked = chosenLabels.length > 0;

  /**
   * Everything the palette would set: what is selected, and the caption being
   * typed into, which takes the bar along with it.
   */
  const written = editing ? objects.find((object) => object.id === editing) : undefined;
  const picked = written && !selection.includes(written.id) ? [...selected, written] : selected;

  /**
   * The writing among it: everything picked that carries a face and a size,
   * whatever kind of object it is. A reading, a parameter, a calculation, a
   * function, a table and a button are all set the way a caption is, so the row
   * reaches them all.
   */
  const writing = picked.filter(isWritten);

  /**
   * How whatever the palette is set on reads now, and what of it that writing
   * agrees about. Null when there is nothing to set.
   */
  const chosenText: TextStyling | null = labelsPicked
    ? textStyling(
        chosenLabels.map((object) => lookOfLabel(object.label ?? {}, prefs.colours.label)),
      )
    : textStyling(writing.map(lookOf));

  /** The three style keys over the picked labels, or null when none is picked. */
  const labelMarks = labelsPicked
    ? marksOfLabels(chosenLabels.map((object) => object.label ?? {}))
    : null;

  /** What a pick shares, or null where it does not share one, over any list. */
  const agreed = <T,>(
    over: SketchObject[],
    read: (object: SketchObject) => T | undefined,
  ): T | null => {
    if (over.length === 0) return null;
    const first = read(over[0]);
    if (first === undefined) return null;
    return over.every((object) => read(object) === first) ? first : null;
  };

  const stroked = selected.filter(
    (object) => isLine(object) || isCircle(object) || isArc(object) || isLocus(object),
  );
  /**
   * What the tool that is up draws, which is what the palette arms. The Arrow
   * draws nothing, so under it the bar is on the selection alone.
   */
  const draws = toolDraws(activeTool, variants.polygon ?? "interior");
  // Told to the sketch rather than read there, since every way an object lands
  // goes through it and each one should come out the way the bar says.
  sketch.armStyle(draws.length > 0 ? { armed, kinds: draws } : null);

  /** What GRASP draws each kind in until something says otherwise. */
  function defaultColour(kind: string): string {
    if (kind === "point") return prefs.colours.point;
    if (kind === "interior") return prefs.colours.fill;
    if (kind === "mark") return prefs.colours.mark;
    if (kind === "caption" || kind === "measurement") return DEFAULT_CAPTION.colour;
    return prefs.colours.path;
  }

  /** What of the top row the selection itself has anything to say about. */
  const chosenWeighs = stroked.length > 0 || selected.some(isMark);
  const chosenPatterns = stroked.length > 0;

  /**
   * What the palette's top row is set on: what the pick shares, and what of the
   * three it can take at all. A stroked object takes a weight and a pattern, a
   * mark takes a weight but has no pattern, and a fill or a point takes neither.
   */
  const styling: Styling = labelsPicked
    ? {
        // A label is written rather than stroked, so the ink is all of the top
        // row it can take.
        colour: chosenText?.colour ?? null,
        weight: null,
        pattern: null,
        canColour: true,
        canWeight: false,
        canPattern: false,
      }
    : {
        // Each control on its own, not the bar as a whole: the selection where
        // it can take that one, and what the tool draws next where it cannot.
        // A point selected under the straightedge says nothing about weight,
        // but the segment about to be drawn does, so the row stays live and
        // arms the tool instead of greying out.
        //
        // The ink is judged over everything it would land on, writing included,
        // so a red segment picked with a black caption lights neither.
        colour:
          picked.length > 0
            ? inkAgreed(picked)
            : (armed.colour ?? (draws.length > 0 ? defaultColour(draws[0]) : null)),
        weight: chosenWeighs
          ? agreed(selected, (object) => object.weight)
          : (armed.weight ?? (takesWeight(draws) ? DEFAULT_WEIGHT : null)),
        pattern: chosenPatterns
          ? agreed(selected, (object) => object.pattern)
          : (armed.pattern ?? (takesPattern(draws) ? DEFAULT_PATTERN : null)),
        canColour: picked.length > 0 || draws.length > 0,
        canWeight: chosenWeighs || takesWeight(draws),
        canPattern: chosenPatterns || takesPattern(draws),
      };

  /** How every picked label is set, as one undo step. */
  function styleLabel(change: Partial<LabelState>) {
    const setting = new Set(chosenLabels.map((object) => object.id));
    if (setting.size === 0) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        setting.has(object.id) ? { ...object, label: { ...object.label, ...change } } : object,
      ),
    });
  }

  /**
   * What the text row is on with nothing selected: the face, the size and the
   * ink the tool that writes has been armed with, or what a new one comes out
   * in where it has not been touched.
   */
  const armedWriting: TextStyling | null = takesText(draws)
    ? textStyling([
        {
          font: armed.font ?? prefs.text.font,
          size: armed.size ?? prefs.text.size,
          colour: armed.colour ?? DEFAULT_CAPTION.colour,
        },
      ])
    : null;

  /**
   * The rest of how the next caption comes out: the three style keys and the
   * ranging. Only a caption carries them, so the tool that writes readings arms
   * the face and the size and no more.
   */
  const armedMarks: ArmedText | null = takesMarks(draws)
    ? {
        bold: armed.bold ?? false,
        italic: armed.italic ?? false,
        underline: armed.underline ?? false,
        align: armed.align ?? DEFAULT_ALIGN,
      }
    : null;

  /**
   * How a caption the Text tool draws comes out: what Preferences says a new one
   * is set in, with whatever the palette has armed over the top. Worked out here
   * rather than where the caption is made, since the arming lives with the bar.
   */
  const captionLook = {
    font: armed.font ?? prefs.text.font,
    size: armed.size ?? prefs.text.size,
    colour: armed.colour ?? DEFAULT_CAPTION.colour,
    align: armed.align ?? DEFAULT_ALIGN,
  };

  /**
   * How every selected object is drawn, as one undo step. A caption being
   * written into counts as selected, since the palette is set on it too.
   */
  function styleSelection(change: { colour?: string; weight?: LineWidth; pattern?: LinePattern }) {
    // A picked label takes the ink and nothing else, and takes it on its own:
    // it is not what the tool is about to draw.
    if (labelsPicked) {
      if (change.colour !== undefined) styleLabel({ colour: change.colour });
      return;
    }
    // Setting the bar also arms the tool, so restyling what was just drawn says
    // how the next one comes out as well.
    if (draws.length > 0) setArmed((was) => ({ ...was, ...change }));
    const wanted = new Set(selection);
    if (editing) wanted.add(editing);
    if (wanted.size === 0) return;
    const before = sketch.read();
    // A key goes only on what can take it, since the row is live for the tool
    // as well as for the selection: a weight set with a point selected and the
    // straightedge up arms the tool and leaves the point where it is.
    let touched = false;
    const after = before.objects.map((object) => {
      if (!wanted.has(object.id)) return object;
      const fits: typeof change = {};
      if (change.colour !== undefined) fits.colour = change.colour;
      if (change.weight !== undefined && takesWeight([object.kind])) fits.weight = change.weight;
      if (change.pattern !== undefined && takesPattern([object.kind]))
        fits.pattern = change.pattern;
      if (Object.keys(fits).length === 0) return object;
      touched = true;
      return { ...object, ...fits };
    });
    // Nothing selected could take it, so there is nothing to undo either.
    if (!touched) return;
    sketch.commit({ ...before, objects: after });
  }

  /**
   * The palette changing how writing is set, as one undo step. Face, size and
   * ink reach every selected object that carries them, whatever kind it is,
   * since they are all set the same way; the rest of the palette belongs to a
   * caption, which is the only writing with runs to range and notation to type
   * into.
   */
  function styleWriting(change: Partial<SketchCaption>) {
    if (labelsPicked) {
      const { font, size, colour } = change;
      styleLabel({
        ...(font !== undefined ? { font } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(colour !== undefined ? { colour } : {}),
      });
      return;
    }
    // The same as the top row: setting the face or the size also arms the tool
    // that writes, so the next caption comes out set that way.
    if (takesText(draws)) {
      const arming: Armed = {};
      if (change.font !== undefined) arming.font = change.font;
      if (change.size !== undefined) arming.size = change.size;
      if (change.colour !== undefined) arming.colour = change.colour;
      if (change.align !== undefined && takesMarks(draws)) arming.align = change.align;
      if (Object.keys(arming).length > 0) setArmed((was) => ({ ...was, ...arming }));
    }
    const look: Partial<TextLook> = {};
    if (change.font !== undefined) look.font = change.font;
    if (change.size !== undefined) look.size = change.size;
    if (change.colour !== undefined) look.colour = change.colour;
    // The face, the size and the ink go to every piece of writing that is
    // picked; the rest of the change is a caption's alone.
    const spread = Object.keys(look).length > 0 ? new Set(writing.map((one) => one.id)) : null;
    if (!chosenCaption && !spread?.size) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (chosenCaption && object.id === chosenCaption.id && isCaption(object)) {
          return { ...object, ...change };
        }
        if (spread?.has(object.id) && isWritten(object)) return { ...object, ...look };
        return object;
      }),
    });
  }

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
    const editing = scriptTarget !== NEW_PAGE;
    const page = sketch.pages.find((one) => one.id === scriptTarget);
    return buildPrompt({
      request,
      sheet: scriptSheet(),
      target:
        editing && page
          ? { kind: "edit", page: page.name, objects: sketch.objectsOn(page.id) }
          : { kind: "new" },
    });
  }

  async function runTheScript() {
    setScriptRunning(true);
    setScriptErrors([]);
    const wanted = sketch.pages.find((one) => one.id === scriptTarget);
    // The page a script works on is the page it is run from, so GRASP goes
    // there first and the objects it hands back are committed where they land.
    if (wanted) sketch.selectPage(wanted.id);
    else sketch.addPage();
    const before = sketch.read();
    const result = await runScript(script, {
      objects: before.objects,
      sheet: scriptSheet(),
      pointSize: pointSize,
    });
    setScriptRunning(false);
    if (!result.ok) {
      setScriptErrors(result.errors);
      return;
    }
    sketch.commit({ objects: result.objects, selection: [] });
    setScriptErrors([]);
    setScriptWay(null);
  }

  const marks = [
    // Hovering Interior: the corners numbered in the order they were picked,
    // since that order is the whole reason the fill comes out the shape it does.
    ...(hovered === "interior" && preview.length > 0
      ? chosenPoints.map((point, index) => ({ id: point.id, label: `${index + 1}` }))
      : []),
    // Hovering anything else that gives its objects different jobs: each one
    // says which job it has, so the order they were picked in is visible
    // before the entry is clicked rather than after.
    ...(preview.length > 0 ? rolesFor(building, hovered) : []),
    // The centre and the mirror are only ever shown while the dialog that uses
    // them is open.
    ...(centre && (dialog === "rotate" || dialog === "dilate")
      ? [{ id: centre, label: "CENTER" }]
      : []),
    ...(mirror && dialog === "reflect" ? [{ id: mirror, label: "MIRROR" }] : []),
    ...(dialog === "iterate"
      ? [
          ...seeds.map((id, index) => ({ id, label: `SEED ${index + 1}` })),
          ...targets.flatMap((id, index) => (id ? [{ id, label: `IMAGE ${index + 1}` }] : [])),
        ]
      : []),
    ...(dialog === "translate" && values.translate.mode === "marked"
      ? [
          ...(values.translate.from ? [{ id: values.translate.from, label: "FROM" }] : []),
          ...(values.translate.to ? [{ id: values.translate.to, label: "TO" }] : []),
        ]
      : []),
  ];

  // The key handler is bound once, so it reaches these through refs rather
  // than through a closure it would have to be rebound to keep fresh.
  const dialogOpen = useRef(false);
  dialogOpen.current =
    dialog !== null ||
    calculator !== null ||
    parameterDialog !== null ||
    tableDialog !== null ||
    customDialog !== null ||
    buttonDialog !== null ||
    scriptWay !== null ||
    docOptions;
  const midpoint = useRef(() => {});
  midpoint.current = () => construct("midpoint");
  const segment = useRef(() => {});
  segment.current = () => construct("segment");
  const cross = useRef(() => {});
  cross.current = () => construct("intersection");
  const customKeys = useRef((nth: number) => {
    void nth;
  });
  customKeys.current = (nth) => {
    const found = customs[nth];
    if (found) applyCustom(found.id);
  };
  const editDefinition = useRef(() => {});
  editDefinition.current = () => {
    const found = editable();
    if (found) editValue(found);
  };
  const docKeys = useRef(() => {});
  docKeys.current = () => setDocOptions(true);
  const newParameter = useRef(() => {});
  newParameter.current = () => setParameterDialog({});
  const calculate = useRef(() => {});
  calculate.current = () => setCalculator({});
  const fill = useRef(() => {});
  fill.current = () => construct("interior");
  const samples = useRef((step: number) => {
    void step;
  });
  samples.current = stepSelection;
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

  const clipKeys = useRef({ copy: () => {}, cut: () => {}, paste: () => {} });
  clipKeys.current = { copy: copySelection, cut: cutSelection, paste: pasteObjects };
  const paletteKey = useRef(() => {});
  paletteKey.current = () => keepDock({ showPalette: !showPalette });
  const kinKeys = useRef((way: "parents" | "children") => {
    void way;
  });
  kinKeys.current = selectKin;
  const labels = useRef(() => {});
  labels.current = toggleLabels;
  const hide = useRef(() => {});
  const removeKey = useRef(() => {});
  hide.current = () => hideObjects(selection, true);
  // Del on a picked label takes the label off and leaves what it names. With
  // no label picked it deletes the selection, the way it always has.
  removeKey.current = () => {
    if (!labelsPicked) {
      remove();
      return;
    }
    styleLabel({ shown: false });
    setLabelPick([]);
  };
  const showHidden = useRef(() => {});
  showHidden.current = () =>
    hideObjects(
      objects.filter((object) => object.hidden === true).map((object) => object.id),
      false,
    );
  const panelKey = useRef((id: string) => {
    void id;
  });
  panelKey.current = (id: string) => {
    setSpotlight(null);
    keepDock({
      panels: panels.includes(id) ? panels.filter((open) => open !== id) : [...panels, id],
    });
  };

  /**
   * Marking by clicking while a transform dialog is open, which is how the
   * reference marks one without leaving the dialog. What a click means depends
   * on what the dialog has been told to follow. Answers whether it took it.
   */
  function markFromSheet(hit: SketchObject): boolean {
    const wantsAngle =
      (dialog === "rotate" && values.rotate.marked) ||
      (dialog === "translate" && values.translate.markedAngle);
    const wantsRatio = dialog === "dilate" && values.dilate.marked;
    const wantsOneDistance = dialog === "translate" && values.translate.markedDistance;
    const wantsTwoDistances = dialog === "translate" && values.translate.markedPair;
    const held = geometry.values.get(hit.id) ?? null;
    const bare = held !== null && held.length === 0 && held.angle === 0;
    const isAngleValue = held !== null && held.angle === 1 && held.length === 0;
    const isDistanceValue = held !== null && held.length === 1 && held.angle === 0;

    if (wantsAngle) {
      // An angle marker is three points: an arm, the corner, the other arm.
      if (isMark(hit) && "corner" in hit) {
        setFollows({
          ...follows,
          angle: { kind: "points", a: hit.arms[0], corner: hit.corner, b: hit.arms[1] },
        });
        return true;
      }
      if (isAngleValue) {
        setFollows({ ...follows, angle: { kind: "value", of: hit.id } });
        return true;
      }
    }
    if (wantsRatio) {
      if (bare) {
        setFollows({ ...follows, ratio: { kind: "value", of: hit.id } });
        return true;
      }
      // Two segments, clicked one after the other: the first over the second.
      if (isLine(hit) && hit.form === "segment") {
        const got = [...marking.current, hit.id];
        if (got.length < 2) {
          marking.current = got;
          return true;
        }
        marking.current = [];
        setFollows({ ...follows, ratio: { kind: "segments", top: got[0], bottom: got[1] } });
        return true;
      }
    }
    if ((wantsOneDistance || wantsTwoDistances) && isDistanceValue) {
      const wanted = wantsTwoDistances ? 2 : 1;
      const got = [...marking.current, hit.id];
      if (got.length < wanted) {
        marking.current = got;
        return true;
      }
      marking.current = [];
      setFollows({ ...follows, distances: got });
      return true;
    }
    return false;
  }

  /**
   * What Split/Merge would do with the selection as it stands, which is also
   * what the entry calls itself rather than naming both halves at once.
   */
  const splitMerge = splitMergeFor(objects, selection);

  function runSplitMerge() {
    if (!splitMerge) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: splitMerged(before.objects, splitMerge, {
        settled: geometry,
        paths: (id: string) => pathIn(geometry, id),
      }),
      // The point it acted on stays picked, since it is what you are working
      // on. Merging two leaves the one that survived.
      selection: [splitMerge.kind === "join" ? splitMerge.to : splitMerge.point],
    });
  }

  /** What a new action button would act on, which the menu greys out without. */
  function buttonWants(form: ButtonForm): string[] {
    if (form === "hide-show") return selection;
    if (form === "scroll") return chosenPoints.length === 1 ? [chosenPoints[0].id] : [];
    if (form === "present") return selected.filter(isButton).map((one) => one.id);
    return [];
  }

  /** A new button, holding what was selected when it was made. */
  function landButton(name: string, does: ButtonAction) {
    const form = does.form;
    setButtonDialog(null);
    const wants = buttonWants(form);
    if (form !== "link" && wants.length === 0) return;
    const filled: ButtonAction =
      does.form === "scroll"
        ? { ...does, point: wants[0] }
        : does.form === "link"
          ? does
          : { ...does, of: wants };
    sketch.addObjects([createButton(name, filled, valueSpot())]);
  }

  /**
   * Pressing one. A Presentation button presses the others, so this reaches
   * back into itself; the ids it holds cannot include itself, since it was made
   * after them, so it always comes to a stop.
   */
  function pressButton(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found || !isButton(found)) return;
    const does = found.does;
    if (does.form === "hide-show") {
      // A toggle reads the sheet rather than remembering: everything away means
      // bring it back, and anything showing means put it away.
      const away = does.of.every(
        (one) => objects.find((object) => object.id === one)?.hidden === true,
      );
      const hiding = does.does === "toggle" ? !away : does.does === "hide";
      hideObjects(does.of, hiding);
      return;
    }
    if (does.form === "link") {
      sketch.selectPage(does.page);
      return;
    }
    if (does.form === "scroll") {
      const spot = geometry.points.get(does.point);
      if (!spot) return;
      const { scale } = sketch.view;
      const across = does.to === "centre" ? viewport.width / scale / 2 : 0;
      const down = does.to === "centre" ? viewport.height / scale / 2 : 0;
      sketch.setView({ ...sketch.view, x: spot.x - across, y: spot.y - down });
      return;
    }
    if (does.order === "together") {
      for (const one of does.of) pressButton(one);
      return;
    }
    // One after another, with a pause between, so a presentation can be
    // followed rather than happening all at once.
    does.of.forEach((one, nth) => {
      window.setTimeout(() => pressButton(one), nth * IN_TURN);
    });
  }

  /** The custom transforms this page holds, in the order they were defined. */
  const customs = objects.filter(isTransform);

  /** Define Custom Transform: the example is the selection, so it wants a name. */
  function defineCustom(name: string) {
    setCustomDialog(null);
    if (!canDefine(objects, selection)) return;
    // The seed keeps the selection, since it is still what the example is on.
    sketch.addObjects([createCustomTransform(name, selection[0], selection[1])], selection);
  }

  /**
   * Applying one: every point of the selection goes through the whole example
   * again, and what the selection holds is rebuilt on the images, exactly as a
   * rotation rebuilds it.
   */
  function applyCustom(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found || !isTransform(found)) return;
    const made = imagedBy(selection, objects, customImager(found, objects));
    if (made.length > 0) sketch.addObjects(made);
  }

  /**
   * Taking one off the menu. Nothing hangs off the transform itself, since what
   * it made hangs off the example's points, so its images stay where they are
   * and stay live.
   */
  function dropCustom(id: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.filter((object) => object.id !== id),
      selection: before.selection.filter((held) => held !== id),
    });
  }

  function renameCustom(id: string, name: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isTransform(object) ? { ...object, name } : object,
      ),
    });
  }

  /** A Mark entry, which sets what future transforms follow and leaves the selection alone. */
  function mark(action: MenuAction) {
    if (action === "mark-mirror") {
      const found = markableMirror(building);
      if (found) setMirror(found);
      return;
    }
    if (action === "mark-vector") {
      const ends = markableVector(building);
      if (ends)
        setValues({ ...values, translate: { ...values.translate, from: ends[0], to: ends[1] } });
      return;
    }
    if (action === "mark-angle") {
      const angle = markableAngle(building);
      if (angle) setFollows({ ...follows, angle });
      return;
    }
    if (action === "mark-ratio") {
      const ratio = markableRatio(building);
      if (ratio) setFollows({ ...follows, ratio });
      return;
    }
    const distances = markableDistances(building);
    if (distances.length > 0) setFollows({ ...follows, distances });
  }

  /**
   * What is still marked: a mark whose objects have been deleted is no mark at
   * all, the same rule the centre and the mirror already follow.
   */
  function livingMarks(): Marks {
    const there = (id: string) => objects.some((object) => object.id === id);
    return {
      angle: follows.angle && partsOfAngle(follows.angle).every(there) ? follows.angle : null,
      ratio: follows.ratio && partsOfRatio(follows.ratio).every(there) ? follows.ratio : null,
      distances: follows.distances.every(there) ? follows.distances : [],
    };
  }

  /** A click on the sheet while a dialog is open feeds the dialog. */
  function pick(id: string) {
    const hit = objects.find((object) => object.id === id);
    if (!hit) return;
    // The Calculator takes numbers off the sheet, which is quicker than
    // spelling their names and is how the reference app does it too.
    if (calculator) {
      if (isValue(hit)) setInsert(names.get(hit.id) ?? null);
      return;
    }
    // Reflect wants a straight object to mirror across; everything else wants
    // a point, so a click on the wrong kind of thing is left alone.
    if (markFromSheet(hit)) return;
    if (dialog === "reflect") {
      if (!isPoint(hit)) setMirror(id);
      return;
    }
    if (!isPoint(hit)) return;
    if (dialog === "iterate") {
      setTargets(targets.map((target, index) => (index === nextSeed ? id : target)));
      return;
    }
    if (dialog !== "translate" || values.translate.mode !== "marked") {
      setCentre(id);
      return;
    }
    const vector = values.translate;
    // First click is From, the next is To, a third starts again from From.
    const ends = vector.from === null || vector.to !== null ? { from: id, to: null } : { to: id };
    setValues({ ...values, translate: { ...vector, ...ends } });
  }

  /** Where a new number lands: the stack the Measure menu writes into. */
  function valueSpot(): Position {
    return landingSpots(building, 1)[0];
  }

  /** The sketch as an expression reads it, for the Calculator's preview. */
  const readable = sheetOf(objects, geometry);
  const names = namesFor(objects);

  /**
   * What the Values pop-up offers. Everything the sketch already holds a number
   * for, less the calculation being changed and anything built on it: a
   * calculation cannot be made to read itself, even the long way round.
   */
  function offeredValues(): { name: string; says: string }[] {
    const barred = calculator?.editing
      ? withDependents(objects, [calculator.editing])
      : new Set<string>();
    return objects
      .filter((object) => isValue(object) && !barred.has(object.id))
      .map((object) => ({
        name: names.get(object.id) ?? "",
        says: sayQuantity(readable.value(object.id)),
      }));
  }

  /** A name in the Calculator's text, read back to what it names. */
  const namedInSketch = {
    value: (name: string) => {
      const found = objects.find((object) => isValue(object) && names.get(object.id) === name);
      return found ? found.id : null;
    },
    fn: (name: string) => {
      const found = objects.find((object) => isFunction(object) && names.get(object.id) === name);
      return found ? found.id : null;
    },
  };

  /**
   * What a new function will be called, so the Calculator says the name it is
   * about to take rather than always saying f.
   */
  function nextFunctionName(): string {
    const taken = new Set(objects.map((object) => names.get(object.id)));
    const letters = "fgh";
    for (let nth = 0; ; nth += 1) {
      const round = Math.floor(nth / letters.length);
      const wanted = round === 0 ? letters[nth % 3] : `${letters[nth % 3]}${round}`;
      if (!taken.has(wanted)) return wanted;
    }
  }

  /** The functions the Calculator offers, less any it is not allowed to read. */
  function offeredFunctions(): string[] {
    const barred = calculator?.editing
      ? withDependents(objects, [calculator.editing])
      : new Set<string>();
    return objects
      .filter((object) => isFunction(object) && !barred.has(object.id))
      .map((object) => names.get(object.id) ?? "");
  }

  /** The one function selected, which is what a derivative is taken of. */
  function chosenFunction() {
    if (selected.length !== 1) return undefined;
    const only = selected[0];
    return isFunction(only) ? only : undefined;
  }

  function defineDerivative() {
    const of = chosenFunction();
    if (!of) return;
    sketch.addObjects([createFunction(valueSpot(), { of: of.id })]);
  }

  function landParameter(value: number, unit: ParameterUnit, places: number) {
    const editing = parameterDialog?.editing;
    if (editing) {
      const before = sketch.read();
      sketch.commit({
        ...before,
        objects: before.objects.map((object) =>
          object.id === editing && isParameter(object)
            ? { ...object, value, unit, places }
            : object,
        ),
      });
      setParameterDialog(null);
      return;
    }
    const made = createParameter({ value, unit, places }, valueSpot());
    // Made from inside the Calculator, it goes into the expression rather than
    // taking the selection over, since the Calculator is still what is in hand.
    if (parameterDialog?.fromCalculator) {
      const called = namesFor([...objects, made]).get(made.id) ?? null;
      sketch.addObjects([made], selection);
      setInsert(called);
    } else {
      sketch.addObjects([made]);
    }
    setParameterDialog(null);
  }

  function landCalculation(expression: Expr) {
    const editing = calculator?.editing;
    if (calculator?.forFunction) {
      if (editing) {
        const before = sketch.read();
        sketch.commit({
          ...before,
          objects: before.objects.map((object) =>
            object.id === editing && isFunction(object) ? { ...object, body: expression } : object,
          ),
        });
      } else {
        sketch.addObjects([createFunction(valueSpot(), { body: expression })]);
      }
      setCalculator(null);
      return;
    }
    if (editing) {
      const before = sketch.read();
      sketch.commit({
        ...before,
        objects: before.objects.map((object) =>
          object.id === editing && isCalculation(object) ? { ...object, expression } : object,
        ),
      });
    } else {
      sketch.addObjects([createCalculation(expression, valueSpot())]);
    }
    setCalculator(null);
  }

  /** The one table selected, which is what the two table entries act on. */
  function chosenTable() {
    if (selected.length !== 1) return undefined;
    const only = selected[0];
    return isTable(only) ? only : undefined;
  }

  /** Every number selected, in the order it was picked, for Tabulate. */
  function chosenValues(): string[] {
    return selected.filter(isValue).map((object) => object.id);
  }

  function tabulate() {
    const of = chosenValues();
    if (of.length === 0) return;
    sketch.addObjects([createTable(of, valueSpot())]);
  }

  /**
   * What a table's columns say now, held in the sheet's own terms so the row
   * still reads right if the sketch is later written in other units.
   */
  function rowNow(table: SketchTable) {
    return table.of.map((id) => {
      const found = readable.value(id);
      return found ? inSheetTerms(found) : null;
    });
  }

  function captureRow(id: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isTable(object)
          ? { ...object, rows: [...object.rows, rowNow(object)] }
          : object,
      ),
    });
  }

  /** Take rows off a table: the last capture, or every one of them. */
  function dropRows(id: string, all: boolean) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isTable(object)
          ? { ...object, rows: all ? [] : object.rows.slice(0, -1) }
          : object,
      ),
    });
  }

  function startAdding(wanted: AddTableData) {
    const table = chosenTable();
    setTableDialog(null);
    if (!table) return;
    if (wanted.kind === "one") {
      captureRow(table.id);
      return;
    }
    // Nothing is taken yet: the first row lands when the numbers next move.
    collecting.current = {
      table: table.id,
      left: wanted.rows,
      perSecond: wanted.perSecond,
      at: 0,
    };
  }

  /** What an existing calculation or function holds, for the Calculator to open on. */
  function calculationHeld(id?: string): Expr | undefined {
    const found = id ? objects.find((object) => object.id === id) : undefined;
    if (found && isCalculation(found)) return found.expression;
    if (found && isFunction(found)) return found.body;
    return undefined;
  }

  /** What an existing parameter holds, for the dialog to open on. */
  function parameterHeld(id?: string) {
    const found = id ? objects.find((object) => object.id === id) : undefined;
    if (!found || !isParameter(found)) return undefined;
    return { value: found.value, unit: found.unit, places: found.places };
  }

  /**
   * The one thing selected that was made in a dialog and can go back to it. A
   * derivative holds nothing of its own, so there is nothing in it to edit.
   */
  function editable(): string | null {
    if (selected.length !== 1) return null;
    const only = selected[0];
    if (isParameter(only) || isCalculation(only)) return only.id;
    return isFunction(only) && only.body ? only.id : null;
  }

  /** Double-clicking a number goes back to whatever dialog made it. */
  function editValue(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found) return;
    if (isParameter(found)) setParameterDialog({ editing: id });
    else if (isCalculation(found)) setCalculator({ editing: id });
    else if (isFunction(found) && found.body) setCalculator({ forFunction: true, editing: id });
  }

  function openIterate() {
    setSeeds([...selection]);
    setTargets(selection.map(() => null));
    setDialog("iterate");
  }

  function applyIterate() {
    if (orbit.length === 0) return;
    // The seeds stay selected: they are still what the orbit was built on.
    sketch.addObjects(orbit, selection);
    setDialog(null);
  }

  function openDialog(kind: TransformKind) {
    // A point picked before a delete is no point at all.
    const alive = (id: string | null) =>
      id && objects.some((object) => object.id === id) ? id : null;
    marking.current = [];
    setFollows(livingMarks());
    setCentre(alive(centre));
    setMirror(alive(mirror));
    setValues({
      ...values,
      translate: {
        ...values.translate,
        from: alive(values.translate.from),
        to: alive(values.translate.to),
      },
    });
    setDialog(kind);
  }

  /**
   * Give one object a name, and optionally hand it over from whatever held it,
   * which puts that one back on the automatic run. An empty name unpins.
   */
  function pinName(id: string, name: string, swap?: { freed?: string; kept?: string }) {
    const freed = swap?.freed;
    const kept = swap?.kept;
    const before = sketch.read();
    const names = namesFor(before.objects);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) {
          return { ...object, label: { ...object.label, name: name || undefined } };
        }
        // Handing the name over: the old holder goes back to automatic.
        if (object.id === freed) {
          return { ...object, label: { ...object.label, name: undefined } };
        }
        // Keeping both: the old holder has to pin what it was called, or the
        // automatic run would move it off the name on the next pass.
        if (object.id === kept) {
          return { ...object, label: { ...object.label, name: names.get(object.id) } };
        }
        return object;
      }),
    });
  }

  /** Show or hide the labels of the objects named, however they were named. */
  function showLabels(ids: string[], shown: boolean) {
    const before = sketch.read();
    const wanted = new Set(ids);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        wanted.has(object.id) ? { ...object, label: { ...object.label, shown } } : object,
      ),
    });
  }

  /**
   * Hide the objects named, or bring them back. A hidden object keeps its place
   * in the figure and everything built on it stays where it is; it is only out
   * of view. Hiding drops it from the selection, since what is not on the sheet
   * cannot be acted on there.
   */
  function hideObjects(ids: string[], hidden: boolean) {
    const before = sketch.read();
    const wanted = new Set(ids);
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        wanted.has(object.id) ? { ...object, hidden } : object,
      ),
      selection: hidden ? before.selection.filter((id) => !wanted.has(id)) : before.selection,
    });
  }

  /** What the hidden panel lists: one row per object out of view. */
  function hiddenRows(): HiddenRow[] {
    const names = namesFor(objects);
    return objects.flatMap((object) => {
      if (object.hidden !== true) return [];
      // A caption carries no name, so the row is what the caption says, and a
      // measurement is listed by its reading for the same reason: its number is
      // what tells it from the next one.
      const name = isCaption(object)
        ? captionRowName(object.html)
        : isMeasurement(object)
          ? readingText(readingOf(object, { objects, names, settled: geometry }))
          : names.get(object.id);
      return name
        ? [{ id: object.id, name, kind: kindOf(object).replace(/^(a|an|another) /, "") }]
        : [];
    });
  }

  /** What the panel lists: one row per object that can carry a name. */
  function labelRows(): LabelRow[] {
    const names = namesFor(objects);
    return objects.flatMap((object) => {
      const name = names.get(object.id);
      if (!name) return [];
      return [
        {
          id: object.id,
          name,
          kind: kindOf(object).replace(/^(a|an|another) /, ""),
          shown: object.label?.shown === true,
          pinned: object.label?.name !== undefined,
          selected: selection.includes(object.id),
        },
      ];
    });
  }

  /** What to call an object in a sentence. */
  function kindOf(object: SketchObject): string {
    if (isCaption(object)) return "a caption";
    if (isPoint(object)) return "another point";
    if (isCircle(object)) return "a circle";
    if (isArc(object)) return "an arc";
    if (isInterior(object)) return "a fill";
    if (isMeasurement(object)) return "a measurement";
    if (isLine(object)) return `a ${object.form}`;
    return "a locus";
  }

  /** A label was typed into. An empty name puts the object back on the run. */
  function rename(id: string, name: string) {
    if (!name) {
      pinName(id, "");
      return;
    }
    const names = namesFor(objects);
    const holder = objects.find((object) => object.id !== id && names.get(object.id) === name);
    if (!holder) {
      pinName(id, name);
      return;
    }
    setClash({ id, name, holder: kindOf(holder) });
  }

  /**
   * Ctrl+K shows the labels of everything selected, or hides them when they are
   * all showing already. With nothing selected it acts on the whole page, so
   * labelling a figure is one keystroke rather than one per object.
   */
  function toggleLabels() {
    const before = sketch.read();
    const names = namesFor(before.objects);
    const wanted =
      before.selection.length > 0
        ? before.objects.filter((object) => before.selection.includes(object.id))
        : before.objects;
    const able = wanted.filter((object) => names.has(object.id));
    if (able.length === 0) return;
    const showing = able.every((object) => object.label?.shown);
    const ids = new Set(able.map((object) => object.id));
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        ids.has(object.id) ? { ...object, label: { ...object.label, shown: !showing } } : object,
      ),
    });
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

  function construct(action: MenuAction) {
    sketch.addObjects(wouldBuild(building, action));
  }

  function applyDialog() {
    if (!maker) return;
    sketch.addObjects(transformed(selection, maker, { objects, size: pointSize }));
    setDialog(null);
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
      return form === "link" ? sketch.pages.length > 0 : buttonWants(form).length > 0;
    }
    if (action === "split-merge") return splitMerge !== null;
    if (action === "edit-definition") return editable() !== null;
    if (action === "define-custom") return canDefine(objects, selection);
    if (action === "edit-custom") return customs.length > 0;
    if (action.startsWith("apply-transform:")) return transformable(selection, objects);
    if (action === "mark-mirror") return markableMirror(building) !== null;
    if (action === "mark-vector") return markableVector(building) !== null;
    if (action === "mark-angle") return markableAngle(building) !== null;
    if (action === "mark-ratio") return markableRatio(building) !== null;
    if (action === "mark-distance") return markableDistances(building).length > 0;
    if (action === "derivative") return chosenFunction() !== undefined;
    if (action === "tabulate") return chosenValues().length > 0;
    if (action === "add-table-data" || action === "remove-table-data") {
      return chosenTable() !== undefined;
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
    const run = collecting.current;
    if (!run) return;
    const table = objects.find((object) => object.id === run.table);
    if (!table || !isTable(table)) {
      collecting.current = null;
      return;
    }
    const now = Date.now();
    if (now - run.at < 1000 / run.perSecond) return;
    const row = rowNow(table);
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
    if (run.left <= 0) collecting.current = null;
    captureRow(table.id);
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Anything being typed into is taking the keys: a page being renamed, a
      // caption being written, a request or a script being pasted.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable === true;
      if (typing) return;
      // An open dialog owns the keyboard, and handles Escape and Enter itself.
      if (dialogOpen.current) return;
      const modified = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // A bare letter picks a tool. With a modifier down it belongs to a menu
      // shortcut, and Alt is the zoom tool's modifier.
      const picked = !modified && !event.altKey ? TOOL_KEYS.get(key) : undefined;
      if (picked) setActiveTool(picked);
      else if (modified && key === "n") doc.newSketch();
      else if (modified && key === "o") void doc.open();
      else if (modified && key === "s") void doc.save();
      else if (modified && key === "w") doc.close();
      else if (modified && key === "q") void doc.quit();
      else if (modified && key === "a") selectAll();
      else if (modified && key === "x") clipKeys.current.cut();
      else if (modified && key === "c") clipKeys.current.copy();
      else if (modified && key === "v") clipKeys.current.paste();
      else if (modified && key === "k") labels.current();
      else if (modified && event.shiftKey && key === "t") paletteKey.current();
      else if (modified && event.shiftKey && key === "h") showHidden.current();
      else if (modified && key === "h") hide.current();
      // Alt and an arrow walks the family tree, up to the parents and down to
      // the children.
      else if (event.altKey && event.key === "ArrowUp") kinKeys.current("parents");
      else if (event.altKey && event.key === "ArrowDown") kinKeys.current("children");
      // Alt+/ opens the panel that names things, and closes it again.
      else if (event.altKey && key === "/") panelKey.current("labels");
      // Alt+= opens the Calculator, before plus and minus can take the key.
      else if (event.altKey && key === "=") calculate.current();
      else if (modified && key === "m") midpoint.current();
      else if (modified && key === "l") segment.current();
      else if (modified && event.shiftKey && key === "i") cross.current();
      else if (modified && event.shiftKey && key === "p") newParameter.current();
      else if (modified && key === "p") fill.current();
      else if (modified && /^[1-9]$/.test(key)) customKeys.current(Number(key) - 1);
      else if (modified && event.shiftKey && key === "d") docKeys.current();
      else if (modified && key === "e") editDefinition.current();
      else if (modified && key === "z") undo();
      else if (modified && key === "r") redo();
      else if (event.key === "Delete") removeKey.current();
      // Escape puts the plain Arrow up, from any tool and from any arrow. What
      // the tool was halfway through is dropped by the sheet's own handler, so
      // one press both lets go of the gesture and hands the sheet back.
      else if (event.key === "Escape") {
        setActiveTool("arrow");
        pickVariant("arrow", "all");
      }
      // Plus and minus belong to whatever locus is selected.
      else if (!modified && (key === "+" || key === "=")) samples.current(SAMPLE_STEP);
      else if (!modified && key === "-") samples.current(-SAMPLE_STEP);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectAll, doc, pickVariant]);

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
          (action === "label-panel" && panels.includes("labels")) ||
          (action === "hidden-panel" && panels.includes("hidden")) ||
          (action === "palette" && showPalette) ||
          (action === "snap-panel" && panels.includes("snap"))
        }
        isEnabled={isEnabled}
        transforms={customs.map((one) => ({ id: one.id, name: one.name }))}
        labels={splitMerge ? { "split-merge": splitMerge.label } : {}}
        onAsk={() => {
          setScriptErrors([]);
          setScriptWay("ask");
        }}
        onScript={() => {
          setScriptErrors([]);
          setScriptWay("script");
        }}
        onAction={(action) => {
          if (action === "new-sketch") doc.newSketch();
          else if (action === "open") void doc.open();
          else if (action === "about") setAbout(true);
          else if (action === "preferences") setDrafted(prefs);
          else if (action === "page-setup") setSetupOpen(true);
          else if (action === "document-options") setDocOptions(true);
          else if (action === "print-preview") setPreviewing(true);
          else if (action === "print") void printPage();
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
          else if (action === "show-labels") toggleLabels();
          else if (action === "label-panel") panelKey.current("labels");
          else if (action === "hidden-panel") panelKey.current("hidden");
          else if (action === "palette") keepDock({ showPalette: !showPalette });
          else if (action === "snap-panel") panelKey.current("snap");
          else if (action === "export-file") setExportTo("file");
          else if (action === "export-clipboard") setExportTo("clipboard");
          else if (action === "hide-objects") hideObjects(selection, true);
          else if (action === "show-all-hidden") {
            hideObjects(
              objects.filter((object) => object.hidden === true).map((object) => object.id),
              false,
            );
          } else if (action.startsWith("button-")) {
            setButtonDialog(action.slice("button-".length) as ButtonForm);
          } else if (action === "split-merge") runSplitMerge();
          else if (action === "edit-definition") {
            const found = editable();
            if (found) editValue(found);
          } else if (action === "define-custom") setCustomDialog("define");
          else if (action === "edit-custom") setCustomDialog("edit");
          else if (action.startsWith("apply-transform:")) {
            applyCustom(action.slice("apply-transform:".length));
          } else if (action.startsWith("mark-")) mark(action);
          else if (action === "new-function") setCalculator({ forFunction: true });
          else if (action === "derivative") defineDerivative();
          else if (action === "tabulate") tabulate();
          else if (action === "add-table-data") setTableDialog("add");
          else if (action === "remove-table-data") setTableDialog("remove");
          else if (action === "new-parameter") setParameterDialog({});
          else if (action === "calculate") setCalculator({});
          else if (action === "iterate") openIterate();
          else if (BUILDS.has(action)) construct(action);
          else if (
            action === "translate" ||
            action === "rotate" ||
            action === "dilate" ||
            action === "reflect"
          ) {
            openDialog(action);
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
          className={`app__canvas${showPalette ? " app__canvas--barred" : ""}`}
          style={canvasTokens(showing.colours) as CSSProperties}
        >
          <Canvas
            activeTool={activeTool}
            cancelRef={cancelSheet}
            zoomable={prefs.zoom === true}
            sketch={sketch}
            pointSize={pointSize}
            view={sketch.view}
            onView={sketch.setView}
            lineForm={(variants.straightedge ?? "segment") as LineForm}
            polygonKind={variants.polygon ?? "interior"}
            picking={dialog !== null || calculator !== null}
            onPick={pick}
            preview={preview}
            marks={marks}
            onRename={rename}
            onEditValue={editValue}
            onMarkMirror={setMirror}
            onPressButton={pressButton}
            onCaptureRow={captureRow}
            onDropRow={(id) => dropRows(id, false)}
            onToggleLabel={(id) => {
              const object = objects.find((candidate) => candidate.id === id);
              showLabels([id], object?.label?.shown !== true);
            }}
            spotlight={panels.length === 0 ? null : spotlight}
            labelPick={labelPick}
            onLabelPick={(id, additive) => {
              if (id === null) {
                setLabelPick([]);
                return;
              }
              setLabelPick((was) => togglePick(was, id, additive === true));
            }}
            onViewport={setViewport}
            snapping={snapping}
            measureKind={variants.measure ?? "length"}
            arrowKind={variants.arrow ?? "all"}
            markForm={variants.marker ?? "equal"}
            hiddenKinds={hiddenKinds}
            editing={editing}
            onEditing={setEditing}
            editor={editor}
            captionWanted={captionWanted}
            captionLook={captionLook}
          />
          {showPalette && (
            <Palette
              editor={editor}
              caption={chosenCaption}
              text={chosenText ?? armedWriting}
              editing={editing !== null}
              labelMarks={labelMarks}
              onLabelMark={(mark, on) => styleLabel({ [mark]: on })}
              armedText={armedMarks}
              onArmText={(change) => setArmed((was) => ({ ...was, ...change }))}
              onCaption={styleWriting}
              styling={styling}
              onStyle={styleSelection}
            />
          )}
        </div>
        <Dock
          open={panels}
          onToggle={(id) => panelKey.current(id)}
          width={dock.panelWidth}
          onWidth={(panelWidth) => keepDock({ panelWidth })}
          panes={{
            labels: {
              count: `${named.filter((row) => row.shown).length} of ${named.length}`,
              body: (
                <LabelPanel
                  rows={named}
                  onRename={rename}
                  onShow={showLabels}
                  onSpot={setSpotlight}
                  labelNew={labelNew}
                  onLabelNew={(on) => keepDock({ labelNewPoints: on })}
                />
              ),
            },
            snap: {
              count: `${
                [snapping.objects, snapping.length, snapping.angle, snapping.moving].filter(Boolean)
                  .length
              } of 4`,
              body: <SnapPanel snapping={snapping} onChange={keepSnapping} />,
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
                    hideObjects(ids, false);
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
          snapping={snapping.length || snapping.angle}
          onSnapping={(on) => keepSnapping({ length: on, angle: on })}
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
        tabs={prefs.pageTabs !== false}
        objectCount={sketch.state.objects.length}
      />
      {calculator && (
        <CalculatorDialog
          start={calculationHeld(calculator.editing)}
          forFunction={calculator.forFunction}
          lead={calculator.editing ? (names.get(calculator.editing) ?? "f") : nextFunctionName()}
          values={offeredValues()}
          functions={offeredFunctions()}
          named={namedInSketch}
          sheet={readable}
          names={names}
          insert={insert}
          onInserted={() => setInsert(null)}
          onNewParameter={() => setParameterDialog({ fromCalculator: true })}
          quiet={parameterDialog !== null}
          onApply={landCalculation}
          onCancel={() => setCalculator(null)}
        />
      )}

      {parameterDialog && (
        <ParameterDialog
          start={parameterHeld(parameterDialog.editing)}
          angleUnit={prefs.units.angle === "radians" ? "radians" : "degrees"}
          distanceUnit={prefs.units.distance}
          onApply={landParameter}
          onCancel={() => setParameterDialog(null)}
        />
      )}

      {docOptions && (
        <DocumentOptionsDialog
          pages={sketch.pages}
          activeId={sketch.activeId}
          tabs={prefs.pageTabs !== false}
          onShow={sketch.selectPage}
          onApply={(wanted, tabs) => {
            setDocOptions(false);
            sketch.reshapePages(wanted);
            if (tabs !== (prefs.pageTabs !== false)) {
              // The tabs are saved with the sketch, so the title bar has to say
              // there is something to save.
              setPrefs({ ...prefs, pageTabs: tabs });
              sketch.touch();
            }
          }}
          onCancel={() => setDocOptions(false)}
        />
      )}

      {buttonDialog && (
        <ButtonDialog
          form={buttonDialog}
          count={buttonWants(buttonDialog).length}
          pages={sketch.pages}
          onApply={landButton}
          onCancel={() => setButtonDialog(null)}
        />
      )}

      {customDialog === "define" && (
        <DefineTransformDialog onApply={defineCustom} onCancel={() => setCustomDialog(null)} />
      )}

      {customDialog === "edit" && (
        <EditTransformsDialog
          transforms={customs.map((one) => ({ id: one.id, name: one.name }))}
          onRename={renameCustom}
          onDelete={dropCustom}
          onClose={() => setCustomDialog(null)}
        />
      )}

      {tableDialog === "add" && (
        <AddTableDataDialog onApply={startAdding} onCancel={() => setTableDialog(null)} />
      )}

      {tableDialog === "remove" && (
        <RemoveTableDataDialog
          rows={chosenTable()?.rows.length ?? 0}
          onApply={(all) => {
            const table = chosenTable();
            setTableDialog(null);
            if (table) dropRows(table.id, all);
          }}
          onCancel={() => setTableDialog(null)}
        />
      )}

      {scriptWay && (
        <ScriptDialog
          way={scriptWay}
          request={request}
          onRequest={setRequest}
          script={script}
          onScript={setScript}
          target={scriptTarget}
          onTarget={setScriptTarget}
          pages={sketch.pages}
          buildPrompt={promptForRequest}
          onCopied={() => setRequest("")}
          onRun={() => void runTheScript()}
          errors={scriptErrors}
          running={scriptRunning}
          onClose={() => setScriptWay(null)}
        />
      )}

      {clash && (
        <LabelClashDialog
          name={clash.name}
          holder={clash.holder}
          onFree={() => {
            const holder = objects.find(
              (object) => namesFor(objects).get(object.id) === clash.name,
            );
            pinName(clash.id, clash.name, { freed: holder?.id });
            setClash(null);
          }}
          onBoth={() => {
            const holder = objects.find(
              (object) => namesFor(objects).get(object.id) === clash.name,
            );
            pinName(clash.id, clash.name, { kept: holder?.id });
            setClash(null);
          }}
          onCancel={() => setClash(null)}
        />
      )}
      {about && <AboutDialog onClose={() => setAbout(false)} />}
      {drafted && (
        <PreferencesDialog
          prefs={drafted}
          onChange={setDrafted}
          toSketch={scope.toSketch}
          toNew={scope.toNew}
          onScope={(part) => setScope((was) => ({ ...was, ...part }))}
          onApply={applyPrefs}
          onCancel={() => setDrafted(null)}
        />
      )}
      {setupOpen && (
        <PageSetupDialog
          setup={pageSetup}
          onChange={keepPage}
          onApply={() => setSetupOpen(false)}
          onCancel={() => setSetupOpen(false)}
          onPreview={() => {
            setSetupOpen(false);
            setPreviewing(true);
          }}
        />
      )}
      {previewing && (
        <PrintPreviewDialog
          setup={pageSetup}
          picture={pagePicture()}
          onPrint={() => void printPage()}
          onSetup={() => {
            setPreviewing(false);
            setSetupOpen(true);
          }}
          onClose={() => setPreviewing(false)}
        />
      )}
      {exportTo && (
        <ExportDialog
          to={exportTo}
          options={picture}
          onChange={keepPicture}
          onApply={() => void exportPicture(exportTo)}
          onCancel={() => setExportTo(null)}
        />
      )}
      {dialog === "iterate" && (
        <IterateDialog
          targets={targets}
          active={nextSeed}
          depth={depth}
          onDepth={setDepth}
          canApply={orbit.length > 0}
          onApply={applyIterate}
          onCancel={() => setDialog(null)}
        />
      )}
      {transform && (
        <TransformDialog
          kind={transform}
          values={values}
          onChange={setValues}
          marked={{
            angle: follows.angle !== null,
            ratio: follows.ratio !== null,
            distances: follows.distances.length,
          }}
          canApply={maker !== null}
          centred={transform === "reflect" ? mirror !== null : centre !== null}
          onApply={applyDialog}
          onCancel={() => setDialog(null)}
        />
      )}
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
