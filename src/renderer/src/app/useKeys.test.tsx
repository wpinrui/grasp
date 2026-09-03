/**
 * The window's shortcuts. The handler is bound once and reads its commands off
 * a ref, so the two things worth pinning are that it calls the command the
 * window last handed it, and that it keeps its hands off the keyboard when
 * something else owns it: a dialog, or anything being typed into.
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_STEP } from "../sketch/model";
import { type KeyCommands, useKeys } from "./useKeys";

/** Every command, each one a spy, so a key pressing the wrong one shows up. */
function commands(over: Partial<KeyCommands> = {}) {
  const names = [
    "pickTool",
    "newSketch",
    "openSketch",
    "saveSketch",
    "closeSketch",
    "quit",
    "selectAll",
    "cut",
    "copy",
    "paste",
    "toggleLabels",
    "togglePalette",
    "showHidden",
    "hide",
    "selectKin",
    "labelPanel",
    "calculate",
    "midpoint",
    "segment",
    "cross",
    "newParameter",
    "fill",
    "applyCustom",
    "documentOptions",
    "editDefinition",
    "undo",
    "redo",
    "remove",
    "escape",
    "step",
  ] as const;
  const spies = Object.fromEntries(names.map((name) => [name, vi.fn()]));
  return { dialogOpen: false, ...spies, ...over } as KeyCommands &
    Record<string, ReturnType<typeof vi.fn>>;
}

function bound(given: KeyCommands) {
  function Harness() {
    useKeys(given);
    return <input aria-label="typing" />;
  }
  return render(<Harness />);
}

afterEach(cleanup);

describe("a key coming down on the window", () => {
  it("picks the tool a bare letter names", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "p" });
    expect(given.pickTool).toHaveBeenCalledWith("point");
  });

  it("reaches the menu shortcut a modifier names", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.keyDown(window, { key: "h", ctrlKey: true, shiftKey: true });
    expect(given.undo).toHaveBeenCalled();
    expect(given.toggleLabels).toHaveBeenCalled();
    expect(given.showHidden).toHaveBeenCalled();
    // Shift+Ctrl+H is Show All Hidden, and must not also hide the selection.
    expect(given.hide).not.toHaveBeenCalled();
  });

  it("steps a locus with plus and minus", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "+" });
    fireEvent.keyDown(window, { key: "-" });
    expect(given.step).toHaveBeenNthCalledWith(1, SAMPLE_STEP);
    expect(given.step).toHaveBeenNthCalledWith(2, -SAMPLE_STEP);
  });

  it("leaves the keyboard to whatever is being typed into", () => {
    const given = commands();
    const { getByLabelText } = bound(given);
    fireEvent.keyDown(getByLabelText("typing"), { key: "p" });
    fireEvent.keyDown(getByLabelText("typing"), { key: "z", ctrlKey: true });
    expect(given.pickTool).not.toHaveBeenCalled();
    expect(given.undo).not.toHaveBeenCalled();
  });

  it("leaves the keyboard to an open dialog", () => {
    const given = commands({ dialogOpen: true });
    bound(given);
    fireEvent.keyDown(window, { key: "p" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(given.pickTool).not.toHaveBeenCalled();
    expect(given.escape).not.toHaveBeenCalled();
  });

  it("calls the command the window handed it last, not the one it was bound with", () => {
    const first = commands();
    function Harness({ given }: { given: KeyCommands }) {
      useKeys(given);
      return null;
    }
    const { rerender } = render(<Harness given={first} />);
    const second = commands();
    rerender(<Harness given={second} />);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(first.undo).not.toHaveBeenCalled();
    expect(second.undo).toHaveBeenCalled();
  });
});
