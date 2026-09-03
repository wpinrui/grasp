import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onAPhone, usePhone, useVisibleViewport } from "./phone";

/** A `matchMedia` that answers as asked and remembers who is listening. */
function pointerIs(coarse: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches: coarse,
    addEventListener: (_: string, answer: (event: MediaQueryListEvent) => void) =>
      listeners.add(answer),
    removeEventListener: (_: string, answer: (event: MediaQueryListEvent) => void) =>
      listeners.delete(answer),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    listeners,
    /** The device changes its mind, as a screen with a pen attached can. */
    becomes(now: boolean) {
      query.matches = now;
      for (const answer of listeners) answer({ matches: now } as MediaQueryListEvent);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("what kind of screen this is", () => {
  it("says so when the pointer is coarse", () => {
    pointerIs(true);
    expect(onAPhone()).toBe(true);
  });

  it("says no when it is not", () => {
    pointerIs(false);
    expect(onAPhone()).toBe(false);
  });

  it("says no where there is no browser to ask", () => {
    // The node tests and the script worker both run without one, and an answer
    // that changes nothing is the right one there.
    vi.stubGlobal("matchMedia", undefined);
    expect(onAPhone()).toBe(false);
  });

  it("asks the browser every time rather than answering from memory", () => {
    // A fresh query each time, which is what a held one would get wrong: the
    // module used to keep the first and never look again.
    pointerIs(false);
    expect(onAPhone()).toBe(false);
    pointerIs(true);
    expect(onAPhone()).toBe(true);
  });
});

describe("following the screen", () => {
  it("starts on what the screen says now", () => {
    pointerIs(true);
    const { result } = renderHook(() => usePhone());
    expect(result.current).toBe(true);
  });

  it("follows it when it changes", () => {
    const screen = pointerIs(false);
    const { result } = renderHook(() => usePhone());
    expect(result.current).toBe(false);
    act(() => screen.becomes(true));
    expect(result.current).toBe(true);
  });

  it("stops listening when it goes", () => {
    const screen = pointerIs(false);
    const { unmount } = renderHook(() => usePhone());
    expect(screen.listeners.size).toBe(1);
    unmount();
    expect(screen.listeners.size).toBe(0);
  });
});

describe("the part of the window that is visible", () => {
  function viewportIs(height: number, offsetTop: number) {
    const listeners: Record<string, () => void> = {};
    // The hook holds the object the browser gave it, so a keyboard opening is
    // that same object reporting a smaller height, not a new one.
    const view = {
      height,
      offsetTop,
      addEventListener: (when: string, answer: () => void) => {
        listeners[when] = answer;
      },
      removeEventListener: (when: string) => {
        delete listeners[when];
      },
    };
    vi.stubGlobal("visualViewport", view);
    return { listeners, view };
  }

  it("publishes what the browser reports", () => {
    viewportIs(500, 40);
    renderHook(() => useVisibleViewport());
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--seen-height")).toBe("500px");
    expect(root.getPropertyValue("--seen-top")).toBe("40px");
  });

  it("publishes it again when a keyboard takes half the screen", () => {
    const { listeners, view } = viewportIs(800, 0);
    renderHook(() => useVisibleViewport());
    expect(document.documentElement.style.getPropertyValue("--seen-height")).toBe("800px");

    view.height = 380;
    act(() => listeners.resize());
    expect(document.documentElement.style.getPropertyValue("--seen-height")).toBe("380px");
  });

  it("does nothing where the browser reports no visual viewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    document.documentElement.style.removeProperty("--seen-height");
    renderHook(() => useVisibleViewport());
    expect(document.documentElement.style.getPropertyValue("--seen-height")).toBe("");
  });
});
