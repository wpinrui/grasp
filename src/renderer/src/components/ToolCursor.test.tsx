/**
 * The cursor GRASP draws for itself. What matters is that both layers are
 * there and agree, that the hotspot lands where the click does, and that a
 * tool with no glyph of its own is left the cursor the stylesheet gives it.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CURSOR_BOX, GLYPH, HOTSPOT } from "./cursorGeometry";
import { cursorDrawnFor, ToolCursor } from "./ToolCursor";

afterEach(cleanup);

const AT = { x: 200, y: 140 };

function drawn(tool: string, arrowKind?: string) {
  return render(<ToolCursor tool={tool} arrowKind={arrowKind} at={AT} />).container;
}

describe("which tools GRASP draws a cursor for", () => {
  it("draws one for every tool in the rail", () => {
    for (const tool of [
      "arrow",
      "point",
      "compass",
      "straightedge",
      "polygon",
      "text",
      "measure",
      "marker",
    ]) {
      expect(cursorDrawnFor(tool)).toBe(true);
    }
  });

  it("draws none for the hand or for the Text tool over something named", () => {
    // Both keep what Canvas.css gives them: grab, and the pointer.
    expect(cursorDrawnFor("hand")).toBe(false);
    expect(cursorDrawnFor("text-label")).toBe(false);
  });
});

describe("the cursor on the sheet", () => {
  it("draws nothing with the pointer off the sheet", () => {
    const { container } = render(<ToolCursor tool="point" at={null} />);
    expect(container.querySelector(".tool-cursor")).toBeNull();
  });

  it("draws nothing for a tool with no glyph, whatever the pointer is doing", () => {
    expect(drawn("hand").querySelector(".tool-cursor")).toBeNull();
  });

  it("draws two layers, the outline and the glyph over it", () => {
    const layers = drawn("point").querySelectorAll(".tool-cursor");
    expect(layers.length).toBe(2);
    // The outline is the one that inverts against whatever is under it.
    expect(layers[0].classList.contains("tool-cursor--outline")).toBe(true);
    expect(layers[1].classList.contains("tool-cursor--outline")).toBe(false);
  });

  it("puts the hotspot where the pointer is, not the corner of the box", () => {
    const layer = drawn("compass").querySelector(".tool-cursor") as SVGElement;
    expect(layer.style.left).toBe(`${AT.x - HOTSPOT.x}px`);
    expect(layer.style.top).toBe(`${AT.y - HOTSPOT.y}px`);
    expect(layer.getAttribute("viewBox")).toBe(`0 0 ${CURSOR_BOX} ${CURSOR_BOX}`);
  });

  it("draws the same marks in both layers, so the outline cannot miss one", () => {
    const layers = drawn("marker").querySelectorAll(".tool-cursor");
    const marks = (layer: Element) =>
      [...layer.querySelectorAll("path, text")].map((one) => one.tagName);
    expect(marks(layers[0])).toEqual(marks(layers[1]));
    // The gapped crosshair, and the tool's own glyph over it.
    expect(marks(layers[0]).length).toBe(4 + GLYPH.marker.length);
  });

  it("runs the outline wider than the glyph, which is what leaves a halo", () => {
    const layers = drawn("polygon").querySelectorAll(".tool-cursor");
    const width = (layer: Element) =>
      Number((layer.querySelector("path") as SVGElement).getAttribute("stroke-width"));
    expect(width(layers[0])).toBeGreaterThan(width(layers[1]));
  });

  it("badges the Arrow with what it is armed to pick up, and only the Arrow", () => {
    const armed = drawn("arrow", "points").querySelectorAll(".tool-cursor")[1];
    const plain = drawn("arrow", "all").querySelectorAll(".tool-cursor")[1];
    expect(armed.querySelectorAll("path").length).toBeGreaterThan(
      plain.querySelectorAll("path").length,
    );
    // A drawing tool's variant changes what the click makes, which the sheet
    // shows as it is made, so it carries no badge.
    const straightedge = drawn("straightedge", "points").querySelectorAll(".tool-cursor")[1];
    expect(straightedge.querySelectorAll("path").length).toBe(4 + GLYPH.straightedge.length);
  });

  it("draws each tool in its own hue, so the cursor and the rail key match", () => {
    const inkOf = (tool: string) => {
      const layer = drawn(tool).querySelectorAll(".tool-cursor")[1];
      return (layer.querySelector("path, text") as SVGElement).getAttribute("stroke");
    };
    expect(inkOf("point")).toBe("var(--color-tool-point)");
    expect(inkOf("compass")).toBe("var(--color-tool-compass)");
    expect(inkOf("marker")).toBe("var(--color-tool-marker)");
  });
});
