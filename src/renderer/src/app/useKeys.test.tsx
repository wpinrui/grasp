/**
 * The window's shortcuts. The handler is bound once and reads its commands off
 * a ref, so the two things worth pinning are that it calls the command the
 * window last handed it, and that it keeps its hands off the keyboard when
 * something else owns it: a dialog, or anything being typed into.
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { SAMPLE_STEP } from "../sketch/model";
import { type KeyCommands, useKeys } from "./useKeys";

/**
 * Every command, each one a spy. The type is what keeps this honest: a command
 * added to `KeyCommands` and forgotten here fails the typecheck rather than
 * quietly going untested.
 */
type Commands = Omit<KeyCommands, "dialogOpen">;

function commands(over: Partial<KeyCommands> = {}) {
  const spies: Record<keyof Commands, Mock> = {
    pickTool: vi.fn(),
    newSketch: vi.fn(),
    openSketch: vi.fn(),
    saveSketch: vi.fn(),
    closeSketch: vi.fn(),
    quit: vi.fn(),
    selectAll: vi.fn(),
    cut: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    toggleLabels: vi.fn(),
    togglePalette: vi.fn(),
    showHidden: vi.fn(),
    hide: vi.fn(),
    selectKin: vi.fn(),
    labelPanel: vi.fn(),
    calculate: vi.fn(),
    midpoint: vi.fn(),
    segment: vi.fn(),
    cross: vi.fn(),
    newParameter: vi.fn(),
    fill: vi.fn(),
    applyCustom: vi.fn(),
    documentOptions: vi.fn(),
    editDefinition: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    remove: vi.fn(),
    escape: vi.fn(),
    step: vi.fn(),
  };
  return { dialogOpen: false, ...spies, ...over } as KeyCommands & Record<keyof Commands, Mock>;
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

  it("gives a shifted shortcut to the shifted command, not the bare one", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "p", ctrlKey: true, shiftKey: true });
    expect(given.newParameter).toHaveBeenCalled();
    expect(given.fill).not.toHaveBeenCalled();
  });

  it("applies the custom transform a digit stands for, counting from zero", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    fireEvent.keyDown(window, { key: "3", ctrlKey: true });
    expect(given.applyCustom).toHaveBeenNthCalledWith(1, 0);
    expect(given.applyCustom).toHaveBeenNthCalledWith(2, 2);
  });

  it("walks the family tree the way the arrow points", () => {
    const given = commands();
    bound(given);
    fireEvent.keyDown(window, { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
    expect(given.selectKin).toHaveBeenNthCalledWith(1, "parents");
    expect(given.selectKin).toHaveBeenNthCalledWith(2, "children");
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
