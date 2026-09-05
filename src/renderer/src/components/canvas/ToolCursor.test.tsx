/**
 * The cursor GRASP draws for itself. None of what makes it work can be seen
 * headlessly, so what is pinned here is everything the drawing rests on: that
 * every tool in the rail has one, that both layers carry the same marks, that
 * the click lands on the arrow's own tip, that the halo comes out one width
 * whatever a glyph's scale, and that the tool's hue and the rail key's are the
 * same value.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ARROW_AT, ARROW_PATH } from "../icons/frame";
import { ArrowMarksIcon, ArrowPathsIcon, ArrowPointsIcon, ArrowTextIcon } from "../icons/tools";
import { TOOLS } from "../tools";
import {
  BADGES,
  CURSOR_BOX,
  CURSORS,
  cursorDrawnFor,
  HOTSPOT,
  OUTLINE_WIDEN,
} from "./cursorGeometry";
import { ToolCursor } from "./ToolCursor";

afterEach(cleanup);

/**
 * The layers, wherever they are drawn. They are portalled into the body, so
 * that nothing on the page can clip them, which is why this is not the
 * container the render returns.
 */
function drawn(tool: string, arrowKind?: string) {
  // Portalled layers outlive their render's container, so the last one goes
  // before the next arrives and a query cannot pick up two cursors at once.
  cleanup();
  render(<ToolCursor tool={tool} arrowKind={arrowKind} hold={() => {}} showing />);
  return document.body;
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
  it("clicks at the arrow's own tip, which every cursor is drawn from", () => {
    const [, from, scale] = /translate\((\d+(?:\.\d+)?) \d+\) scale\((\d+(?:\.\d+)?)\)/.exec(
      ARROW_AT,
    ) as RegExpExecArray;
    // The first point of the path is the tip.
    const [tipX, tipY] = /M([\d.]+) ([\d.]+)/.exec(ARROW_PATH)?.slice(1) ?? [];
    expect(HOTSPOT.x).toBeCloseTo(Number(from) + Number(tipX) * Number(scale));
    expect(HOTSPOT.y).toBeCloseTo(Number(from) + Number(tipY) * Number(scale));
  });

  it("draws the arrow for every tool, in that tool's own ink", () => {
    for (const tool of Object.keys(CURSORS)) {
      const arrows = [...glyphLayer(tool).querySelectorAll("path")].filter(
        (one) => one.getAttribute("d") === ARROW_PATH,
      );
      expect([tool, arrows.length]).toEqual([tool, 1]);
      expect([tool, arrows[0]?.getAttribute("fill")]).toEqual([tool, CURSORS[tool]?.ink]);
    }
  });

  /**
   * A glyph may sit above or left of the arrow, and a shape at a negative
   * coordinate is simply not drawn, so the box has to hold every one of them
   * whole, the outline's own width included.
   */
  it("leaves room in the box for every glyph, wherever it was put", () => {
    const outside: string[] = [];
    for (const tool of Object.keys(CURSORS)) {
      const at = CURSORS[tool]?.at;
      if (!at) continue;
      const [, x, y, size] = /translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)/.exec(at) ?? [];
      // The icons' own box, which is the widest a glyph can be, and as far as a
      // turn about its middle can throw a corner, which is its half-diagonal
      // less its half-width.
      const reach = /rotate/.test(at) ? 10 * Number(size) * (Math.SQRT2 - 1) : 0;
      // The halo is widened by the glyph's own scale, so its bleed is the same
      // on screen for every glyph rather than shrinking with it.
      const bleed = OUTLINE_WIDEN / 2;
      const near = Math.min(Number(x), Number(y)) - reach - bleed;
      const far = Math.max(Number(x), Number(y)) + 20 * Number(size) + reach + bleed;
      if (near < 0 || far > CURSOR_BOX) outside.push(tool);
    }
    expect(outside).toEqual([]);
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
      // The Arrow's glyph is the arrow itself, which every cursor is drawn
      // with, so it is the one entry with no marks of its own.
      expect(one.marks.length).toBeGreaterThan(one === CURSORS.arrow ? -1 : 0);
    }
  });
});

