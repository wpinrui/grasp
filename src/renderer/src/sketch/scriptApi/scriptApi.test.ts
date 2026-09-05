// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPoint, isLine, isPoint } from "../model";
import { apiNames } from "./calls";
import { apiReferenceDrift, describedNames } from "./reference";
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
  "showLabel",
  "hideLabel",
  "hide",
  "show",
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

  it("and its reference say the same thing", () => {
    expect(apiReferenceDrift()).toEqual({ undescribed: [], stale: [] });
  });

  it("would notice either of them drifting from the other", () => {
    const described = describedNames();
    expect(apiReferenceDrift(["point", "hexagon"], described).undescribed).toContain("hexagon");
    expect(apiReferenceDrift(apiNames(), [...described, "octagon"]).stale).toEqual(["octagon"]);
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
    const page = [createPoint({ x: 5, y: 5 }, "medium")];
    // A snapshot, so an edit in place on what is already there is caught too.
    const already = structuredClone(page);
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

/**
 * The two halves the words used to be muddled between: what is drawn at all,
 * and whether the name beside it is drawn.
 */
describe("taking something out of view", () => {
  function ran(script: string) {
    const result = evaluate(script, { objects: [], sheet: SHEET });
    expect(result.ok).toBe(true);
    return result.ok ? result.objects : [];
  }

  it("hides the object itself, not its name", () => {
    const [made] = ran('const a = point(0, 0); label(a, "A"); hide(a);');
    expect(made.hidden).toBe(true);
    expect(made.label?.shown).toBe(true);
  });

  it("brings a hidden object back", () => {
    const [made] = ran("const a = point(0, 0); hide(a); show(a);");
    expect(made.hidden).toBe(false);
  });

  it("leaves what was built on a hidden object where it is", () => {
    const objects = ran(
      "const a = point(0, 0); const b = point(100, 0); const m = midpoint(a, b); hide(m); segment(a, m);",
    );
    // Hiding takes one object out of view and nothing else with it, unlike
    // remove, which takes the dependents too.
    expect(objects.filter((object) => object.hidden === true)).toHaveLength(1);
    const points = objects.filter(isPoint);
    expect(points).toHaveLength(3);
    expect(objects.filter(isLine)).toHaveLength(1);
    // The midpoint is out of view and still worked out, so the segment drawn to
    // it still runs where it did.
    expect(points[2]).toMatchObject({ x: 50, y: 0 });
  });

  it("takes a name off without taking the object off", () => {
    const [made] = ran('const a = point(0, 0); label(a, "A"); hideLabel(a);');
    expect(made.label?.shown).toBe(false);
    expect(made.hidden).toBeUndefined();
  });

  it("puts a name back", () => {
    const [made] = ran('const a = point(0, 0); label(a, "A"); hideLabel(a); showLabel(a);');
    expect(made.label?.shown).toBe(true);
  });

  it.each(["hide", "show", "hideLabel", "showLabel"])(
    "says so when there is nothing by that name for %s to work on",
    (call) => {
      const result = evaluate(`${call}("nothing");`, { objects: [], sheet: SHEET });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toEqual([
        `Line 1, ${call}: "nothing" is not a handle from this page. Pass back what a call handed you.`,
      ]);
    },
  );
});
