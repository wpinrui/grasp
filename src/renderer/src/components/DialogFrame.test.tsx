import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogFrame } from "./DialogFrame";

/** Every press on the bar takes the pointer, which jsdom does not implement. */
let captured: number[];

/**
 * What the dialog is made of, since jsdom lays nothing out: how wide it is, how
 * much of its height is bar and buttons and border, and how much its body is
 * holding. Everything else is worked out from those the way a browser would.
 */
const size = { width: 300, chrome: 100, content: 300 };

/** How tall the dialog would be were the window willing to hold all of it. */
function natural(): number {
  return size.chrome + size.content;
}

/**
 * How tall the dialog actually is. A cap is a ceiling and not a height, so a
 * dialog under one that it does not reach is still its own size, and modelling
 * that is the point: it is what tells a stale cap from a fresh one.
 */
function shown(dialog: HTMLElement): number {
  const cap = Number.parseFloat(dialog.style.maxHeight);
  return Number.isNaN(cap) ? natural() : Math.min(natural(), cap);
}

/** The measurements jsdom answers with nothing, told for the boxes that matter. */
const MEASURED = ["offsetWidth", "offsetHeight", "scrollHeight"] as const;

/** Say how big the dialog is, and hand back the way to stop saying it. */
function tellSizes(): () => void {
  const was = MEASURED.map((name) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
  const answers: Record<(typeof MEASURED)[number], (element: HTMLElement) => number> = {
    offsetWidth: (element) => (element.classList.contains("dialog") ? size.width : 0),
    offsetHeight: (element) => {
      if (element.classList.contains("dialog")) return shown(element);
      if (!element.classList.contains("dialog__body")) return 0;
      // The bar and the buttons hold their height, so whatever the dialog gives
      // up comes off the body. That is `flex-shrink: 0` in TransformDialog.css.
      const dialog = element.closest(".dialog") as HTMLElement | null;
      return dialog ? shown(dialog) - size.chrome : 0;
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
  Object.assign(size, { width: 300, chrome: 100, content: 300 });
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
  return { x: window.innerWidth - size.width - 8, y: window.innerHeight - natural() - 8 };
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

  it("lets go at the end of a drag", () => {
    const { at, bar } = frame();
    fireEvent.pointerDown(bar, { clientX: 100, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 200, clientY: 120, pointerId: 1 });
    const dropped = at();
    fireEvent.pointerUp(bar, { pointerId: 1 });
    // Still following the pointer after the press ended, the dialog would be
    // stuck to it and there would be no way to put it down.
    fireEvent.pointerMove(bar, { clientX: 400, clientY: 300, pointerId: 1 });
    expect(at()).toEqual(dropped);
  });

  it("leaves a dialog placed by the stylesheet alone on a phone", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })),
    );
    // Nothing written on the box, so the rules that pin it to the top of what
    // is visible need no importance to win.
    const { box, scrolls } = frame();
    expect(box.style.left).toBe("");
    expect(box.style.maxHeight).toBe("");
    expect(scrolls()).toBe(false);
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
    // A body holding most of the dialog's height, so counting that height twice
    // would wrongly make it too tall for the 752 the window leaves.
    size.content = 600;
    const roomy = frame();
    expect(roomy.scrolls()).toBe(false);
    expect(roomy.capped()).toBe("");
    cleanup();
    // 700 fits the 752 on its own. It is the 100 of chrome above and below it
    // that takes the dialog past.
    size.content = 700;
    const cramped = frame();
    expect(cramped.scrolls()).toBe(true);
    expect(cramped.capped()).toBe("752px");
  });

  it("caps a dialog against the window it is in now, not the one it was in", () => {
    size.content = 900;
    const { capped } = frame();
    expect(capped()).toBe("752px");
    // Already capped, so neither how tall it may be nor where it sits changes
    // as a fraction. Nothing but the window has moved, and the cap has to
    // follow it anyway.
    vi.stubGlobal("innerHeight", 400);
    fireEvent.resize(window);
    expect(capped()).toBe("384px");
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
