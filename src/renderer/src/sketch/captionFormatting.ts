import type { TextMark } from "./text";

export type CaptionTextStyle = Partial<
  Pick<
    CSSStyleDeclaration,
    "fontFamily" | "fontSize" | "fontWeight" | "fontStyle" | "textDecoration"
  >
>;

/** Remove only the formatting being replaced, leaving notation and other styles intact. */
export function clearTextStyle(root: ParentNode, style: CaptionTextStyle) {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    for (const property of Object.keys(style) as (keyof CaptionTextStyle)[])
      element.style[property] = "";
    if (style.fontFamily !== undefined) element.removeAttribute("face");
    if (style.fontSize !== undefined) element.removeAttribute("size");
    if (style.textDecoration !== undefined) element.style.textDecorationLine = "";
    const tag = element.tagName.toLowerCase();
    if (
      (style.fontWeight !== undefined && ["b", "strong"].includes(tag)) ||
      (style.fontStyle !== undefined && ["i", "em"].includes(tag)) ||
      (style.textDecoration !== undefined && tag === "u")
    ) {
      const span = document.createElement("span");
      for (const attribute of element.attributes)
        span.setAttribute(attribute.name, attribute.value);
      span.append(...element.childNodes);
      element.replaceWith(span);
    }
  }
}

export function captionTextStyle(html: string, style: CaptionTextStyle): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  clearTextStyle(root, style);
  return root.innerHTML;
}

export function markStyle(mark: TextMark, on: boolean): CaptionTextStyle {
  if (mark === "bold") return { fontWeight: on ? "bold" : "normal" };
  if (mark === "italic") return { fontStyle: on ? "italic" : "normal" };
  return { textDecoration: on ? "underline" : "none" };
}

function marked(node: Node, mark: TextMark): boolean {
  let element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  while (element) {
    const style = element.style;
    const tag = element.tagName.toLowerCase();
    if (mark === "bold") {
      if (style.fontWeight) return style.fontWeight === "bold" || Number(style.fontWeight) >= 600;
      if (tag === "b" || tag === "strong") return true;
    } else if (mark === "italic") {
      if (style.fontStyle) return style.fontStyle !== "normal";
      if (tag === "i" || tag === "em") return true;
    } else if (
      style.textDecoration.includes("underline") ||
      style.textDecorationLine === "underline" ||
      tag === "u"
    )
      return true;
    element = element.parentElement;
  }
  return false;
}

/** A selection reads on only when all its text, including live values, has the mark. */
export function rangeMarks(range: Range): Record<TextMark, boolean> {
  const root = range.commonAncestorContainer;
  const texts: Node[] = [];
  if (root.nodeType === Node.TEXT_NODE) texts.push(root);
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode())
      if (range.intersectsNode(walker.currentNode) && walker.currentNode.textContent?.trim())
        texts.push(walker.currentNode);
  }
  const all = (mark: TextMark) => texts.length > 0 && texts.every((node) => marked(node, mark));
  return { bold: all("bold"), italic: all("italic"), underline: all("underline") };
}

export function htmlMarks(html: string): Record<TextMark, boolean> {
  const root = document.createElement("div");
  root.innerHTML = html;
  const range = document.createRange();
  range.selectNodeContents(root);
  return rangeMarks(range);
}

export function markCaption(html: string, mark: TextMark, on: boolean): string {
  const style = markStyle(mark, on);
  const span = document.createElement("span");
  span.innerHTML = captionTextStyle(html, style);
  Object.assign(span.style, style);
  return span.outerHTML;
}
