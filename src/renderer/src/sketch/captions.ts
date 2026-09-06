/**
 * What a caption's markup means, away from the DOM that draws it.
 *
 * A Hot Text link is a span carrying the id of what it reads. What it says is
 * filled in from the names every time the caption is drawn, so renaming an
 * object rewrites every sentence that mentions it, and nothing has to be kept
 * in step by hand.
 */

import { type CaptionReading, linkFormat } from "./captionLinks";

/** A caption has one ink, including pasted text and older per-run formatting. */
export function clearCaptionColours(root: HTMLElement) {
  for (const element of root.querySelectorAll<HTMLElement>("[style], [color]")) {
    element.style.removeProperty("color");
    element.style.removeProperty("-webkit-text-fill-color");
    element.removeAttribute("color");
  }
}

export function singleColourHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  clearCaptionColours(doc.body);
  return doc.body.innerHTML;
}

/** A Hot Text link to an object, ready to drop into a caption. */
export function linkHtml(id: string, name: string): string {
  const span = document.createElement("span");
  span.className = "cap-link";
  span.dataset.link = id;
  span.setAttribute("contenteditable", "false");
  span.textContent = name;
  return span.outerHTML;
}

/** The caption's markup with every link saying what its object is called now. */
export function withNames(
  html: string,
  names: Map<string, string>,
  readings?: Map<string, CaptionReading>,
): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  refreshLinks(doc.body, names, readings);
  return doc.body.innerHTML;
}

/** Refresh only live values, preserving the editor and the surrounding caret. */
export function refreshLinks(
  root: HTMLElement,
  names: Map<string, string>,
  readings?: Map<string, CaptionReading>,
) {
  clearCaptionColours(root);
  for (const span of root.querySelectorAll("[data-link]")) {
    span.setAttribute("contenteditable", "false");
    const id = span.getAttribute("data-link") ?? "";
    const reading = readings?.get(id);
    const name = reading ? reading.value(linkFormat(span, reading)) : names.get(id);
    if (name !== undefined && span.textContent !== name) span.textContent = name;
  }
}

/** What the caption says, with the markup taken off. */
export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** How a caption is listed where it has to be named in a row: by what it says. */
export function captionRowName(html: string): string {
  const said = plainText(html);
  return said.length > 28 ? `${said.slice(0, 27)}…` : said;
}

/**
 * Drop something in at the caret. The caret then goes to the first part still
 * to be filled in, so a fraction can be typed straight into, or to just past
 * what was put in when there is nothing to fill.
 */
export function insertAtCaret(editor: HTMLDivElement | null, html: string) {
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const piece = range.createContextualFragment(html);
  const first = piece.firstElementChild;
  const last = piece.lastChild;
  // An actual text position after an atomic link keeps typing outside its value.
  const tail = first?.hasAttribute("data-link") ? document.createTextNode("\u200b") : null;
  if (tail) piece.appendChild(tail);
  range.insertNode(piece);
  const slot = first?.classList.contains("cap-slot")
    ? first
    : (first?.querySelector(".cap-slot") ?? null);
  const next = document.createRange();
  if (slot) next.selectNodeContents(slot);
  else if (tail) {
    next.setStart(tail, 1);
    next.collapse(true);
  } else if (last) {
    next.setStartAfter(last);
    next.collapse(true);
  } else return;
  selection.removeAllRanges();
  selection.addRange(next);
  editor.focus();
}
