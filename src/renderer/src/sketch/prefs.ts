/**
 * Preferences: what GRASP does by default, rather than what any one object is.
 *
 * The palette says how a drawn object is drawn. This says what a new one comes
 * out as, what a measurement is written in, and what the sheet is. Three
 * panels, the way the reference has them, minus Tools, which the Snap panel
 * and the tool flyouts already own between them.
 *
 * A change goes to this sketch, to new sketches, or to both, which is what the
 * two boxes at the foot of the dialog choose. This sketch means this window for
 * as long as it is open; new sketches means what is remembered between runs.
 * Neither is written into the sketch file, so a sketch file stays the sketch
 * and nothing else.
 */

export const DISTANCE_UNITS = ["cm", "mm", "in"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export const ANGLE_UNITS = ["degrees", "radians"] as const;
export type AngleUnit = (typeof ANGLE_UNITS)[number];

/** How far a number is written out. The reference names them; a count is clearer. */
export const PLACES = [0, 1, 2, 3, 4] as const;

/** Units and precision, one row per kind, the way the reference lays them out. */
export interface Units {
  angle: AngleUnit;
  anglePlaces: number;
  distance: DistanceUnit;
  distancePlaces: number;
  /** A ratio and the value of a point carry no unit, only a precision. */
  otherPlaces: number;
}

/** What a new object of each kind comes out in, and what the sheet is. */
export interface Colours {
  point: string;
  path: string;
  fill: string;
  mark: string;
  label: string;
  sheet: string;
}

/** What a new caption is set in. */
export interface Text {
  font: string;
  size: number;
}

export interface Prefs {
  units: Units;
  colours: Colours;
  text: Text;
  /**
   * Whether a number the Measure tool writes comes out tied to what it reads,
   * so it goes wherever the figure goes. It says what a new reading starts as
   * and nothing more: what is already on the sheet keeps whatever it was set
   * to, since where a number has been put is not Preferences' to undo. Absent
   * on a sketch saved before there was a choice, which reads as off.
   */
  tieReadings?: boolean;
  /**
   * Whether the page bar shows its tabs, which Document Options sets. It
   * belongs to the sketch rather than to the window, since a sketch handed to
   * somebody else should open the way it was left. Absent on one saved before
   * there was a choice, which reads as showing them.
   */
  pageTabs?: boolean;
  /**
   * Whether the sheet can be zoomed. Off, it sits at 100% and the wheel, the
   * minus and plus and the readout all go: a figure drawn at centimetres is
   * meant to be read at them, and a wheel that quietly rescales the sheet is
   * how a class ends up measuring on a page that is no longer life size.
   * Absent on a sketch saved before there was a choice, which reads as off.
   */
  zoom?: boolean;
}

/**
 * The papers a sheet can be, light first and then dark. A dark sheet needs the
 * ink set to something that reads on it, which is the row above its own job.
 */
export const SHEETS: { name: string; token: string }[] = [
  { name: "White", token: "--color-sheet-white" },
  { name: "Cream", token: "--color-sheet-cream" },
  { name: "Grey", token: "--color-sheet-grey" },
  { name: "Blue", token: "--color-sheet-blue" },
  { name: "Slate", token: "--color-sheet-slate" },
  { name: "Navy", token: "--color-sheet-navy" },
  { name: "Charcoal", token: "--color-sheet-charcoal" },
  { name: "Black", token: "--color-sheet-black" },
];

export const DEFAULT_PREFS: Prefs = {
  units: {
    angle: "degrees",
    anglePlaces: 1,
    distance: "cm",
    distancePlaces: 2,
    otherPlaces: 2,
  },
  colours: {
    point: "--color-ink-red",
    path: "--color-ink-red",
    fill: "--color-ink-blue",
    mark: "--color-ink-magenta",
    label: "--color-ink-black",
    sheet: "--color-sheet-white",
  },
  text: { font: "Times New Roman", size: 14 },
  tieReadings: false,
  pageTabs: true,
  zoom: false,
};

/** The papers dark enough that everything on them has to be turned over. */
const DARK = new Set([
  "--color-sheet-slate",
  "--color-sheet-navy",
  "--color-sheet-charcoal",
  "--color-sheet-black",
]);

export function isDarkSheet(sheet: string): boolean {
  return DARK.has(sheet);
}

/**
 * Every colour on the sheet that reads one way on white and another on black.
 * Each is the same colour either way, so an object drawn in red is drawn in red
 * on both; only what red is worth against the paper changes.
 */
const ON_DARK = [
  "--color-ink-black",
  "--color-ink-grey",
  "--color-ink-red",
  "--color-ink-orange",
  "--color-ink-green",
  "--color-ink-blue",
  "--color-ink-purple",
  "--color-ink-magenta",
  "--color-canvas-text",
  "--color-canvas-text-strong",
  "--color-canvas-divider",
  "--color-canvas-accent",
  "--color-object-edge",
  "--color-slot",
  "--color-scroll-track",
  "--color-scroll-thumb",
  "--color-scroll-thumb-hover",
  "--color-glass",
  "--color-glass-border",
  "--color-glass-hover",
];

/**
 * The tokens the sheet takes its colours from, set off the preferences. They
 * are put on the canvas rather than on the objects, so an object that has been
 * given a colour of its own keeps it and everything else follows the default.
 *
 * On a dark sheet every colour the sheet uses is turned over first, so the ink,
 * the labels, the guides and the scrollbars all read on it. The label's own
 * colour is set after that, since it is a choice rather than a consequence.
 */
export function canvasTokens(colours: Colours): Record<string, string> {
  const dark = isDarkSheet(colours.sheet);
  const turned: Record<string, string> = {};
  if (dark) for (const name of ON_DARK) turned[name] = `var(${name}-on-dark)`;
  return {
    ...turned,
    "--color-point": `var(${colours.point})`,
    "--color-path": `var(${colours.path})`,
    "--color-interior": `var(${colours.fill})`,
    "--color-mark": `var(${colours.mark})`,
    "--color-canvas-text-strong": `var(${colours.label})`,
    "--color-canvas": `var(${colours.sheet})`,
  };
}
