// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint, DEFAULT_VIEW } from "./model";
import { landedAfter, moved, type Page, renamed, reshaped } from "./pages";

function page(id: string, name: string): Page {
  return { id, name, state: { objects: [], selection: [] }, view: DEFAULT_VIEW };
}

const ROW = [page("a", "Page 1"), page("b", "Page 2"), page("c", "Page 3")];
const names = (pages: Page[]) => pages.map((one) => one.name);

describe("renaming a page", () => {
  it("takes the name, trimmed", () => {
    expect(names(renamed(ROW, "b", "  Second  ") ?? [])).toEqual(["Page 1", "Second", "Page 3"]);
  });

  it("refuses an empty name, so a page always has one", () => {
    expect(renamed(ROW, "b", "   ")).toBeNull();
  });

  it("leaves the other pages as they were", () => {
    const next = renamed(ROW, "b", "Second");
    expect(next?.[0]).toBe(ROW[0]);
    expect(next?.[2]).toBe(ROW[2]);
  });
});

describe("dragging a page along the row", () => {
  it("takes it out and puts it back at the place asked for", () => {
    expect(names(moved(ROW, "c", 0) ?? [])).toEqual(["Page 3", "Page 1", "Page 2"]);
    expect(names(moved(ROW, "a", 2) ?? [])).toEqual(["Page 2", "Page 3", "Page 1"]);
  });

  it("says nothing changed when the move would not move it", () => {
    expect(moved(ROW, "b", 1)).toBeNull();
    expect(moved(ROW, "b", -1)).toBeNull();
    expect(moved(ROW, "b", 3)).toBeNull();
    expect(moved(ROW, "nothing", 0)).toBeNull();
  });
});

describe("what Document Options was answered with", () => {
  it("keeps the pages it names, in the order it names them", () => {
    const next = reshaped(ROW, [
      { id: "c", name: "Page 3" },
      { id: "a", name: "Page 1" },
    ]);
    expect(next.map((one) => one.id)).toEqual(["c", "a"]);
    expect(next[0]).toBe(ROW[2]);
  });

  it("renames in the same pass", () => {
    const next = reshaped(ROW, [{ id: "a", name: "Renamed" }]);
    expect(names(next)).toEqual(["Renamed"]);
    expect(next[0].id).toBe("a");
  });

  it("makes a blank page for one with no id", () => {
    const next = reshaped(ROW, [{ name: "Fresh" }]);
    expect(names(next)).toEqual(["Fresh"]);
    expect(next[0].state.objects).toEqual([]);
    expect(next[0].id).not.toBe("a");
  });

  it("copies a page under fresh ids when one is asked for", () => {
    const from = { ...page("a", "Page 1") };
    from.state = { objects: [createPoint({ x: 1, y: 2 }, "medium")], selection: [] };
    const next = reshaped([from], [{ name: "Copy", from: "a" }]);
    expect(next[0].state.objects).toHaveLength(1);
    expect(next[0].state.objects[0].id).not.toBe(from.state.objects[0].id);
  });
});

describe("a page made off another one", () => {
  it("lands straight after the page it came from", () => {
    const landed = landedAfter(ROW, ROW[0], { said: "copy", objects: [] });
    expect(names(landed.pages)).toEqual(["Page 1", "Page 1 (copy)", "Page 2", "Page 3"]);
    expect(landed.page.name).toBe("Page 1 (copy)");
  });

  it("counts on past a name already in use", () => {
    const taken = [ROW[0], page("d", "Page 1 (copy)")];
    expect(landedAfter(taken, taken[0], { said: "copy", objects: [] }).page.name).toBe(
      "Page 1 (copy) 2",
    );
  });

  it("opens on the same view as the page it came from", () => {
    const from = { ...page("a", "Page 1"), view: { x: 40, y: 50, scale: 2 } };
    expect(landedAfter([from], from, { said: "copy", objects: [] }).page.view).toEqual({
      x: 40,
      y: 50,
      scale: 2,
    });
  });
});
