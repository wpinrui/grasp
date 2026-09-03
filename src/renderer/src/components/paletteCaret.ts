import type { TextLook } from "../sketch/model";

/**
 * The stretch of the caption being typed into that is selected, or null when
 * nothing is: a collapsed caret has no run to format, so the change goes to the
 * caption as a whole instead.
 */
export function chosenRun(editor: HTMLDivElement | null): Range | null {
  if (!editor) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return null;
  return range;
}

/** Set the chosen run in its own type, and leave it chosen. */
export function wrapRun(range: Range, style: Partial<CSSStyleDeclaration>) {
  const span = document.createElement("span");
  Object.assign(span.style, style);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  const selection = window.getSelection();
  const kept = document.createRange();
  kept.selectNodeContents(span);
  selection?.removeAllRanges();
  selection?.addRange(kept);
}

/**
 * How the text under the caret is set right now, read back off the runs the
 * palette itself wrote. A caption says what it is set in as a whole, but a run
 * inside it can say something else, and the bar has to show where you are
 * rather than what the caption started as.
 */
export function caretLook(editor: HTMLDivElement | null): Partial<TextLook> {
  const selection = window.getSelection();
  const node = selection?.focusNode;
  if (!editor || !node || !editor.contains(node)) return {};
  let found = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const look: Partial<TextLook> = {};
  while (found && found !== editor) {
    const { style } = found as HTMLElement;
    if (look.font === undefined && style?.fontFamily) {
      look.font = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    }
    if (look.size === undefined && style?.fontSize) {
      look.size = Number.parseFloat(style.fontSize);
    }
    // Written as a token so the sheet keeps one source of truth for red.
    if (look.colour === undefined && style?.color.startsWith("var(")) {
      look.colour = style.color.slice(4, -1).trim();
    }
    found = found.parentElement;
  }
  return look;
}

/** Whether the caret is in bold, italic or underlined text right now. */
export function caretMarks(): Record<"bold" | "italic" | "underline", boolean> {
  const read = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  return { bold: read("bold"), italic: read("italic"), underline: read("underline") };
}
