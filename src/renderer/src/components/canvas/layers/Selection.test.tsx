import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createInterior,
  createPoint,
  lineThrough,
  type SketchObject,
  settle,
} from "../../../sketch/model";
import { type Sheet, SheetProvider } from "../SheetContext";
import { Fills } from "./Fills";
import { Paths } from "./Paths";
import { Selection } from "./Selection";

afterEach(cleanup);

/** The three layers in the order the canvas paints them. */
function draw(objects: SketchObject[], selection: string[], scale = 1) {
  const page = settle(objects);
  const sheet: Sheet = {
    objects: page.objects,
    everything: objects,
    settled: page.settled,
    selection,
    scale,
    ends: page.settled.points,
    spanOf: (line) => {
      const span = page.settled.lines.get(line.id);
      return span ? [span.a, span.b] : null;
    },
    shown: { x: 0, y: 0, width: 800, height: 600 },
  };
  return render(
    <SheetProvider value={sheet}>
      <svg aria-hidden="true">
        <Fills />
        <Selection />
        <Paths />
      </svg>
    </SheetProvider>,
  ).container;
}

function polygons(colours: string[]) {
  return colours.flatMap((colour, index) => {
    const shift = index * 28;
    const points = [
      [80, 80],
      [360, 80],
      [320, 300],
      [100, 300],
    ].map(([x, y]) => createPoint({ x: x + shift, y: y + shift }, "medium"));
    return [
      ...points,
      { ...createInterior(points.map((point) => point.id)), id: `fill-${index}`, colour },
    ];
  });
}

/**
 * Whether one element is painted after another, so it covers it. Within this
 * suite the layers are written in the order `draw` lists them; what it is worth
 * asserting here is that the overlay does not slip a fill in among them.
 */
