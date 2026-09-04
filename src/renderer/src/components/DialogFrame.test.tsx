import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogFrame } from "./DialogFrame";

/** Every press on the bar takes the pointer, which jsdom does not implement. */
let captured: number[];

beforeEach(() => {
  captured = [];
  Element.prototype.setPointerCapture = function capture(id: number) {
    captured.push(id);
  };
  Element.prototype.releasePointerCapture = () => {};
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function frame(at?: { x: number; y: number }) {
  const cancelled: true[] = [];
  const { container } = render(
    <DialogFrame
      title="Asking"
      action="Do it"
      canApply
      at={at}
      onApply={() => {}}
      onCancel={() => cancelled.push(true)}
    >
      <p>What it is about.</p>
    </DialogFrame>,
  );
  return {
    cancelled,
    box: container.querySelector(".dialog") as HTMLElement,
    bar: container.querySelector(".dialog__bar") as HTMLElement,
    close: container.querySelector(".dialog__close") as HTMLElement,
  };
}

/**
 * The chrome every dialog shares. Two things about it are easy to break by
 * accident and invisible to the types: the bar takes the pointer to be dragged
 * by, which must not take the close button's click with it, and a dialog opened
 * beside a spot has to end up somewhere it can be read.
 */
describe("the chrome a dialog is put up in", () => {
  it("shuts on its close button", () => {
    const { cancelled, close } = frame();
    fireEvent.click(close);
    expect(cancelled).toEqual([true]);
  });

  it("does not take the pointer for the bar when the press is the close button", () => {
    const { bar, close } = frame();
    // Captured for the bar, the click that follows would be the bar's and the
    // button would never hear it.
    fireEvent.pointerDown(close, { clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
    expect(captured).toEqual([]);
    fireEvent.pointerDown(bar, { clientX: 60, clientY: 10, pointerId: 1 });
    expect(captured).toEqual([1]);
  });

  it("comes back inside the window when it opens too near a corner", () => {
    // Opened at the bottom right, where there is not room for it.
    const { box } = frame({ x: window.innerWidth - 4, y: window.innerHeight - 4 });
    const left = Number.parseFloat(box.style.left);
    const top = Number.parseFloat(box.style.top);
    expect(left).toBeLessThanOrEqual(window.innerWidth);
    expect(top).toBeLessThanOrEqual(window.innerHeight);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });
});
