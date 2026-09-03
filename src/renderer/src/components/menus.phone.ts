/**
 * What a phone leaves out of the menus, and the rules for taking it out.
 *
 * Kept apart from the table itself: `menus.ts` is what GRASP offers, and this
 * is one judgement about one kind of screen. Nothing here is removed from
 * GRASP. A sketch made on a phone still carries whatever these entries made,
 * and opening it at a desk gets all of them back.
 */

import { MENUS, type Menu, type MenuEntry } from "./menus";

/**
 * The entries that need hardware or a desk that is not there, and the two the
 * bar along the bottom already carries.
 * Nothing here is removed from GRASP. A sketch made on a phone still carries
 * whatever these made, and opening it at a desk gets all of them back.
 */
const CUT_ACTIONS = new Set<string>([
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
  // The palette bar is not drawn on a phone, and neither is the pane these
  // three open, so all four are switches with nothing to act on.
  "palette",
  "label-panel",
  "hidden-panel",
  "snap-panel",
  // Naming, adding and reordering pages, and a switch for the page tabs, on a
  // build that is one page with no tabs.
  "document-options",
  // A second browser tab to juggle.
  "new-sketch",
  // A picture download, where the rail's share button already hands the whole
  // sketch to the device.
  "export-file",
  // Dialog work: building a transform rather than using one.
  "iterate",
  "define-custom",
  "edit-custom",
  // Relational editing, all of which asks for a selection precise enough that
  // a finger cannot reliably make it.
  "select-parents",
  "select-children",
  "split-merge",
  "edit-definition",
  "preferences",
  // Hiding something needs it selected first, and getting it back needs a
  // panel that is not on a phone.
  "hide-objects",
  "show-all-hidden",
  // Each of these opens a dialog that wants a number typed and a marked
  // reference picked before it will do anything.
  "translate",
  "rotate",
  "dilate",
  "reflect",
]);

/**
 * Whole menus a phone leaves out. Measure and Number are desk work, and Help is
 * an about box. The Window menu is not named here: its four entries are cut
 * individually above, which empties it, and `phoneMenus` drops a title with
 * nothing left under it.
 */
const CUT_TITLES = new Set<string>(["Measure", "Number", "Help"]);

/** Submenus are cut by name, having no action of their own to cut them by. */
const CUT_LABELS = new Set<string>([
  "Action Buttons",
  // Recents are kept as handles to files on a machine, which a phone browser
  // mostly cannot hold on to, and reopening one needs a picker it may not
  // have either. A list that cannot open what it lists is worse than no list.
  "Open Recent",
  // Point styling: how a point is drawn is not what a phone is opened for.
  "Point Style",
]);

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

/** A menu as a phone shows it. Off a phone, nothing calls this. */
export function phoneItems(items: MenuEntry[]): MenuEntry[] {
  return tidied(
    items.filter(
      (entry) =>
        entry === "separator" ||
        !((entry.action && CUT_ACTIONS.has(entry.action)) || CUT_LABELS.has(entry.label)),
    ),
  );
}

/**
 * The titles a phone shows, in the order the bar draws them. A title left with
 * nothing under it is not a title, so it goes rather than opening an empty
 * panel. The list is a parameter so that rule can be exercised on its own.
 */
export function phoneMenus(menus: Menu[] = MENUS): Menu[] {
  return menus
    .filter((menu) => !CUT_TITLES.has(menu.label))
    .map((menu) => ({ ...menu, items: phoneItems(menu.items) }))
    .filter((menu) => menu.items.length > 0);
}
