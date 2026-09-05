/**
 * What the window remembers between runs, and the paper and pictures those
 * settings describe.
 *
 * The dock, the snap steps, the export options and the paper all live in one
 * settings file, read on the first frame so the chrome comes up in place, and
 * written as each one changes so quitting is not a thing to think about.
 * Preferences are different: they are saved with the sketch, since a sketch
 * opened from a file draws the way it was drawn when it was saved.
 */

import { useRef, useState } from "react";
import type { Snapping } from "../components/SnapPanel";
import { writeIn } from "../sketch/measure";
import type { PageSetup } from "../sketch/paper";
import type { PictureOptions } from "../sketch/picture";
import type { Prefs } from "../sketch/prefs";
import type { Sketch } from "../sketch/useSketch";

type Held = ReturnType<typeof window.api.settings.read>;

/** What a new sketch starts on, out of what was remembered between runs. */
export function prefsFrom(held: Held): Prefs {
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
    tieReadings: held.tieReadings,
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
    tieReadings: prefs.tieReadings === true,
  };
}

export interface SettingsContext {
  sketch: Sketch;
  /** Cleared as a panel opens, since the panel is what was pointing at it. */
  setSpotlight: (id: string | null) => void;
  /** A phone holds a drag to no steps: a finger is nowhere near accurate enough. */
  phone: boolean;
}

export function useSettings({ sketch, phone, setSpotlight }: SettingsContext) {
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
  // And whether a new one comes out tied to its figure, which the sketch asks
  // as each reading lands.
  sketch.tieNewReadings(showing.tieReadings === true);
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

  /** Open one of the dock's panels, or close it again. */
  function openPanel(id: string) {
    setSpotlight(null);
    keepDock({
      panels: panels.includes(id) ? panels.filter((open) => open !== id) : [...panels, id],
    });
  }

  return {
    openPanel,
    dock,
    panels,
    showPalette,
    keepDock,
    labelNew,
    snapping,
    keepSnapping,
    picture,
    keepPicture,
    prefs,
    setPrefs,
    prefsAt,
    drafted,
    setDrafted,
    scope,
    setScope,
    showing,
    applyPrefs,
    pageSetup,
    keepPage,
    setupOpen,
    setSetupOpen,
    previewing,
    setPreviewing,
  };
}

/** What the window remembers between runs. */
export type Settings = ReturnType<typeof useSettings>;
