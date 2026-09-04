import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Naming } from "./labels";
import { placeOf, useRelabel } from "./useRelabel";

/**
 * A run reads its place off the page rather than counting the letters it has
 * handed out, so nothing has to tell it about an undo. These are the cases that
 * distinguish the two: undoing the vertex just named must bring its letter
 * round again, undoing anything else must leave the run alone, and a letter the
 * page is still showing must never be handed out a second time.
 */
describe("where a relabel run has got to", () => {
  const run = { from: "A", given: ["one", "two", "three"] };
  const held = (...names: (string | null)[]) =>
    new Map(names.flatMap((name, at) => (name === null ? [] : [[run.given[at], name] as const])));

  it("is as far as the page still answers to its letters", () => {
    expect(placeOf(run, held("A", "B", "C"))).toBe(3);
  });

  it("comes back one when the last vertex named gives its letter up", () => {
    // What an undo of that naming leaves: two vertices still lettered, and the
    // third back to whatever it was. C is the next name going again.
    expect(placeOf(run, held("A", "B"))).toBe(2);
  });

  it("stands still while something else on the page changes", () => {
    // An undo of something else entirely: a label dragged, a hide, a paste. The
    // run's own three are untouched, so the next name is still C.
    const before = held("A", "B", "C");
    const after = new Map(before).set("elsewhere", "Q");
    expect(placeOf(run, before)).toBe(3);
    expect(placeOf(run, after)).toBe(3);
  });

  it("does not reverse over a letter the page is still showing", () => {
    // The middle vertex was deleted, or renamed by hand. C is still on the
    // third, so the run must not offer C again: it stands past all three.
    expect(placeOf(run, held("A", null, "C"))).toBe(3);
    expect(placeOf(run, held("A", "Q", "C"))).toBe(3);
  });

  it("is nowhere when the page holds none of its letters", () => {
    expect(placeOf(run, held("Q", "R", "S"))).toBe(0);
    expect(placeOf(run, new Map())).toBe(0);
  });

  it("stands behind the letter a vertex clicked twice actually holds", () => {
    // Clicked twice by mistake, so it holds B and nothing holds A. One undo
    // puts A back on it, and B is the next name going again.
    const twice = { from: "A", given: ["one", "one"] };
    expect(placeOf(twice, new Map([["one", "B"]]))).toBe(2);
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
      (names: Map<string, string>) =>
        useRelabel({ armed: true, naming: stubNaming(given), names, page: "one" }),
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

  it("gives a letter back and hands that same letter out again", () => {
    // The page giving a letter up is an undo. The run drops what it was holding
    // past that point, so the click after it carries on rather than sticking.
    const given = new Map<string, string>();
    const { result, rerender } = renderHook(
      (names: Map<string, string>) =>
        useRelabel({ armed: true, naming: stubNaming(given), names, page: "one" }),
      { initialProps: given },
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.startFrom("A"));
    act(() => result.current.give("two"));
    given.delete("two");
    rerender(given);
    expect(result.current.nextName).toBe("B");

    act(() => result.current.give("three"));
    expect(given.get("three")).toBe("B");
    rerender(given);
    expect(result.current.nextName).toBe("C");
  });

  it("leaves the second vertex clicked alone while the box is still up", () => {
    const given = new Map<string, string>();
    const { result } = renderHook(() =>
      useRelabel({ armed: true, naming: stubNaming(given), names: given, page: "one" }),
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.ask("two", { x: 50, y: 0 }));
    // The box stands beside the vertex it is about, so it stays about that one.
    expect(result.current.asked?.id).toBe("one");
  });

  it("ends when the tool is put down, whatever it was in the middle of", () => {
    const given = new Map<string, string>();
    const { result, rerender } = renderHook(
      (armed: boolean) =>
        useRelabel({ armed, naming: stubNaming(given), names: given, page: "one" }),
      { initialProps: true },
    );
    // Caught with the box still up, which is the state that has to be let go of
    // as well as the run itself.
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    rerender(false);
    expect(result.current.asked).toBeNull();
    expect(result.current.nextName).toBeNull();
  });

  it("ends when another page is turned to, whose letters are not its own", () => {
    const given = new Map<string, string>();
    const { result, rerender } = renderHook(
      (page: string) => useRelabel({ armed: true, naming: stubNaming(given), names: given, page }),
      { initialProps: "one" },
    );
    act(() => result.current.ask("one", { x: 0, y: 0 }));
    act(() => result.current.startFrom("A"));
    rerender("two");
    expect(result.current.nextName).toBeNull();
  });
});
