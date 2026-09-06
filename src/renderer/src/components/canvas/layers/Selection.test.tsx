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
        <Paths />
        <Selection />
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
  ])("outlines only selected fills above all five overlapping fills: %j", (...colours) => {
    const container = draw(polygons(colours), ["fill-0", "fill-2", "fill-4"]);
    const svg = container.querySelector("svg");
    const overlay = container.querySelector(".canvas__selection");
    expect(svg?.lastElementChild).toBe(overlay);
    expect(
      [...container.querySelectorAll("[data-selection-id]")].map((node) =>
        node.getAttribute("data-selection-id"),
      ),
    ).toEqual(["fill-0", "fill-2", "fill-4"]);
    expect(overlay?.querySelectorAll(".canvas__selection-corner")).toHaveLength(12);
    for (const id of ["fill-0", "fill-2", "fill-4"]) {
      const fill = container.querySelector(`[data-id="${id}"]`);
      const outlines = container.querySelectorAll(`[data-selection-id="${id}"] polygon`);
      expect(outlines).toHaveLength(2);
      for (const outline of outlines) {
        expect(outline.getAttribute("points")).toBe(fill?.getAttribute("points"));
        expect(outline.getAttribute("vector-effect")).toBe("non-scaling-stroke");
      }
      expect(fill?.getAttribute("style")).toContain("fill-opacity: 0.25");
    }
  });

  it.each([0.25, 1, 4])("keeps corner markers six screen pixels wide at zoom %s", (scale) => {
    const container = draw(polygons(["--color-ink-blue"]), ["fill-0"], scale);
    const corner = container.querySelector(".canvas__selection-corner");
    expect(Number(corner?.getAttribute("width")) * scale).toBe(6);
  });

  it.each(["hairline", "thin", "medium", "thick"] as const)(
    "keeps contrasting rails outside a %s blue line",
    (weight) => {
      const a = createPoint({ x: 40, y: 40 }, "medium");
      const b = createPoint({ x: 400, y: 40 }, "medium");
      const line = {
        ...lineThrough("segment", [a.id, b.id]),
        colour: "--color-ink-blue",
        weight,
        pattern: "dashed" as const,
      };
      const container = draw([a, b, line], [line.id]);
      const overlay = container.querySelector(".canvas__selection");
      const original = overlay?.querySelector<SVGElement>(".canvas__line");
      const white = overlay?.querySelector<SVGElement>(".canvas__selection-paper");
      const dark = overlay?.querySelector<SVGElement>(".canvas__selection-ink");
      expect(original?.style.stroke).toBe("var(--color-ink-blue)");
      expect(original?.style.strokeDasharray).toBe("6 4");
      expect(Number(dark?.style.strokeWidth)).toBe(Number(original?.style.strokeWidth) + 8);
      expect(Number(white?.style.strokeWidth)).toBe(Number(original?.style.strokeWidth) + 11);
      expect(dark?.style.stroke).toBe("");
    },
  );

  it("removes all selection decoration when deselected", () => {
    const container = draw(polygons(Array(5).fill("--color-ink-blue")), []);
    expect(container.querySelector(".canvas__selection")?.children).toHaveLength(0);
  });
});
