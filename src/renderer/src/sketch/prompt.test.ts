// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SketchObject } from "./model";
import { createLine, createPoint } from "./model";
import { buildPrompt } from "./prompt";

const SHEET = { width: 800, height: 600, pixelRatio: 1 };

/**
 * A script can take an object out of view, so an edit run has to be told which
 * objects are already out of view: one it cannot tell apart from a drawn one
 * gets labelled, restyled or drawn over as if it showed.
 */
describe("the page an edit is described", () => {
  function listing(objects: SketchObject[]): string {
    return buildPrompt({
      request: "add a circle",
      target: { kind: "edit", page: "Page 1", objects },
      sheet: SHEET,
    });
  }

  it("says which objects are out of view", () => {
    const helper = { ...createPoint({ x: 50, y: 0 }, "medium"), hidden: true };
    expect(listing([helper])).toContain("- point at (50, 0), hidden");
  });

  it("says where an unnamed point sits, so it can be told from the next one", () => {
    // Most of a page carries no name now, and "segment ? to ?" would say
    // nothing about which segment it is.
    const a = createPoint({ x: 0, y: 0 }, "medium");
    const b = createPoint({ x: 100, y: 40 }, "medium");
    const seg = createLine("segment", { kind: "through", ends: [a.id, b.id] });
    expect(listing([a, b, seg])).toContain("- segment (0, 0) to (100, 40)");
  });

  it("leaves one in view unmarked", () => {
    const drawn = createPoint({ x: 50, y: 0 }, "medium");
    expect(listing([drawn])).toContain("- point at (50, 0)\n");
  });
});
