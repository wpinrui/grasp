/**
 * The menu bar, transcribed from the reference screenshots: labels, shortcuts,
 * separators, submenu arrows and checkmarks. Entries that named the reference
 * app are dropped, or take the GRASP name where they name the app itself.
 *
 * Entries are placeholders unless they carry an `action`. When each one is
 * enabled is not decided yet, so nothing here sets `disabled`; that flag is the
 * seam the logic will drive.
 */

import type { PointSize } from "../sketch/model";

export type MenuAction =
  | "new-sketch"
  | "open"
  | "save"
  | "save-as"
  | "close"
  | "quit"
  | "preferences"
  | "page-setup"
  | "print-preview"
  | "print"
  | "clear-recent"
  | "about"
  | `open-recent:${string}`
  | "export-file"
  | "export-clipboard"
  | "undo"
  | "redo"
  | "clear"
  | "cut"
  | "copy"
  | "paste"
  | "select-all"
  | "select-parents"
  | "select-children"
  | "show-labels"
  | "hide-objects"
  | "show-all-hidden"
  | "hidden-panel"
  | "label-panel"
  | "snap-panel"
  | "palette"
  | "midpoint"
  | "point-on-object"
  | "interior"
  | "circle-interior"
  | "arc-sector"
  | "arc-segment"
  | "arc-on-circle"
  | "arc-through"
  | "circle-centre-point"
  | "circle-centre-radius"
  | "locus"
  | "intersection"
  | "parallel"
  | "perpendicular"
  | "bisector"
  | "segment"
  | "document-options"
  | "button-hide-show"
  | "button-link"
  | "button-scroll"
  | "button-present"
  | `press-button:${string}`
  | "split-merge"
  | "edit-definition"
  | "define-custom"
  | "edit-custom"
  | `apply-transform:${string}`
  | "mark-mirror"
  | "mark-angle"
  | "mark-ratio"
  | "mark-vector"
  | "mark-distance"
  | "new-parameter"
  | "calculate"
  | "tabulate"
  | "add-table-data"
  | "remove-table-data"
  | "new-function"
  | "derivative"
  | "ray"
  | "line"
  | "translate"
  | "rotate"
  | "dilate"
  | "iterate"
  | "reflect"
  | "measure-length"
  | "measure-distance"
  | "measure-perimeter"
  | "measure-circumference"
  | "measure-angle"
  | "measure-area"
  | "measure-arc-angle"
  | "measure-arc-length"
  | "measure-radius"
  | "measure-ratio"
  | "measure-value"
  | `point-size:${PointSize}`;

export interface MenuItem {
  label: string;
  shortcut?: string;
  /** Set once the entry does something. Without it the entry is a placeholder. */
  action?: MenuAction;
  /** Reserved for the enable logic. Nothing sets it yet. */
  disabled?: boolean;
  /** Draws the trailing arrow. Empty where the contents are not specified. */
  submenu?: MenuEntry[];
  /** A submenu built as the menu opens rather than written out here. */
  dynamic?: "recent";
  /** Dimmer text after the label, which is where a recent file says where it is. */
  note?: string;
  checked?: boolean;
  /** The entry can carry a tick, so its panel reserves the check column. */
  checkable?: boolean;
  /** Help groups its entries under headings, one indent level below them. */
  indent?: boolean;
}

export type MenuEntry = MenuItem | "separator";

export interface Menu {
  label: string;
  items: MenuEntry[];
}

/**
 * Whether the entry does anything yet: it runs an action, or it opens a submenu
 * with something live in it. Bookkeeping, so the menus show at a glance what is
 * still to build.
 */
export function isImplemented(item: MenuItem): boolean {
  if (item.action || item.dynamic) return true;
  return item.submenu?.some((entry) => entry !== "separator" && isImplemented(entry)) ?? false;
}

/**
 * SPIKE, not for merge. What a phone leaves out of the menus: the entries that
 * need hardware or a desk that is not there, and the two the bar along the
 * bottom already carries. Everything cut here is still on the desktop, and a
 * sketch made on a phone still carries whatever those entries made.
 */
export const PHONE_CUT = {
  on: false,
  actions: new Set<string>([
    // Undo and Redo are keys on the bottom bar.
    "undo",
    "redo",
    // A tab is not a window to close or an application to quit.
    "close",
    "quit",
    // Printing, and the page setup that only serves printing.
    "page-setup",
    "print-preview",
    "print",
    // An image on the clipboard is not something a phone can go on to use.
    "export-clipboard",
    // The palette bar is not drawn on a phone, so its switch has nothing to do.
    "palette",
  ]),
  /** Submenus are cut by name, having no action of their own to cut them by. */
  labels: new Set<string>(["Action Buttons"]),
};

