import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogFrame } from "./DialogFrame";

/** Every press on the bar takes the pointer, which jsdom does not implement. */
let captured: number[];

/**
 * What the dialog and its body measure, since jsdom lays nothing out. The
 * chrome is the difference between the two heights, and `content` is what the
 * body is holding, which is what says whether it has to scroll.
 */
const size = { width: 300, height: 400, body: 300, content: 300 };

/** The measurements jsdom answers with nothing, told for the boxes that matter. */
const MEASURED = ["offsetWidth", "offsetHeight", "scrollHeight"] as const;

/** Say how big the dialog is, and hand back the way to stop saying it. */
function tellSizes(): () => void {
  const was = MEASURED.map((name) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
  const answers: Record<(typeof MEASURED)[number], (element: HTMLElement) => number> = {
    offsetWidth: (element) => (element.classList.contains("dialog") ? size.width : 0),
    offsetHeight: (element) => {
      if (element.classList.contains("dialog")) return size.height;
      return element.classList.contains("dialog__body") ? size.body : 0;
    },
    scrollHeight: (element) => (element.classList.contains("dialog__body") ? size.content : 0),
  };
  for (const name of MEASURED) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return answers[name](this);
      },
    });
  }
  return () =>
    MEASURED.forEach((name, index) => {
      const before = was[index];
      // scrollHeight is jsdom's on Element, not on HTMLElement, so there is no
      // own descriptor to put back and deleting is what uncovers it again.
      if (before) Object.defineProperty(HTMLElement.prototype, name, before);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    });
}

let forgetSizes: () => void;

beforeEach(() => {
  captured = [];
  Object.assign(size, { width: 300, height: 400, body: 300, content: 300 });
  forgetSizes = tellSizes();
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
  forgetSizes();
  vi.unstubAllGlobals();
});

function frame(at?: { x: number; y: number }) {
  const cancelled: true[] = [];
  const asked = () => (
    <DialogFrame
      title="Asking"
      action="Do it"
      canApply
      at={at}
      onApply={() => {}}
      onCancel={() => cancelled.push(true)}
    >
      <p>What it is about.</p>
    </DialogFrame>
  );
  const { container, rerender } = render(asked());
  const box = container.querySelector(".dialog") as HTMLElement;
  return {
    cancelled,
    box,
    /** Draw the same dialog again, the way a change to its contents would. */
    redraw: () => rerender(asked()),
    at: () => ({ x: Number.parseFloat(box.style.left), y: Number.parseFloat(box.style.top) }),
    /** Whether the body has been told to give way, which is what scrolls it. */
    scrolls: () =>
      (container.querySelector(".dialog__body") as HTMLElement).classList.contains(
        "dialog__body--tall",
      ),
    /** The cap written on the box, or nothing while the window can hold it. */
    capped: () => box.style.maxHeight,
    bar: container.querySelector(".dialog__bar") as HTMLElement,
    close: container.querySelector(".dialog__close") as HTMLElement,
  };
}

/** The far corner a dialog placed anywhere may not reach past. */
function corner() {
  return { x: window.innerWidth - size.width - 8, y: window.innerHeight - size.height - 8 };
}

/**
 * The chrome every dialog shares. Three things about it are easy to break by
 * accident and invisible to the types: the bar takes the pointer to be dragged
 * by, which must not take the close button's click with it, a dialog has to end
 * up somewhere it can be read whatever the window is doing, and a window too
 * short to hold one has to leave its buttons reachable.
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
    const { at } = frame({ x: window.innerWidth - 4, y: window.innerHeight - 4 });
    expect(at()).toEqual(corner());
  });

  it("comes back inside a window that has been made smaller", () => {
    const { at } = frame();
    const opened = at();
    vi.stubGlobal("innerWidth", 700);
    vi.stubGlobal("innerHeight", 500);
    fireEvent.resize(window);
    expect(at()).toEqual(corner());
    expect(at()).not.toEqual(opened);
  });

  it("cannot be dragged out of the window", () => {
    const { at, bar } = frame();
    fireEvent.pointerDown(bar, { clientX: 100, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 5000, clientY: 5000, pointerId: 1 });
    expect(at()).toEqual(corner());
    fireEvent.pointerMove(bar, { clientX: -5000, clientY: -5000, pointerId: 1 });
    expect(at()).toEqual({ x: 8, y: 8 });
  });

  it("stands off the top left where the window is smaller than it is", () => {
    const { at, scrolls } = frame();
    vi.stubGlobal("innerHeight", 300);
    fireEvent.resize(window);
    // Nowhere left to put it that fits, so the near corner is what is kept and
    // the body is what gives.
    expect(at()).toEqual({ x: 696, y: 8 });
    expect(scrolls()).toBe(true);
  });

  it("scrolls its body only where the window is too short to hold it", () => {
    const roomy = frame();
    expect(roomy.scrolls()).toBe(false);
    expect(roomy.capped()).toBe("");
    cleanup();
    // 700 fits the 752 the window leaves on its own. It is the chrome, the 100
    // of the 400 that is not the body, that takes it past.
    size.content = 700;
    const cramped = frame();
    expect(cramped.scrolls()).toBe(true);
    expect(cramped.capped()).toBe("752px");
  });

  it("scrolls its body once its own contents have outgrown the window", () => {
    // Nothing about the window changes here. A dialog that fitted when it
    // opened has to be measured again when what it is holding grows.
    const { scrolls, redraw } = frame();
    expect(scrolls()).toBe(false);
    size.content = 900;
    redraw();
    expect(scrolls()).toBe(true);
  });
});
