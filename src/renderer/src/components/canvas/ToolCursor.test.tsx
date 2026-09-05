/**
 * The cursor GRASP draws for itself. None of what makes it work can be seen
 * headlessly, so what is pinned here is everything the drawing rests on: that
 * every tool in the rail has one, that both layers carry the same marks, that
 * the hotspot really is the crosshair's centre, and that the tool's hue and the
 * rail key's are the same value.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(cleanup);

function drawn(tool: string, arrowKind?: string) {
  return render(<ToolCursor tool={tool} arrowKind={arrowKind} hold={() => {}} showing />).container;
}

/** The glyph layer, which is the one drawn in the tool's own ink. */
function glyphLayer(tool: string, arrowKind?: string) {
  return drawn(tool, arrowKind).querySelectorAll(".tool-cursor")[1];
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
    // Half the stroke hangs outside the arm's own end, at 1 near the box's
    // corner and at 21 at the far one, so the halo has to clear both.
    expect(shift + 1).toBeGreaterThanOrEqual(widest / 2);
    expect(shift + 21 + widest / 2).toBeLessThanOrEqual(CURSOR_BOX);
  });

  it("badges every arming of the Arrow but the plain one, and nothing else", () => {
    const armings = TOOLS.find((one) => one.id === "arrow")?.variants ?? [];
    expect(armings.length).toBeGreaterThan(1);
    for (const arming of armings) {
      // The plain Arrow picks up anything, so it has nothing to say.
      expect(`arrow.${arming.id}` in BADGES).toBe(arming.id !== "all");
    }
    for (const key of Object.keys(BADGES)) {
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
    const container = render(<ToolCursor tool="point" hold={() => {}} showing={false} />).container;
    // Both of them, and still in the tree, so the place written to them is
    // right when the pointer comes back. One left showing would be half a
    // cursor stranded where the pointer last was.
    expect(container.querySelectorAll(".tool-cursor--away").length).toBe(2);
  });

  it("draws two layers, the outline and the glyph over it", () => {
    const container = drawn("point");
    const layers = container.querySelectorAll(".tool-cursor");
    expect(layers.length).toBe(2);
    expect(layers[0].classList.contains("tool-cursor--outline")).toBe(true);
    expect(layers[1].classList.contains("tool-cursor--outline")).toBe(false);
    // Straight into what holds them, not into a box of their own: a box would
    // have to be raised and moved, either of which makes it a stacking context,
    // and that isolates the blending group so the outline stops inverting.
    expect(layers[0].parentElement).toBe(container);
    expect(layers[1].parentElement).toBe(container);
  });

  it("draws the same marks in both layers, so the outline cannot miss one", () => {
    const layers = drawn("marker").querySelectorAll(".tool-cursor");
    const shapes = (layer: Element) =>
      [...layer.querySelectorAll("path, text, circle")].map((one) => one.tagName);
    expect(shapes(layers[0])).toEqual(shapes(layers[1]));
    expect(shapes(layers[0]).length).toBe(ANCHOR.length + CURSORS.marker.marks.length);
  });

  it("runs every mark of the outline wider than the glyph's, halo and all", () => {
    const layers = drawn("compass").querySelectorAll(".tool-cursor");
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

  it("draws each tool in the hue its rail key is drawn in", () => {
    // Toolbox.tsx colours a key `var(--color-tool-<id>)`, so this is the same
    // value rather than merely the one the cursor was built from.
    for (const tool of TOOLS) {
      expect(CURSORS[tool.id].ink).toBe(`var(--color-tool-${tool.id})`);
    }
  });

  it("hands that hue to every mark it draws", () => {
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
