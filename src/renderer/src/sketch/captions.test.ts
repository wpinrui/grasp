import { afterEach, describe, expect, it } from "vitest";
import { NOTATION } from "../components/typeset";
import { insertAtCaret, linkHtml, plainText, withNames } from "./captions";

afterEach(() => {
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
});

function editor() {
  const element = document.createElement("div");
  element.contentEditable = "true";
  document.body.append(element);
  const range = document.createRange();
  range.selectNodeContents(element);
  window.getSelection()?.addRange(range);
  return element;
}

function caretRange(): Range {
  const range = window.getSelection()?.getRangeAt(0);
  if (!range) throw new Error("Missing caption caret");
  return range;
}

describe("caption links", () => {
  it("keeps subsequent typing outside the live value across updates", () => {
    const element = editor();
    insertAtCaret(element, linkHtml("length", "5 cm"));
    const range = caretRange();
    expect(element.querySelector("[data-link]")?.contains(range.startContainer)).toBe(false);
    range.insertNode(document.createTextNode(" after"));
    element.innerHTML = withNames(element.innerHTML, new Map([["length", "7 cm"]]));
    expect(plainText(element.innerHTML)).toBe("7 cm after");
    expect(element.querySelector("[data-link]")?.getAttribute("contenteditable")).toBe("false");
  });

  it("makes existing links atomic and removes their separate colour", () => {
    const html = '<span style="color: red"><span data-link="m">old</span></span> trailing';
    const updated = withNames(html, new Map([["m", "new"]]));
    expect(updated).toContain('contenteditable="false"');
    expect(updated).not.toContain("color: red");
    expect(plainText(updated)).toBe("new trailing");
  });

  it("escapes link names and ignores empty caret markers", () => {
    expect(plainText(linkHtml('a"b', "<length>"))).toBe("<length>");
    expect(plainText("\u200b<br>")).toBe("");
  });
});

it("inserts a fraction with independently editable, unrestricted slots", () => {
  const element = editor();
  const fraction = NOTATION.find((one) => one.id === "fraction");
  if (!fraction) throw new Error("Missing fraction notation");
  insertAtCaret(element, fraction.html);
  const range = caretRange();
  expect(range.toString()).toBe("?");
  range.deleteContents();
  range.insertNode(document.createTextNode("1234567890".repeat(30)));
  const bottom = element.querySelector(".cap-frac__bottom");
  if (!bottom) throw new Error("Missing denominator");
  bottom.textContent = "9876543210".repeat(40);
  expect(element.querySelector(".cap-frac__top")?.textContent).toHaveLength(300);
  expect(bottom.textContent).toHaveLength(400);
});
