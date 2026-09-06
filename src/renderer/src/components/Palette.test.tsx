import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { htmlMarks } from "../sketch/captionFormatting";
import { linkHtml, refreshLinks } from "../sketch/captions";
import { createCaption } from "../sketch/model";
import { Palette } from "./Palette";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  window.getSelection()?.removeAllRanges();
});

function palette(html: string, editing = true) {
  const field = document.createElement("div");
  field.contentEditable = "true";
  field.innerHTML = html;
  document.body.append(field);
  const range = document.createRange();
  range.selectNodeContents(field);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  const caption = {
    ...createCaption({ x: 0, y: 0 }, 240, { font: "Arial", size: 14, colour: "--color-ink-black" }),
    html,
  };
  const onCaption = vi.fn();
  const props: ComponentProps<typeof Palette> = {
    caption,
    editing,
    editor: { current: editing ? field : null },
    text: { font: "Arial", size: 14, smallest: 14, colour: "--color-ink-black" },
    selectionMarks: null,
    onSelectionMark: vi.fn(),
    labelMarks: null,
    onLabelMark: vi.fn(),
    armedText: null,
    onArmText: vi.fn(),
    onCaption,
    styling: {
      colour: "--color-ink-black",
      weight: null,
      pattern: null,
      canColour: true,
      canWeight: false,
      canPattern: false,
    },
    onStyle: vi.fn(),
  };
  const shown = render(<Palette {...props} />);
  return { ...shown, field, onCaption, props };
}

it("resizes text and live values together, overriding older nested sizes", () => {
  const html = `Area = <font size="2"><span style="font-size: 10pt">${linkHtml("m", "12 cm")}</span></font> × 2`;
  const shown = palette(html);
  fireEvent.click(shown.getByRole("button", { name: "Size" }));
  fireEvent.click(shown.getByRole("button", { name: "28" }));
  expect(shown.field.firstElementChild?.getAttribute("style")).toContain("font-size: 28pt");
  expect(shown.field.innerHTML).not.toContain("10pt");
  expect(shown.field.querySelector("font")?.hasAttribute("size")).toBe(false);
  expect(shown.getByRole("button", { name: "Size" }).textContent).toContain("28");
  refreshLinks(shown.field, new Map([["m", "15 cm"]]));
  expect(shown.field.textContent).toBe("Area = 15 cm × 2");
  expect(shown.field.firstElementChild?.getAttribute("style")).toContain("font-size: 28pt");
});

it.each(["Bold", "Italic", "Underline"])(
  "toggles %s across normal text and a live link",
  (name) => {
    const shown = palette(`Area = ${linkHtml("m", "12 cm")}`);
    fireEvent.click(shown.getByRole("button", { name }));
    expect(
      htmlMarks(shown.field.innerHTML)[name.toLowerCase() as "bold" | "italic" | "underline"],
    ).toBe(true);
    expect(shown.field.querySelector("[data-link]")?.getAttribute("contenteditable")).toBe("false");
    refreshLinks(shown.field, new Map([["m", "15 cm"]]));
    fireEvent.click(shown.getByRole("button", { name }));
    expect(
      htmlMarks(shown.field.innerHTML)[name.toLowerCase() as "bold" | "italic" | "underline"],
    ).toBe(false);
  },
);

it("formats a caption selected outside editing instead of only arming the tool", () => {
  const shown = palette(`Area = ${linkHtml("m", "12 cm")}`, false);
  fireEvent.click(shown.getByRole("button", { name: "Bold" }));
  const change = shown.onCaption.mock.calls[0][0];
  expect(htmlMarks(change.html).bold).toBe(true);
  if (!shown.props.caption) throw new Error("Missing caption");
  shown.rerender(
    <Palette {...shown.props} caption={{ ...shown.props.caption, html: change.html }} />,
  );
  fireEvent.click(shown.getByRole("button", { name: "Bold" }));
  expect(htmlMarks(shown.onCaption.mock.calls[1][0].html).bold).toBe(false);
});

it("formats a partial value selection without splitting the live link", () => {
  const shown = palette(linkHtml("m", "12.345 cm"));
  const value = shown.field.querySelector("[data-link]")?.firstChild;
  if (!value) throw new Error("Missing value text");
  act(() => {
    const range = document.createRange();
    range.setStart(value, 1);
    range.setEnd(value, 4);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  fireEvent.click(shown.getByRole("button", { name: "Bold" }));
  expect(shown.field.querySelectorAll("[data-link]")).toHaveLength(1);
  refreshLinks(shown.field, new Map([["m", "15 cm"]]));
  expect(shown.field.textContent).toBe("15 cm");
  expect(htmlMarks(shown.field.innerHTML).bold).toBe(true);
});

it("clears nested size overrides when sizing the entire caption at a collapsed caret", () => {
  const shown = palette(`<span style="font-size: 10pt">${linkHtml("m", "12 cm")}</span>`);
  act(() => window.getSelection()?.collapse(shown.field, 1));
  fireEvent.click(shown.getByRole("button", { name: "Size" }));
  fireEvent.click(shown.getByRole("button", { name: "28" }));
  expect(shown.onCaption).toHaveBeenCalledWith({ size: 28, html: shown.field.innerHTML });
  expect(shown.field.innerHTML).not.toContain("10pt");
});

it("enables style controls for standalone measurements and reports toggles", () => {
  const shown = palette("", false);
  const onSelectionMark = vi.fn();
  shown.rerender(
    <Palette
      {...shown.props}
      caption={null}
      selectionMarks={{ bold: false, italic: false, underline: false }}
      onSelectionMark={onSelectionMark}
    />,
  );
  for (const [name, mark] of [
    ["Bold", "bold"],
    ["Italic", "italic"],
    ["Underline", "underline"],
  ]) {
    const button = shown.getByRole("button", { name });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onSelectionMark).toHaveBeenCalledWith(mark, true);
  }
});
