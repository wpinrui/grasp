/**
 * The cursor GRASP draws for itself. None of what makes it work can be seen
 * headlessly, so what is pinned here is everything the drawing rests on: that
 * every tool in the rail has one, that both layers carry the same marks, that
 * the hotspot really is the crosshair's centre, and that the tool's hue and the
 * rail key's are the same value.
 */

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../tools";
import {
  ANCHOR,
  BADGES,
  CURSOR_BOX,
  CURSORS,
  cursorDrawnFor,
  HOTSPOT,
  OUTLINE_WIDEN,
  SHIFT,
} from "./cursorGeometry";
import { ToolCursor } from "./ToolCursor";

function drawn(tool: string, arrowKind?: string) {
  return render(<ToolCursor tool={tool} arrowKind={arrowKind} box={createRef()} showing />)
    .container;
}

/** The glyph layer, which is the one drawn in the tool's own ink. */
function glyphLayer(tool: string, arrowKind?: string) {
  return drawn(tool, arrowKind).querySelectorAll(".tool-cursor__layer")[1];
}

describe("which tools GRASP draws a cursor for", () => {
  it("draws one for every tool in the rail, whatever the rail comes to hold", () => {
    for (const tool of TOOLS) expect(cursorDrawnFor(tool.id)).toBe(true);
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  it("draws none for the hand or for the Text tool over something named", () => {
    // Both keep what Canvas.css gives them: grab, and the pointer.
    expect(cursorDrawnFor("hand")).toBe(false);
    expect(cursorDrawnFor("text-label")).toBe(false);
    expect(drawn("hand").querySelector(".tool-cursor")).toBeNull();
  });
});

describe("the geometry every cursor is built from", () => {
  it("puts the hotspot at the crosshair's centre, where the arms point", () => {
    // The arms stop at 7 and start again at 15, so they point at 11; the shift
    // moves the whole drawing in from the corner by the same amount twice.
    const shift = Number(/translate\((\d+)/.exec(SHIFT)?.[1]);
    expect(HOTSPOT.x).toBe(11 + shift);
    expect(HOTSPOT.y).toBe(11 + shift);
  });

  it("leaves the widest halo on a crosshair arm inside the box", () => {
    const arm = ANCHOR[0];
    const widest = ("w" in arm ? (arm.w ?? 0) : 0) + OUTLINE_WIDEN;
    const shift = Number(/translate\((\d+)/.exec(SHIFT)?.[1]);
    // Half the stroke hangs outside the arm's own end, at 1 on the icons' box.
    expect(shift).toBeGreaterThanOrEqual(widest / 2);
    expect(shift + 21).toBeLessThanOrEqual(CURSOR_BOX);
  });

  it("gives every badge an arming of the Arrow to belong to", () => {
    const armings = TOOLS.find((one) => one.id === "arrow")?.variants ?? [];
    for (const key of Object.keys(BADGES)) {
      expect(key.startsWith("arrow.")).toBe(true);
      expect(armings.some((one) => `arrow.${one.id}` === key)).toBe(true);
    }
  });

  it("draws every glyph and every badge in an ink of its own", () => {
    for (const one of [...Object.values(CURSORS), ...Object.values(BADGES)]) {
      expect(one.ink).toMatch(/^var\(--color-/);
      expect(one.marks.length).toBeGreaterThan(0);
    }
  });
});

describe("the cursor on the sheet", () => {
  it("waits out of sight with the pointer off the sheet", () => {
    const container = render(
      <ToolCursor tool="point" box={createRef()} showing={false} />,
    ).container;
    // Still in the tree, so the place written to it is right when it comes back.
    expect(container.querySelector(".tool-cursor--away")).toBeTruthy();
  });

  it("draws two layers, the outline and the glyph over it", () => {
    const layers = drawn("point").querySelectorAll(".tool-cursor__layer");
    expect(layers.length).toBe(2);
    expect(layers[0].classList.contains("tool-cursor__layer--outline")).toBe(true);
    expect(layers[1].classList.contains("tool-cursor__layer--outline")).toBe(false);
  });

  it("draws the same marks in both layers, so the outline cannot miss one", () => {
    const layers = drawn("marker").querySelectorAll(".tool-cursor__layer");
    const shapes = (layer: Element) =>
      [...layer.querySelectorAll("path, text, circle")].map((one) => one.tagName);
    expect(shapes(layers[0])).toEqual(shapes(layers[1]));
    expect(shapes(layers[0]).length).toBe(ANCHOR.length + CURSORS.marker.marks.length);
  });

  it("runs every mark of the outline wider than the glyph's, halo and all", () => {
    const layers = drawn("compass").querySelectorAll(".tool-cursor__layer");
    const widths = (layer: Element) =>
      [...layer.querySelectorAll("path, circle")].map((one) =>
        Number(one.getAttribute("stroke-width")),
      );
    const outline = widths(layers[0]);
    const glyph = widths(layers[1]);
    expect(outline.length).toBe(glyph.length);
    // Every one, not merely the first: the crosshair is the first path, and an
    // outline that widened only that would leave the glyph with no halo at all.
    expect(outline).toEqual(glyph.map((wide) => wide + OUTLINE_WIDEN));
  });

  it("badges the Arrow with what it is armed to pick up, and only the Arrow", () => {
    const marks = (layer: Element) => layer.querySelectorAll("path, text, circle").length;
    expect(marks(glyphLayer("arrow", "points"))).toBe(
      marks(glyphLayer("arrow", "all")) + BADGES["arrow.points"].marks.length,
    );
    // A drawing tool's variant changes what the click makes, which the sheet
    // shows as it is made, so it carries no badge.
    expect(marks(glyphLayer("straightedge", "points"))).toBe(
      ANCHOR.length + CURSORS.straightedge.marks.length,
    );
  });

  it("draws each tool in its own hue, so the cursor and the rail key match", () => {
    for (const tool of ["point", "compass", "marker"]) {
      const first = glyphLayer(tool).querySelector("path, text, circle") as SVGElement;
      expect(first.getAttribute("stroke")).toBe(CURSORS[tool].ink);
    }
  });

  it("turns the Measure ruler, which is the one glyph that is not upright", () => {
    const glyph = glyphLayer("measure").querySelectorAll("path")[ANCHOR.length];
    expect(glyph.getAttribute("transform")).toContain("rotate(-45");
  });
});
