/**
 * What the app remembers between runs: chrome, not sketch content.
 *
 * The shape lives here rather than in the main process because both hosts keep
 * it: the desktop app in a JSON file in the user data folder, the web app in
 * the browser's own storage. Neither of them is the sketch.
 */

/** The smallest a window goes, which is what a remembered size is held to. */
export const MIN_WINDOW = { width: 960, height: 720 };

export interface Settings {
  /**
   * The dock panels that were open. Empty with everything collapsed; a fresh
   * install has all of them up.
   */
  panels: string[];
  /** Whether the palette bar is under the sheet. A fresh install has it on. */
  showPalette: boolean;
  /** How wide the dock's pane was dragged. */
  panelWidth: number;
  /** The window's size with nothing maximised, so restoring gives it back. */
  windowWidth: number;
  windowHeight: number;
  windowMaximised: boolean;
  /** Whether a new point comes out with its label showing. A fresh install has it on. */
  labelNewPoints: boolean;
  /** Whether a click lands on the points, paths and crossings under it. */
  snapObjects: boolean;
  /** Whether a length is held to whole steps, and how big a step is in cm. */
  snapLength: boolean;
  snapLengthCm: number;
  /** Whether the steps hold a drag of what is already drawn, as well as a drawing. */
  snapMoving: boolean;
  /** Whether a direction is held to whole steps, and how big a step is. */
  snapAngle: boolean;
  snapAngleDegrees: number;
  /** How a picture is drawn, which is where the export dialog starts. */
  exportBackground: "white" | "transparent";
  exportInk: "colour" | "black" | "white";
  exportPoints: boolean;
  exportFill: "hidden" | "colour" | "grey" | "black" | "white";
  /** Page Setup: what a printed page is, and how the figure is drawn on it. */
  paper: "A4" | "A3" | "Letter" | "Legal";
  landscape: boolean;
  marginCm: number;
  printFit: "page" | "actual";
  printInk: "colour" | "black" | "white";
  printPoints: boolean;
  printFill: "hidden" | "colour" | "grey" | "black" | "white";
  /** Preferences: what a new sketch starts on. */
  angleUnit: "degrees" | "radians";
  anglePlaces: number;
  distanceUnit: "cm" | "mm" | "in";
  distancePlaces: number;
  otherPlaces: number;
  colourPoint: string;
  colourPath: string;
  colourFill: string;
  colourMark: string;
  colourLabel: string;
  colourSheet: string;
  captionFont: string;
  captionSize: number;
  /** Whether a number the Measure tool writes comes out tied to what it reads. */
  tieReadings: boolean;
  /** The sketches opened or saved most recently, newest first. */
  recent: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  panels: ["labels", "snap", "hidden"],
  showPalette: true,
  panelWidth: 216,
  windowWidth: 1440,
  windowHeight: 860,
  windowMaximised: false,
  labelNewPoints: true,
  snapObjects: true,
  snapLength: true,
  snapLengthCm: 0.1,
  snapMoving: false,
  snapAngle: true,
  snapAngleDegrees: 1,
  exportBackground: "white",
  exportInk: "black",
  exportPoints: false,
  exportFill: "colour",
  paper: "A4",
  landscape: false,
  marginCm: 1.5,
  printFit: "page",
  printInk: "black",
  printPoints: false,
  printFill: "colour",
  angleUnit: "degrees",
  anglePlaces: 2,
  distanceUnit: "cm",
  distancePlaces: 2,
  otherPlaces: 2,
  colourPoint: "--color-ink-red",
  colourPath: "--color-ink-red",
  colourFill: "--color-ink-blue",
  colourMark: "--color-ink-magenta",
  colourLabel: "--color-ink-black",
  colourSheet: "--color-sheet-white",
  captionFont: "Times New Roman",
  captionSize: 14,
  tieReadings: false,
  recent: [],
};
