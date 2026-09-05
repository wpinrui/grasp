// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
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

/** Two points the script has named, so a description can lean on their names. */
const NAMED = 'const A = point(0, 0);\nconst B = point(90, 0);\nlabel(A, "A");\nlabel(B, "B");\n';

/**
 * A script is turned down more often than it is run, and what it is told is
 * read by whoever wrote it, which is these days usually a language model with
 * nothing to go on but the message and its own source. So the message has to
 * say where in that source to look, which call it was, and what to do next.
 */
describe("what a rejected script is told", () => {
  it("names an object by the label the script gave it, never by its id", () => {
    const said = turnedDownFor(`${NAMED}angleMark(A, B, B);`);
    expect(said).toContain("nothing joins A to B");
    expect(said).not.toMatch(AN_ID);
  });

  it("says where a plotted point sits where the script never named it", () => {
    const said = turnedDownFor(
      "const A = point(0, 0);\nconst B = point(90, 0);\nangleMark(A, B, B);",
    );
    expect(said).toContain("nothing joins the point at (0, 0) to the point at (90, 0)");
    expect(said).not.toMatch(AN_ID);
  });

  // A part of a description stops at its own name, or at its own kind where it
  // has no name. So the unnamed circle inside a crossing is "a circle" and not
  // another description: a chain of them would say nothing all the way down.
  it.each([
    ["midpoint(A, B)", "the point halfway between A and B"],
    ["intersect(circle(A, B), circle(B, A))", "the point where a circle and a circle cross"],
    ["pointOn(segment(A, B), 0.5)", "the point riding a segment"],
    ["reflect(A, segment(A, B))", "A mirrored in a segment"],
    ["translate(A, 5, 5)", "A moved"],
    ["rotate(A, B, 90)", "A turned about B"],
    ["dilate(A, B, 2)", "A scaled about B"],
  ])("says how a point built with %s was made", (made, phrase) => {
    expect(turnedDownFor(`${NAMED}const M = ${made};\nangleMark(M, A, A);`)).toContain(phrase);
  });

  // Handed where a point was wanted, which is the other way one of these
  // reaches a message.
  it.each([
    ["segment(A, B)", "the segment from A to B"],
    ["ray(A, B)", "the ray from A to B"],
    ["bisector(A, B, B)", "the line halving the angle at A"],
    ["perpendicular(A, segment(A, B))", "the line through A, perpendicular to a segment"],
    ["parallel(A, segment(A, B))", "the line through A, parallel to a segment"],
    ["circle(A, B)", "the circle about A"],
  ])("says how a path built with %s was made", (made, phrase) => {
    expect(turnedDownFor(`${NAMED}midpoint(${made}, A);`)).toContain(phrase);
  });

  it.each([
    ["arcThrough(A, B, A)", "an arc"],
    ["polygon(A, B, A)", "a fill"],
    ['caption(0, 0, "x")', "a caption"],
  ])("says what kind of thing %s made, where it can say no more", (made, phrase) => {
    expect(turnedDownFor(`${NAMED}midpoint(${made}, A);`)).toContain(phrase);
  });

  it("says what a marking is, which nothing else in a message reaches", () => {
    const said = turnedDownFor(`${NAMED}segment(A, B);\nmidpoint(angleMark(A, B, B), A);`);
    expect(said).toContain("a marking");
  });

  it("says which line of the script and which call it was", () => {
    expect(turnedDownFor(`${NAMED}angleMark(A, B, B);`)).toContain("Line 5, angleMark:");
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
    const said = turnedDownFor(`${NAMED}angleMark(A, B, B);`);
    expect(said).toContain("Draw a segment, ray or line between them first");
  });

  it("says what a named object is where a point was wanted", () => {
    const said = turnedDownFor(`${NAMED}const s = segment(A, B);\nlabel(s, "s");\nmidpoint(s, A);`);
    expect(said).toContain("s is a segment, and a point was wanted.");
  });

  it("says what an unnamed object is where a point was wanted, without saying it twice", () => {
    const said = turnedDownFor(
      "const A = point(0, 0);\nconst B = point(9, 0);\nmidpoint(segment(A, B), A);",
    );
    expect(said).toContain("a point was wanted");
    expect(said.match(/segment/g)).toHaveLength(1);
  });

  it("says how many corners a polygon was actually given", () => {
    expect(turnedDownFor("polygon(point(0, 0), point(9, 0));")).toContain("was given 2");
  });

  it("says the line of a plain JavaScript mistake, which has no call to name", () => {
    expect(turnedDownFor("const A = point(0, 0);\nlet x;\nx.y = 1;")).toMatch(/^Line 3: /);
  });

  it("says plainly when a handle was never set", () => {
    const said = turnedDownFor("let gone;\nsegment(gone, gone);");
    expect(said).toContain("Line 2, segment:");
    expect(said).toContain("undefined is not a handle from this page");
  });

  it("reads the line off a frame, not off a message that looks like one", () => {
    // The handle is quoted back into the message, so a stack read whole would
    // find this before the frame below it and report line 1.
    const said = turnedDownFor('const A = point(0, 0);\nsegment("<anonymous>:1:1", A);');
    expect(said).toContain("Line 2, segment:");
  });

  it("says an object was taken off the page rather than quoting its handle back", () => {
    const said = turnedDownFor(`${NAMED}remove(A);\nmidpoint(A, B);`);
    expect(said).toContain("that handle is not on this page");
    expect(said).not.toMatch(AN_ID);
  });

  it("says a handle back as it was written where nothing answers to it", () => {
    // Never on the page rather than taken off it: nothing that was on the page
    // can go, since remove takes everything built on it too. Saying it had gone
    // would send the reader looking for a removal that never happened.
    const said = turnedDownFor(
      `${NAMED}const X = intersect(circle(A, B), "wobble");\nangleMark(X, A, A);`,
    );
    expect(said).toContain('"wobble"');
    expect(said).not.toContain("no longer on the page");
  });

  it("still turns down a call GRASP does not have", () => {
    expect(turnedDownFor("hexagon(0, 0);")).toBe("GRASP has no hexagon(). Nothing was drawn.");
  });
});

/**
 * An engine that will not say which line a failure came from, which is any
 * engine whose stacks this cannot read. Taking the frames away is how that is
 * reached here without changing the code under test.
 */
describe("what a rejected script is told where the engine gives no line", () => {
  const frames = Error.stackTraceLimit;

  afterEach(() => {
    Error.stackTraceLimit = frames;
  });

  it("says which call of that name it was instead", () => {
    // Calibrated while there are still frames to calibrate against, the way a
    // real run in this engine would have been.
    turnedDownFor(`${NAMED}angleMark(A, B, B);`);
    Error.stackTraceLimit = 0;
    // The first angleMark has its sides drawn and works, so a count that was
    // always one, or shared between calls, would come out wrong here.
    const said = turnedDownFor(
      `${NAMED}segment(A, B);\nangleMark(A, B, B);\nconst C = point(0, 90);\nangleMark(A, C, C);`,
    );
    expect(said).toContain("angleMark call 2:");
    expect(said).toContain("nothing joins A to the point at (0, 90)");
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

  it("writes an async arrow, which is a name with a bracket after it too", () => {
    expect(drawn("const twice = async (n) => n * 2;\npoint(3, 0);")).toBe(1);
  });

  it("still has no way to fetch over the network", () => {
    // `import(...)` really is a call, so it stays off the list of words that
    // only look like one.
    expect(turnedDownFor('import("https://example.com/x.js");')).toContain("GRASP has no import()");
  });
});
