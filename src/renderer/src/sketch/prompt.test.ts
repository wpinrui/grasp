// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint } from "./model";
import { buildPrompt } from "./prompt";

const SHEET = { width: 800, height: 600, pixelRatio: 1 };

/**
 * A script can take an object out of view, so an edit run has to be told which
 * objects are already out of view: one it cannot tell apart from a drawn one
 * gets labelled, restyled or drawn over as if it showed.
 */
describe("the page an edit is described", () => {
  function listing(objects: ReturnType<typeof createPoint>[]): string {
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

  it("leaves one in view unmarked", () => {
    const drawn = createPoint({ x: 50, y: 0 }, "medium");
    expect(listing([drawn])).toContain("- point at (50, 0)\n");
  });
});
