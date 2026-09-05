// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluate } from "./sandbox";

const SHEET = { width: 800, height: 600, pixelRatio: 1 };

/** An id as `nextId` writes one: a kind, a count, and the run's own token. */
const AN_ID = /-\d+-[a-z0-9]{6}\b/;

function turnedDownFor(script: string): string {
  const result = evaluate(script, { objects: [], sheet: SHEET });
  expect(result.ok, `expected this to be turned down:\n${script}`).toBe(false);
  return result.ok ? "" : result.errors.join("\n");
}

function drawn(script: string): number {
  const result = evaluate(script, { objects: [], sheet: SHEET });
  expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
  return result.ok ? result.objects.length : 0;
}

/**
 * A script is turned down more often than it is run, and what it is told is
 * read by whoever wrote it, which is these days usually a language model with
 * nothing to go on but the message and its own source. So the message has to
 * say where in that source to look, which call it was, and what to do next.
 */
describe("what a rejected script is told", () => {
  const triangle = 'const A = point(0, 0);\nconst B = point(90, 0);\nlabel(A, "A");\n';

  it("names an object by the label the script gave it, never by its id", () => {
    const said = turnedDownFor(`${triangle}angleMark(A, B, B);`);
    expect(said).toContain("A");
    expect(said).not.toMatch(AN_ID);
  });

  it("says how an object was built where the script never named it", () => {
    const said = turnedDownFor(
      "const A = point(0, 0);\nconst B = point(90, 0);\nmidpoint(A, B);\nangleMark(A, B, B);",
    );
    expect(said).toContain("the point at (0, 0)");
    expect(said).not.toMatch(AN_ID);
  });

  it("says which line of the script and which call it was", () => {
    const said = turnedDownFor(`${triangle}angleMark(A, B, B);`);
    expect(said).toContain("Line 4, angleMark:");
  });

  it("counts the line from the script's own first line, however deep the call was", () => {
    // Written inside a function of the script's own, so the failure is further
    // down the stack than a call written straight into the body.
    const said = turnedDownFor(
      "const A = point(0, 0);\nconst B = point(90, 0);\nfunction mark() {\n  angleMark(A, B, B);\n}\nmark();",
    );
    expect(said).toContain("Line 4,");
  });

  it("says what to do about it", () => {
    const said = turnedDownFor(`${triangle}angleMark(A, B, B);`);
    expect(said).toContain("Draw a segment, ray or line between them first");
  });

  it("says what was passed where a point was wanted, without saying it twice", () => {
    const said = turnedDownFor(
      "const A = point(0, 0);\nconst B = point(9, 0);\nmidpoint(segment(A, B), A);",
    );
    expect(said).toContain("a point was wanted");
    expect(said.match(/segment/g)).toHaveLength(1);
  });

  it("says plainly when a handle was never set", () => {
    const said = turnedDownFor("let gone;\nsegment(gone, gone);");
    expect(said).toContain("Line 2, segment:");
    expect(said).toContain("undefined is not a handle from this page");
  });

  it("still turns down a call GRASP does not have", () => {
    expect(turnedDownFor("hexagon(0, 0);")).toBe("GRASP has no hexagon(). Nothing was drawn.");
  });
});

/**
 * The prompt has always told a script it may loop and branch. What turned those
 * away was the search for calls GRASP does not have, which reads any name with
 * a bracket after it as a call, and so read the language's own words as calls.
 */
describe("the language a script is written in", () => {
  it("branches", () => {
    expect(drawn("if (sheet.width > 10) { point(1, 1); } else { point(2, 2); }")).toBe(1);
  });

  it("loops", () => {
    expect(drawn("for (let i = 0; i < 3; i += 1) { point(i, i); }")).toBe(3);
  });

  it("loops while it has to", () => {
    expect(drawn("let i = 0;\nwhile (i < 4) { point(i, i); i += 1; }")).toBe(4);
  });

  it("switches, and tries and catches", () => {
    expect(drawn("switch (2) {\n case 2:\n  point(0, 0);\n  break;\n}")).toBe(1);
    expect(drawn("try { point(0, 0); } catch (trouble) { point(1, 1); }")).toBe(1);
  });

  it("returns a bracketed expression from a function of its own", () => {
    expect(drawn("function twice(n) {\n  return (n * 2);\n}\npoint(twice(3), 0);")).toBe(1);
  });
});
