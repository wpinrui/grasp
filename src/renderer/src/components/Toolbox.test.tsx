/**
 * The long press, which is the only way to reach a tool's variants on a touch
 * screen: there is no hover for the rail to open them on. What it must not do
 * is fire on a tap, fire on the start of a drag, or quietly change the tool on
 * its way out.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toolbox } from "./Toolbox";

/** The straightedge has variants; the arrow does not. */
const STRAIGHTEDGE = "Straightedge";
const HOLD_MS = 450;

function pointerIs(coarse: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: coarse,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

function rail(onSelectTool = vi.fn(), onPickVariant = vi.fn()) {
  render(
    <Toolbox
      activeTool="arrow"
      onSelectTool={onSelectTool}
      variants={{}}
      onPickVariant={onPickVariant}
      onDoubleClickTool={vi.fn()}
      off={{}}
    />,
  );
  return { onSelectTool, onPickVariant };
}

/** A control by its name, which the tooltip beside it also carries. */
function button(name: string) {
  return screen.getByRole("button", { name });
}

function maybe(name: string) {
  return screen.queryByRole("button", { name });
}

/** Press a tool, wait, and let go, as a finger held on it would. */
function hold(name: string, forMs: number) {
  const tool = button(name);
  fireEvent.pointerDown(tool, { clientX: 20, clientY: 100 });
  act(() => vi.advanceTimersByTime(forMs));
  fireEvent.pointerUp(tool);
  fireEvent.click(tool);
  return tool;
}

beforeEach(() => {
  vi.useFakeTimers();
  pointerIs(true);
});

afterEach(() => {
  // The suite does not run with globals, so nothing tidies the DOM for us and
  // one rail would otherwise be found beside the last.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("holding a tool on a touch screen", () => {
  it("opens its variants", () => {
    rail();
    hold(STRAIGHTEDGE, HOLD_MS);
    expect(button("Segment")).toBeTruthy();
  });

  it("does not also select the tool on the way out", () => {
    // The press is spent on opening the flyout. Selecting as well would change
    // the tool under the reader every time they looked at what it offers.
    const { onSelectTool } = rail();
    hold(STRAIGHTEDGE, HOLD_MS);
    expect(onSelectTool).not.toHaveBeenCalled();
  });

  it("selects the tool and opens nothing when it is a tap", () => {
    const { onSelectTool } = rail();
    hold(STRAIGHTEDGE, HOLD_MS - 100);
    expect(onSelectTool).toHaveBeenCalledWith("straightedge");
    expect(maybe("Segment")).toBeNull();
  });

  it("does not open when the finger sets off across the rail", () => {
    rail();
    const tool = button(STRAIGHTEDGE);
    fireEvent.pointerDown(tool, { clientX: 20, clientY: 100 });
    fireEvent.pointerMove(tool, { clientX: 20, clientY: 140 });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(maybe("Segment")).toBeNull();
  });

  it("stays open for a press on the variants themselves", () => {
    rail();
    hold(STRAIGHTEDGE, HOLD_MS);
    fireEvent.pointerDown(button("Segment"));
    expect(maybe("Segment")).not.toBeNull();
  });

  it("drops a press still being timed when the rail goes", () => {
    // Otherwise the timer fires into a component that is no longer there.
    const { unmount } = (() => {
      rail();
      return { unmount: cleanup };
    })();
    fireEvent.pointerDown(button(STRAIGHTEDGE), { clientX: 20, clientY: 100 });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes on a press anywhere else", () => {
    rail();
    hold(STRAIGHTEDGE, HOLD_MS);
    fireEvent.pointerDown(document.body);
    expect(maybe("Segment")).toBeNull();
  });
});

describe("the same rail with a pointer", () => {
  it("opens the variants on hover and ignores a held press", () => {
    pointerIs(false);
    rail();
    const tool = button(STRAIGHTEDGE);

    fireEvent.pointerDown(tool, { clientX: 20, clientY: 100 });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(maybe("Segment")).toBeNull();

    fireEvent.mouseEnter(tool);
    expect(button("Segment")).toBeTruthy();
  });
});
