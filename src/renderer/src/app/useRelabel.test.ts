import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Naming } from "./labels";
import { placeOf, useRelabel } from "./useRelabel";

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

/** Only one call of the naming bundle is a run's to make, so the rest is left out. */
function stubNaming(given: Map<string, string>): Naming {
  return { labelAs: (id: string, name: string) => given.set(id, name) } as unknown as Naming;
}

describe("a run and the tool it belongs to", () => {
  it("hands out the letters in order as the vertices are clicked", () => {
    const given = new Map<string, string>();
    const { result, rerender } = renderHook(
      (names: Map<string, string>) => useRelabel({ armed: true, naming: stubNaming(given), names }),
      { initialProps: given },
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.startFrom("A"));
    expect(given.get("one")).toBe("A");
    rerender(given);
    expect(result.current.nextName).toBe("B");

    act(() => result.current.give("two"));
    expect(given.get("two")).toBe("B");
    rerender(given);
    expect(result.current.nextName).toBe("C");
  });

  it("leaves the second vertex clicked alone while the box is still up", () => {
    const given = new Map<string, string>();
    const { result } = renderHook(() =>
      useRelabel({ armed: true, naming: stubNaming(given), names: given }),
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.ask("two", { x: 50, y: 0 }));
    // The box stands beside the vertex it is about, so it stays about that one.
    expect(result.current.asked?.id).toBe("one");
  });

  it("ends when the tool is put down, wherever it had got to", () => {
    const given = new Map<string, string>();
    const { result, rerender } = renderHook(
      (armed: boolean) => useRelabel({ armed, naming: stubNaming(given), names: given }),
      { initialProps: true },
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.startFrom("A"));
    rerender(false);
    expect(result.current.nextName).toBeNull();
    expect(result.current.asked).toBeNull();
  });
});
