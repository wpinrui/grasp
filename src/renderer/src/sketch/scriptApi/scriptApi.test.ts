// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint, isLine, isPoint } from "../model";
import { apiNames } from "./calls";
import { missingFromApiReference } from "./reference";
import { evaluate, unknownCalls } from "./sandbox";

/**
 * The API is assembled from several groups of calls, so the names it ends up
 * with are worth pinning: a group left out of the assembly would otherwise
 * only show up as a script that stopped working.
 */
const CALLS = [
  "sheet",
  "point",
  "midpoint",
  "intersect",
  "pointOn",
  "translate",
  "rotate",
  "dilate",
  "reflect",
  "segment",
  "ray",
  "line",
  "parallel",
  "perpendicular",
  "bisector",
  "circle",
  "circleRadius",
  "arcOn",
  "arcAt",
  "arcThrough",
  "polygon",
  "fill",
  "sector",
  "segmentOf",
  "tick",
  "parallelMark",
  "angleMark",
  "caption",
  "measure",
  "label",
  "show",
  "hide",
  "style",
  "size",
  "all",
  "kindOf",
  "at",
  "nameOf",
  "byLabel",
  "remove",
];

const SHEET = { width: 800, height: 600, pixelRatio: 1 };

describe("the API a script is run with", () => {
  it("offers every call, in the order the groups are assembled in", () => {
    expect(apiNames()).toEqual(CALLS);
  });

  it("describes every call it offers", () => {
    expect(missingFromApiReference()).toEqual([]);
  });
});

describe("running a script", () => {
  it("lands what the script drew", () => {
    const result = evaluate("const a = point(0, 0); const b = point(100, 0); segment(a, b);", {
      objects: [],
      sheet: SHEET,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.objects.filter(isPoint)).toHaveLength(2);
    expect(result.objects.filter(isLine)).toHaveLength(1);
  });

  it("leaves the page as it found it when a call fails", () => {
    const already = [createPoint({ x: 5, y: 5 }, "medium")];
    const page = [...already];
    const result = evaluate('point(0, 0); segment("nothing", "either");', {
      objects: page,
      sheet: SHEET,
    });
    expect(result.ok).toBe(false);
    // The run builds into a list of its own, so the caller's page is untouched.
    expect(page).toEqual(already);
  });

  it("reports a call the API does not have before running anything", () => {
    const result = evaluate("hexagon(0, 0);", { objects: [], sheet: SHEET });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(["GRASP has no hexagon(). Nothing was drawn."]);
  });

  it("leaves a name the script binds itself alone", () => {
    expect(unknownCalls("function mine() {} mine();", apiNames())).toEqual([]);
  });

  it("keeps what was already on the page", () => {
    const first = evaluate("point(10, 10);", { objects: [], sheet: SHEET });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = evaluate("point(20, 20);", { objects: first.objects, sheet: SHEET });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.objects.filter(isPoint)).toHaveLength(2);
  });
});
