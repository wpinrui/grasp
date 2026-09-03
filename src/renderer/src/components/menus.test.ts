// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MENUS, type Menu, type MenuEntry, phoneItems, phoneMenus } from "./menus";

/** Every entry in a menu that is an entry rather than a rule between them. */
function items(entries: MenuEntry[]) {
  return entries.filter((entry) => entry !== "separator");
}

/** Every label a list of menus offers, submenus included. */
function labels(menus: Menu[]): string[] {
  const found: string[] = [];
  function walk(entries: MenuEntry[]) {
    for (const entry of entries) {
      if (entry === "separator") continue;
      found.push(entry.label);
      if (entry.submenu) walk(entry.submenu);
    }
  }
  for (const menu of menus) walk(menu.items);
  return found;
}

describe("what a phone leaves out", () => {
  it("keeps Undo and Redo off the menus, the bottom bar having them", () => {
    const edit = MENUS.find((menu) => menu.label === "Edit");
    if (!edit) throw new Error("no Edit menu");
    expect(items(edit.items).map((entry) => entry.label)).toContain("Undo");
    expect(items(phoneItems(edit.items)).map((entry) => entry.label)).not.toContain("Undo");
    expect(items(phoneItems(edit.items)).map((entry) => entry.label)).not.toContain("Redo");
  });

  it("leaves out everything that needs hardware a phone has not got", () => {
    const gone = ["Print...", "Print Preview...", "Page Setup...", "Quit", "Close"];
    const left = labels(phoneMenus());
    for (const label of gone) expect(left).not.toContain(label);
  });

  it("opens no switch that acts on something a phone does not draw", () => {
    // The palette bar and the dock's pane are both hidden on a coarse pointer,
    // so every switch that opens one of them is a control with nothing to do.
    const dead = ["Show Palette", "Labels", "Hidden", "Snap"];
    const left = labels(phoneMenus());
    for (const label of dead) expect(left).not.toContain(label);
  });

  it("keeps the geometry, which is what a phone is opened for", () => {
    const left = labels(phoneMenus());
    for (const label of ["Segment", "Midpoint", "Intersection", "Angle Bisector"]) {
      expect(left).toContain(label);
    }
  });

  it("shows only the titles a phone can act on", () => {
    expect(phoneMenus().map((menu) => menu.label)).toEqual([
      "File",
      "Edit",
      "Display",
      "Construct",
      "Transform",
    ]);
  });
});

describe("the rules between the entries", () => {
  it("collapses a run of separators left by a cut", () => {
    const cut = phoneItems([
      { label: "Undo", action: "undo" },
      "separator",
      { label: "Segment", action: "segment" },
      "separator",
      { label: "Print...", action: "print" },
      "separator",
      { label: "Ray", action: "ray" },
    ]);
    expect(cut).toEqual([
      { label: "Segment", action: "segment" },
      "separator",
      { label: "Ray", action: "ray" },
    ]);
  });

  it("never opens or closes on a separator", () => {
    for (const menu of phoneMenus()) {
      const shown = phoneItems(menu.items);
      expect(shown[0]).not.toBe("separator");
      expect(shown[shown.length - 1]).not.toBe("separator");
    }
  });

  it("leaves a menu it takes nothing from exactly as it was", () => {
    const construct = MENUS.find((menu) => menu.label === "Construct");
    if (!construct) throw new Error("no Construct menu");
    expect(phoneItems(construct.items)).toEqual(construct.items);
  });
});

describe("a title with nothing left under it", () => {
  it("goes, rather than opening an empty panel", () => {
    const all: Menu[] = [
      { label: "Kept", items: [{ label: "Segment", action: "segment" }] },
      { label: "Emptied", items: [{ label: "Print...", action: "print" }] },
    ];
    expect(phoneMenus(all).map((menu) => menu.label)).toEqual(["Kept"]);
  });

  it("takes the separators with it, so a menu of nothing but rules goes too", () => {
    const all: Menu[] = [
      { label: "Rules", items: ["separator", { label: "Quit", action: "quit" }, "separator"] },
    ];
    expect(phoneMenus(all)).toEqual([]);
  });
});