describe("the cursor on the sheet", () => {
  it("waits out of sight with the pointer off the sheet", () => {
    render(<ToolCursor tool="point" hold={() => {}} showing={false} />);
    const container = document.body;
    // Both of them, and still in the tree, so the place written to them is
    // right when the pointer comes back. One left showing would be half a
    // cursor stranded where the pointer last was.
    expect(container.querySelectorAll(".tool-cursor--away").length).toBe(2);
  });

  /**
   * The layers hang off the body and are moved by writing a transform read in
   * window coordinates, which only lands where the pointer is while they are
   * taken out of the page's flow and off its scrolling. Nothing in jsdom lays
   * out, so the stylesheet is read rather than measured.
   */
  it("holds the layers to the window, since that is what they are placed in", () => {
    // Beside this file rather than off the working directory, so the test does
    // not depend on where the run was started.
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, "ToolCursor.css"), "utf8");
    const rule = css.slice(css.indexOf(".tool-cursor {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("position: fixed");
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
    expect(layers[0].parentElement).toBe(document.body);
    expect(layers[1].parentElement).toBe(document.body);
  });

  it("draws the same marks in both layers, so the outline cannot miss one", () => {
    const layers = drawn("marker").querySelectorAll(".tool-cursor");
    const shapes = (layer: Element) =>
      [...layer.querySelectorAll("path, text, circle")].map((one) => one.tagName);
    expect(shapes(layers[0])).toEqual(shapes(layers[1]));
    expect(shapes(layers[0]).length).toBe(1 + CURSORS.marker.marks.length);
  });

  /**
   * The halo has to come out the same width on screen for every mark. A stroke
   * inside a scaled transform is scaled with everything else, so a glyph drawn
   * at 0.59 took 59% of a halo and all but lost it beside the arrow's.
   */
  it("runs the same width of halo round every mark, whatever its scale", () => {
    for (const tool of Object.keys(CURSORS)) {
      const layers = drawn(tool).querySelectorAll(".tool-cursor");
      const marks = (layer: Element) => [...layer.querySelectorAll("path, circle, text")];
      const outline = marks(layers[0]);
      const glyph = marks(layers[1]);
      expect([tool, outline.length]).toEqual([tool, glyph.length]);
      for (const [nth, one] of outline.entries()) {
        const scale = Number(/scale\(([\d.]+)/.exec(one.getAttribute("transform") ?? "")?.[1] ?? 1);
        const under = Number(glyph[nth]?.getAttribute("stroke-width") ?? 0);
        const wide = Number(one.getAttribute("stroke-width"));
        // What the halo comes to on screen, once its transform has had it.
        expect({ tool, nth, halo: (wide - under) * scale }).toEqual({
          tool,
          nth,
          halo: expect.closeTo(OUTLINE_WIDEN),
        });
      }
    }
  });

  it("badges the Arrow with what it is armed to pick up, and only the Arrow", () => {
    const marks = (layer: Element) => layer.querySelectorAll("path, text, circle").length;
    expect(marks(glyphLayer("arrow", "points"))).toBe(
      marks(glyphLayer("arrow", "all")) + BADGES["arrow.points"].marks.length,
    );
    // A drawing tool's variant changes what the click makes, which the sheet
    // shows as it is made, so it carries no badge.
    expect(marks(glyphLayer("straightedge", "points"))).toBe(1 + CURSORS.straightedge.marks.length);
  });

  it("draws each tool in the hue its rail key is drawn in", () => {
    // Toolbox.tsx colours a key `var(--color-tool-<id>)`, so this is the same
    // value rather than merely the one the cursor was built from.
    for (const tool of TOOLS) {
      expect(CURSORS[tool.id].ink).toBe(`var(--color-tool-${tool.id})`);
    }
  });

  it("hands that hue to every mark it draws, the glyph's as well as the arrow's", () => {
    for (const tool of Object.keys(CURSORS)) {
      const inks = [...glyphLayer(tool).querySelectorAll("path, text, circle")].map((one) =>
        one.getAttribute("stroke") === "none"
          ? one.getAttribute("fill")
          : one.getAttribute("stroke"),
      );
      expect([tool, inks]).toEqual([tool, inks.map(() => CURSORS[tool]?.ink)]);
    }
  });

  it("leaves the ruler flat, which is how it was placed", () => {
    expect(CURSORS.measure?.at).not.toContain("rotate");
  });

  it("turns the glyphs that were placed turned, about their own middle", () => {
    // The arrow is drawn first, so the glyph's own marks follow it.
    for (const [tool, turn] of [
      ["straightedge", "rotate(-23 10 10)"],
      ["marker", "rotate(-15 9.9 10.1)"],
    ]) {
      const glyph = glyphLayer(tool).querySelectorAll("path, text, circle")[1];
      expect([tool, glyph?.getAttribute("transform")?.includes(turn as string)]).toEqual([
        tool,
        true,
      ]);
    }
  });
});

/**
 * The key in the Arrow's flyout is the cursor it stands for. The placings are
 * read from one place by both, but each key still draws its own marks, so what
 * is checked here is that the two have not come apart: the same marks, in the
 * same ink, in the same place beside the arrow.
 */
describe("the key that stands for an arming", () => {
  const keys: Record<string, () => React.JSX.Element> = {
    points: ArrowPointsIcon,
    paths: ArrowPathsIcon,
    marks: ArrowMarksIcon,
    text: ArrowTextIcon,
  };

  it("draws the arrow the cursor draws, in the Arrow's own ink", () => {
    for (const [arming, Key] of Object.entries(keys)) {
      cleanup();
      const { container } = render(<Key />);
      const arrow = [...container.querySelectorAll("path")].filter(
        (one) => one.getAttribute("d") === ARROW_PATH,
      );
      expect([arming, arrow.length]).toEqual([arming, 1]);
      expect([arming, arrow[0]?.getAttribute("transform")]).toEqual([arming, ARROW_AT]);
      expect([arming, arrow[0]?.getAttribute("fill")]).toEqual([arming, CURSORS.arrow?.ink]);
    }
  });

  it("puts the same glyph in the same ink and the same place as the cursor", () => {
    for (const [arming, Key] of Object.entries(keys)) {
      cleanup();
      const { container } = render(<Key />);
      const badge = BADGES[`arrow.${arming}`];
      const glyph = [...container.querySelectorAll("path, circle, text")].filter(
        (one) => one.getAttribute("d") !== ARROW_PATH,
      );
      expect([arming, glyph.length]).toEqual([arming, badge?.marks.length]);
      for (const [nth, one] of glyph.entries()) {
        // The very shape the cursor draws, not merely one of the same arity.
        const mark = badge?.marks[nth];
        if (mark && "d" in mark) expect([arming, one.getAttribute("d")]).toEqual([arming, mark.d]);
        if (mark && "r" in mark) {
          expect([arming, one.getAttribute("r")]).toEqual([arming, String(mark.r)]);
        }
        if (mark && "ch" in mark) {
          expect([arming, one.textContent]).toEqual([arming, mark.ch]);
        }
        // A mark carries its placing and its ink itself, or takes them from the
        // group it is drawn in, which is how the multi-part glyphs are written.
        const of = (name: string) =>
          one.getAttribute(name) ?? one.parentElement?.getAttribute(name);
        expect([arming, of("transform")]).toEqual([arming, badge?.at]);
        const stroke = of("stroke");
        expect([arming, stroke && stroke !== "none" ? stroke : of("fill")]).toEqual([
          arming,
          badge?.ink,
        ]);
      }
    }
  });
});