/** Whether a separator has anything left on both sides of it to separate. */
function tidied(items: MenuEntry[]): MenuEntry[] {
  const kept: MenuEntry[] = [];
  for (const entry of items) {
    if (entry === "separator" && (kept.length === 0 || kept[kept.length - 1] === "separator")) {
      continue;
    }
    kept.push(entry);
  }
  if (kept[kept.length - 1] === "separator") kept.pop();
  return kept;
}

/** A menu as a phone shows it, which off a phone is the menu unchanged. */
export function shownItems(items: MenuEntry[]): MenuEntry[] {
  if (!PHONE_CUT.on) return items;
  return tidied(
    items.filter(
      (entry) =>
        entry === "separator" ||
        !(
          (entry.action && PHONE_CUT.actions.has(entry.action)) ||
          PHONE_CUT.labels.has(entry.label)
        ),
    ),
  );
}

export const MENUS: Menu[] = [
  {
    label: "File",
    items: [
      { label: "New Sketch", shortcut: "Ctrl+N", action: "new-sketch" },
      { label: "Open...", shortcut: "Ctrl+O", action: "open" },
      { label: "Open Recent", submenu: [], dynamic: "recent" },
      "separator",
      { label: "Save", shortcut: "Ctrl+S", action: "save" },
      { label: "Save As...", action: "save-as" },
      { label: "Close", shortcut: "Ctrl+W", action: "close" },
      "separator",
      { label: "Document Options...", shortcut: "Shift+Ctrl+D", action: "document-options" },
      "separator",
      { label: "Export Image to File...", action: "export-file" },
      { label: "Export Image to Clipboard...", action: "export-clipboard" },
      "separator",
      { label: "Page Setup...", action: "page-setup" },
      { label: "Print Preview...", action: "print-preview" },
      { label: "Print...", action: "print" },
      "separator",
      { label: "Quit", shortcut: "Ctrl+Q", action: "quit" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", shortcut: "Ctrl+Z", action: "undo" },
      { label: "Redo", shortcut: "Ctrl+R", action: "redo" },
      "separator",
      { label: "Cut", shortcut: "Ctrl+X", action: "cut" },
      { label: "Copy", shortcut: "Ctrl+C", action: "copy" },
      { label: "Paste", shortcut: "Ctrl+V", action: "paste" },
      { label: "Clear", shortcut: "Del", action: "clear" },
      "separator",
      {
        label: "Action Buttons",
        submenu: [
          { label: "Hide/Show", action: "button-hide-show" },
          { label: "Link...", action: "button-link" },
          { label: "Scroll", action: "button-scroll" },
          { label: "Presentation", action: "button-present" },
        ],
      },
      { label: "Select All", shortcut: "Ctrl+A", action: "select-all" },
      { label: "Select Parents", shortcut: "Alt+Up", action: "select-parents" },
      { label: "Select Children", shortcut: "Alt+Down", action: "select-children" },
      "separator",
      { label: "Split/Merge", action: "split-merge" },
      { label: "Edit Definition...", shortcut: "Ctrl+E", action: "edit-definition" },
      "separator",
      { label: "Preferences...", action: "preferences" },
    ],
  },
  {
    label: "Display",
    items: [
      {
        label: "Point Style",
        submenu: [
          { label: "Dot", action: "point-size:dot", checkable: true },
          { label: "Small", action: "point-size:small", checkable: true },
          { label: "Medium", action: "point-size:medium", checkable: true },
          { label: "Large", action: "point-size:large", checkable: true },
        ],
      },
      "separator",
      { label: "Hide Objects", shortcut: "Ctrl+H", action: "hide-objects" },
      { label: "Show All Hidden", shortcut: "Shift+Ctrl+H", action: "show-all-hidden" },
      "separator",
      { label: "Show Labels", shortcut: "Ctrl+K", action: "show-labels" },
      "separator",
      {
        label: "Show Palette",
        shortcut: "Shift+Ctrl+T",
        action: "palette",
        checkable: true,
      },
    ],
  },
  {
    label: "Construct",
    items: [
      { label: "Point on Object", action: "point-on-object" },
      { label: "Midpoint", shortcut: "Ctrl+M", action: "midpoint" },
      { label: "Intersection", shortcut: "Shift+Ctrl+I", action: "intersection" },
      "separator",
      { label: "Segment", shortcut: "Ctrl+L", action: "segment" },
      { label: "Ray", action: "ray" },
      { label: "Line", action: "line" },
      { label: "Parallel Line", action: "parallel" },
      { label: "Perpendicular Line", action: "perpendicular" },
      { label: "Angle Bisector", action: "bisector" },
      "separator",
      { label: "Circle by Center+Point", action: "circle-centre-point" },
      { label: "Circle by Center+Radius", action: "circle-centre-radius" },
      { label: "Arc on Circle", action: "arc-on-circle" },
      { label: "Arc through 3 Points", action: "arc-through" },
      "separator",
      {
        label: "Interior",
        submenu: [
          { label: "Polygon Interior", shortcut: "Ctrl+P", action: "interior" },
          { label: "Circle Interior", action: "circle-interior" },
          { label: "Arc Sector", action: "arc-sector" },
          { label: "Arc Segment", action: "arc-segment" },
        ],
      },
      "separator",
      { label: "Locus", action: "locus" },
    ],
  },
  {
    label: "Transform",
    items: [
      { label: "Mark Mirror", action: "mark-mirror" },
      { label: "Mark Angle", action: "mark-angle" },
      { label: "Mark Ratio", action: "mark-ratio" },
      { label: "Mark Vector", action: "mark-vector" },
      { label: "Mark Distance", action: "mark-distance" },
      "separator",
      { label: "Translate...", action: "translate" },
      { label: "Rotate...", action: "rotate" },
      { label: "Dilate...", action: "dilate" },
      { label: "Reflect", action: "reflect" },
      "separator",
      { label: "Iterate...", action: "iterate" },
      "separator",
      "separator",
      { label: "Define Custom Transform...", action: "define-custom" },
      { label: "Edit Custom Transforms...", action: "edit-custom" },
    ],
  },
  {
    label: "Measure",
    items: [
      { label: "Length", action: "measure-length" },
      { label: "Distance", action: "measure-distance" },
      { label: "Perimeter", action: "measure-perimeter" },
      { label: "Circumference", action: "measure-circumference" },
      { label: "Angle", action: "measure-angle" },
      { label: "Area", action: "measure-area" },
      { label: "Arc Angle", action: "measure-arc-angle" },
      { label: "Arc Length", action: "measure-arc-length" },
      { label: "Radius", action: "measure-radius" },
      { label: "Ratio", action: "measure-ratio" },
      { label: "Value of Point", action: "measure-value" },
    ],
  },
  {
    label: "Number",
    items: [
      { label: "New Parameter...", shortcut: "Shift+Ctrl+P", action: "new-parameter" },
      "separator",
      { label: "Calculate...", shortcut: "Alt+=", action: "calculate" },
      "separator",
      { label: "Tabulate", action: "tabulate" },
      { label: "Add Table Data...", action: "add-table-data" },
      { label: "Remove Table Data...", action: "remove-table-data" },
      "separator",
      { label: "New Function...", shortcut: "Ctrl+F", action: "new-function" },
      "separator",
      { label: "Define Derivative Function", action: "derivative" },
    ],
  },
  {
    label: "Window",
    items: [
      { label: "Labels", shortcut: "Alt+/", action: "label-panel", checkable: true },
      { label: "Hidden", action: "hidden-panel", checkable: true },
      { label: "Snap", action: "snap-panel", checkable: true },
      { label: "Palette", shortcut: "Shift+Ctrl+T", action: "palette", checkable: true },
    ],
  },
  {
    label: "Help",
    items: [{ label: "About GRASP...", action: "about" }],
  },
];

/** How many sketches the Open Recent list holds. */
export const RECENT_CAP = 10;

/** How long a path is let run in a menu before it is cut from the front. */
const PATH_CAP = 36;

/** A sketch's name, which is its file name without the suffix. */
function sketchName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  return file.replace(/\.grasp$/i, "");
}

