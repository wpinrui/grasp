// @vitest-environment node
import { describe, expect, it } from "vitest";
import { placeOf } from "./useRelabel";

/**
 * A run reads its place off the page rather than counting the letters it has
 * handed out, so nothing has to tell it about an undo. These are the cases that
 * distinguish the two: undoing the vertex just named must bring its letter
 * round again, and undoing anything else must leave the run alone.
 */
describe("where a relabel run has got to", () => {
  const run = { from: "A", given: ["one", "two", "three"] };
  const held = (...names: string[]) =>
    new Map(names.map((name, at) => [run.given[at], name] as const));

  it("is as far as the page still answers to its letters", () => {
    expect(placeOf(run, held("A", "B", "C"))).toBe(3);
  });

  it("comes back one when the last vertex named gives its letter up", () => {
    // What an undo of that naming leaves: two vertices still lettered, and the
    // third back to whatever it was. C is the next name going again.
    expect(placeOf(run, held("A", "B"))).toBe(2);
  });

  it("stands still while its own letters are untouched", () => {
    // An undo of something else entirely: a label dragged, a hide, a paste.
    // The run has not moved, so the next name is still C.
    expect(placeOf(run, held("A", "B", "C"))).toBe(3);
  });

  it("stops at the first letter the page has lost, not the last", () => {
    // The middle one was renamed by hand. The run stands behind A only.
    expect(placeOf(run, held("A", "Q", "C"))).toBe(1);
  });

  it("is nowhere when the run's first vertex has lost its letter", () => {
    expect(placeOf(run, held("Q", "B", "C"))).toBe(0);
    expect(placeOf(run, new Map())).toBe(0);
  });

  it("counts a vertex named twice as one, so the second undo is not needed", () => {
    // A vertex clicked twice by mistake: it holds B, so A is no longer on the
    // page and the run is back at the start until the undo puts A back.
    const twice = { from: "A", given: ["one", "one"] };
    expect(placeOf(twice, new Map([["one", "B"]]))).toBe(0);
    expect(placeOf(twice, new Map([["one", "A"]]))).toBe(1);
  });
});
