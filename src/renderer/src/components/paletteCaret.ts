import { type CaptionTextStyle, clearTextStyle, rangeMarks } from "../sketch/captionFormatting";
import type { TextLook } from "../sketch/model";
import type { TextMark } from "../sketch/text";

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
  // A drag can select part of a non-editable value. Format its whole link so
  // extracting the selection never splits its identity or puts styles inside
  // text that the next measurement update will replace.
  const linkAt = (node: Node) =>
    (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest(
      "[data-link]",
    );
  const start = linkAt(range.startContainer);
  const end = linkAt(range.endContainer);
  const whole = range.cloneRange();
  if (start && editor.contains(start)) whole.setStartBefore(start);
  if (end && editor.contains(end)) whole.setEndAfter(end);
  return whole;
}

/** Set the chosen run in its own type, and leave it chosen. */
export function wrapRun(range: Range, style: CaptionTextStyle) {
  const span = document.createElement("span");
  Object.assign(span.style, style);
  const content = range.extractContents();
  clearTextStyle(content, style);
  span.appendChild(content);
  range.insertNode(span);
  const selection = window.getSelection();
  const kept = document.createRange();
  kept.selectNode(span);
  selection?.removeAllRanges();
  selection?.addRange(kept);
  document.dispatchEvent(new Event("selectionchange"));
}

/**
 * How the text under the caret is set right now, read back off the runs the
 * palette itself wrote. A caption says what it is set in as a whole, but a run
 * inside it can say something else, and the bar has to show where you are
 * rather than what the caption started as.
 */
export function caretLook(editor: HTMLDivElement | null): Partial<TextLook> {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const node =
    range && !range.collapsed && range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer.childNodes[range.startOffset] ?? range.startContainer)
      : selection?.focusNode;
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
export function caretMarks(editor?: HTMLDivElement | null): Record<TextMark, boolean> {
  const range = chosenRun(editor ?? null);
  if (range) return rangeMarks(range);
  const read = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  return { bold: read("bold"), italic: read("italic"), underline: read("underline") };
}
