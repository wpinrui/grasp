/**
 * The window's keyboard shortcuts.
 *
 * The handler is bound once, for the life of the window, so it cannot read the
 * window's state through a closure that would go stale. Instead the commands
 * are handed in afresh on every render and kept in one ref, and the handler
 * calls whatever is in there when a key comes down. That is why every field
 * below is a function: the window says what a key does, not what it did when
 * the listener was bound.
 */

import { useEffect, useRef } from "react";
import { TOOLS } from "../components/tools";
import { SAMPLE_STEP } from "../sketch/model";

/** The key each tool answers to, as the toolbox tooltips advertise it. */
const TOOL_KEYS = new Map(TOOLS.map((tool) => [tool.key.toLowerCase(), tool.id]));

export interface KeyCommands {
  /** A dialog owns the keyboard while it is open, Escape and Enter included. */
  dialogOpen: boolean;
  pickTool: (id: string) => void;
  newSketch: () => void;
  openSketch: () => void;
  saveSketch: () => void;
  closeSketch: () => void;
  quit: () => void;
  selectAll: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  /** Ctrl+K, over the selection or the whole page. */
  toggleLabels: () => void;
  togglePalette: () => void;
  showHidden: () => void;
  hide: () => void;
  /** Alt and an arrow, up to the parents and down to the children. */
  selectKin: (way: "parents" | "children") => void;
  /** Alt+/, the panel that names things. */
  labelPanel: () => void;
  calculate: () => void;
  midpoint: () => void;
  segment: () => void;
  cross: () => void;
  newParameter: () => void;
  fill: () => void;
  /** Ctrl and a digit, applying the custom transform in that place. */
  applyCustom: (nth: number) => void;
  documentOptions: () => void;
  /** Ctrl+E, reopening whatever dialog made the one thing selected. */
  editDefinition: () => void;
  undo: () => void;
  redo: () => void;
  /** Delete, which a picked label takes before the selection does. */
  remove: () => void;
  escape: () => void;
  /** Plus and minus, over a locus's samples or a parameter's value. */
  step: (by: number) => void;
}

export function useKeys(commands: KeyCommands) {
  const held = useRef(commands);
  held.current = commands;

  // Bound once: everything it needs is read off the ref as the key comes down.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const now = held.current;
      // Anything being typed into is taking the keys: a page being renamed, a
      // caption being written, a request or a script being pasted.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable === true;
      if (typing) return;
      // An open dialog owns the keyboard, and handles Escape and Enter itself.
      if (now.dialogOpen) return;
      const modified = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // A bare letter picks a tool. With a modifier down it belongs to a menu
      // shortcut, and Alt is the zoom tool's modifier.
      const picked = !modified && !event.altKey ? TOOL_KEYS.get(key) : undefined;
      if (picked) now.pickTool(picked);
      else if (modified && key === "n") now.newSketch();
      else if (modified && key === "o") now.openSketch();
      else if (modified && key === "s") now.saveSketch();
      else if (modified && key === "w") now.closeSketch();
      else if (modified && key === "q") now.quit();
      else if (modified && key === "a") now.selectAll();
      else if (modified && key === "x") now.cut();
      else if (modified && key === "c") now.copy();
      else if (modified && key === "v") now.paste();
      else if (modified && key === "k") now.toggleLabels();
      else if (modified && event.shiftKey && key === "t") now.togglePalette();
      else if (modified && event.shiftKey && key === "h") now.showHidden();
      else if (modified && key === "h") now.hide();
      // Alt and an arrow walks the family tree, up to the parents and down to
      // the children.
      else if (event.altKey && event.key === "ArrowUp") now.selectKin("parents");
      else if (event.altKey && event.key === "ArrowDown") now.selectKin("children");
      // Alt+/ opens the panel that names things, and closes it again.
      else if (event.altKey && key === "/") now.labelPanel();
      // Alt+= opens the Calculator, before plus and minus can take the key.
      else if (event.altKey && key === "=") now.calculate();
      else if (modified && key === "m") now.midpoint();
      else if (modified && key === "l") now.segment();
      else if (modified && event.shiftKey && key === "i") now.cross();
      else if (modified && event.shiftKey && key === "p") now.newParameter();
      else if (modified && key === "p") now.fill();
      else if (modified && /^[1-9]$/.test(key)) now.applyCustom(Number(key) - 1);
      else if (modified && event.shiftKey && key === "d") now.documentOptions();
      else if (modified && key === "e") now.editDefinition();
      else if (modified && key === "z") now.undo();
      else if (modified && key === "r") now.redo();
      else if (event.key === "Delete") now.remove();
      // Escape puts the plain Arrow up, from any tool and from any arrow. What
      // the tool was halfway through is dropped by the sheet's own handler, so
      // one press both lets go of the gesture and hands the sheet back.
      else if (event.key === "Escape") now.escape();
      // Plus and minus belong to whatever locus is selected.
      else if (!modified && (key === "+" || key === "=")) now.step(SAMPLE_STEP);
      else if (!modified && key === "-") now.step(-SAMPLE_STEP);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
