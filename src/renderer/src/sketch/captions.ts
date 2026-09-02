/**
 * What a caption's markup means, away from the DOM that draws it.
 *
 * A Hot Text link is a span carrying the id of what it reads. What it says is
 * filled in from the names every time the caption is drawn, so renaming an
 * object rewrites every sentence that mentions it, and nothing has to be kept
 * in step by hand.
 */

/** A Hot Text link to an object, ready to drop into a caption. */
export function linkHtml(id: string, name: string): string {
  return `<span class="cap-link" data-link="${id}">${name}</span>`;
}

/** The caption's markup with every link saying what its object is called now. */
export function withNames(html: string, names: Map<string, string>): string {
  if (!html.includes("data-link")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const span of doc.querySelectorAll("[data-link]")) {
    const name = names.get(span.getAttribute("data-link") ?? "");
    if (name !== undefined) span.textContent = name;
  }
  return doc.body.innerHTML;
}

/** What the caption says, with the markup taken off. */
export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
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
  range.insertNode(piece);
  const slot = first?.classList.contains("cap-slot")
    ? first
    : (first?.querySelector(".cap-slot") ?? null);
  const next = document.createRange();
  if (slot) next.selectNodeContents(slot);
  else if (last) {
    next.setStartAfter(last);
    next.collapse(true);
  } else return;
  selection.removeAllRanges();
  selection.addRange(next);
  editor.focus();
}