function paintedAfter(later: Element, earlier: Element): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe("geometry selection contrast", () => {
  it.each([
    Array(5).fill("--color-ink-blue"),
    [
      "--color-ink-blue",
      "--color-ink-red",
      "--color-ink-green",
      "--color-ink-purple",
      "--color-ink-orange",
    ],
  ])("stripes only selected fills above all five overlapping fills: %j", (...colours) => {
    const container = draw(polygons(colours), ["fill-0", "fill-2", "fill-4"]);
    const overlay = container.querySelector(".canvas__selection");
    if (!overlay) throw new Error("There is no selection overlay.");
    for (const fill of container.querySelectorAll(".canvas__interior")) {
      expect(paintedAfter(overlay, fill)).toBe(true);
    }
    expect(
      [...container.querySelectorAll("[data-selection-id]")].map((node) =>
        node.getAttribute("data-selection-id"),
      ),
    ).toEqual(["fill-0", "fill-2", "fill-4"]);
    for (const [index, colour] of colours.entries()) {
      const fill = container.querySelector(`[data-id="fill-${index}"]`);
      expect(fill?.getAttribute("style")).toContain(`fill: var(${colour})`);
      expect(fill?.getAttribute("style")).toContain("fill-opacity: 0.25");
      const outlines = container.querySelectorAll(`[data-selection-id="fill-${index}"] polygon`);
      expect(outlines).toHaveLength(index % 2 === 0 ? 1 : 0);
      for (const outline of outlines) {
        expect(outline.getAttribute("points")).toBe(fill?.getAttribute("points"));
      }
    }
  });

  it("shades every selected fill through one pattern, whatever their own colours", () => {
    const container = draw(polygons(["--color-ink-blue", "--color-ink-red", "--color-ink-green"]), [
      "fill-0",
      "fill-1",
      "fill-2",
    ]);
    const patterns = container.querySelectorAll("pattern");
    expect(patterns).toHaveLength(1);
    const used = [...container.querySelectorAll(".canvas__selection-fill")].map((outline) =>
      outline.getAttribute("style"),
    );
    expect(used).toHaveLength(3);
    expect(new Set(used)).toEqual(new Set([`fill: url("#${patterns[0].id}");`]));
  });

  it.each([0.25, 1, 4])("keeps stripe spacing constant on screen at zoom %s", (scale) => {
    const container = draw(polygons(["--color-ink-blue"]), ["fill-0"], scale);
    const pattern = container.querySelector("pattern");
    expect(pattern?.getAttribute("width")).toBe("12");
    expect(pattern?.getAttribute("patternTransform")).toBe(`rotate(45) scale(${1 / scale})`);
    // The width the README quotes, kept beside the tile it is a fraction of.
    expect(pattern?.querySelector<SVGElement>(".canvas__selection-stripe")?.style.strokeWidth).toBe(
      "5",
    );
  });

  it("keeps the stripes at 45 degrees however many fills are held", () => {
    const objects = polygons(Array(5).fill("--color-ink-blue"));
    const all = draw(objects, ["fill-0", "fill-1", "fill-2", "fill-3", "fill-4"]);
    const direction = all.querySelector("pattern")?.getAttribute("patternTransform");
    expect(direction).toBe("rotate(45) scale(1)");
    cleanup();
    const one = draw(objects, ["fill-2"]);
    expect(one.querySelector("pattern")?.getAttribute("patternTransform")).toBe(direction);
  });

  it("composites all stripes in one fifteen-percent layer so overlapping selections do not accumulate darkness", () => {
    const container = draw(polygons(Array(5).fill("--color-ink-blue")), [
      "fill-0",
      "fill-1",
      "fill-2",
      "fill-3",
      "fill-4",
    ]);
    const layers = container.querySelectorAll(".canvas__selection-fills");
    expect(layers).toHaveLength(1);
    expect(layers[0].getAttribute("opacity")).toBe("0.15");
    expect(layers[0].querySelectorAll(".canvas__selection-fill")).toHaveLength(5);
  });

  function blueLine(weight: "hairline" | "thin" | "medium" | "thick", id = "line") {
    const a = createPoint({ x: 40, y: 40 }, "medium");
    const b = createPoint({ x: 400, y: 40 }, "medium");
    return [
      a,
      b,
      {
        ...lineThrough("segment", [a.id, b.id]),
        id,
        colour: "--color-ink-blue",
        weight,
        pattern: "dashed" as const,
      },
    ];
  }

  it.each(["hairline", "thin", "medium", "thick"] as const)(
    "keeps contrasting rails outside a %s blue line",
    (weight) => {
      const container = draw(blueLine(weight), ["line"]);
      const overlay = container.querySelector(".canvas__selection");
      const original = container.querySelector<SVGElement>(`[data-id="line"] .canvas__line`);
      const white = overlay?.querySelector<SVGElement>(".canvas__selection-paper");
      const blue = overlay?.querySelector<SVGElement>(".canvas__selection-dashes");
      const highlight = overlay?.querySelector<SVGElement>(".canvas__selection-highlight");
      if (!overlay || !original) throw new Error("The line is not drawn with its selection.");
      expect(highlight?.style.strokeWidth).toBe("7");
      expect(highlight?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
      // The overlay never draws the object, only the bands around it. Paths
      // paints the stroke one layer up, which is what the snapshot pins.
      expect(overlay.querySelector(".canvas__line")).toBe(null);
      expect(original.style.stroke).toBe("var(--color-ink-blue)");
      expect(original.style.strokeDasharray).toBe("6 4");
      expect(Number(blue?.style.strokeWidth)).toBe(Number(original.style.strokeWidth) + 6);
      expect(Number(white?.style.strokeWidth)).toBe(Number(original.style.strokeWidth) + 8);
      expect(blue?.style.stroke).toBe("");
    },
  );

  it("paints each band across every selected path, so two that cross do not notch each other", () => {
    const [a, b, across] = blueLine("medium", "across");
    const top = createPoint({ x: 220, y: 0 }, "medium");
    const foot = createPoint({ x: 220, y: 200 }, "medium");
    const down = {
      ...lineThrough("segment", [top.id, foot.id]),
      id: "down",
      colour: "--color-ink-red",
      weight: "medium" as const,
    };
    const container = draw([a, b, across, top, foot, down], ["across", "down"]);
    const bands = [...(container.querySelector(".canvas__selection")?.children ?? [])];
    // Widest rail, dashes, inner rail, then the highlights: four passes, each
    // holding both paths, rather than one stack of four per path.
    expect(bands).toHaveLength(4);
    for (const band of bands) expect(band.querySelectorAll("line")).toHaveLength(2);
    expect(bands.map((band) => band.firstElementChild?.getAttribute("class"))).toEqual([
      "canvas__selection-paper",
      "canvas__selection-dashes",
      "canvas__selection-paper",
      "canvas__selection-highlight",
    ]);
  });

  it("removes all selection decoration when deselected", () => {
    const container = draw(polygons(Array(5).fill("--color-ink-blue")), []);
    expect(container.querySelector(".canvas__selection")?.children).toHaveLength(0);
  });
});