/** The whole path, cut from the front where it is too long to sit in a menu. */
function shortPath(path: string): string {
  return path.length <= PATH_CAP ? path : `...${path.slice(path.length - PATH_CAP + 3)}`;
}

/**
 * The Open Recent submenu, built as the menu opens: the sketches opened or
 * saved most recently, newest first, and the way to empty the list. Empty when
 * nothing has been opened yet, which greys the entry it hangs off.
 */
/**
 * The custom transforms, at the foot of the Transform menu with a numbered
 * shortcut each, which is where the reference puts them.
 */
export function customItems(transforms: { id: string; name: string }[]): MenuEntry[] {
  if (transforms.length === 0) return [];
  return [
    "separator",
    ...transforms.map(
      (one, nth): MenuItem => ({
        label: one.name,
        shortcut: nth < 9 ? `Ctrl+${nth + 1}` : undefined,
        action: `apply-transform:${one.id}`,
      }),
    ),
  ];
}

export function recentItems(recent: string[]): MenuEntry[] {
  if (recent.length === 0) return [];
  return [
    ...recent.map(
      (path): MenuItem => ({
        label: sketchName(path),
        note: shortPath(path),
        action: `open-recent:${path}`,
      }),
    ),
    "separator",
    { label: "Clear Recents", action: "clear-recent" },
  ];
}
