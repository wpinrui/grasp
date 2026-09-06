import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { htmlMarks } from "../sketch/captionFormatting";
import { captionReadings } from "../sketch/captionLinks";
import { linkHtml, plainText } from "../sketch/captions";
import {
  createCalculation,
  createCaption,
  createMeasurement,
  createPoint,
  lineThrough,
  PX_PER_CM,
  settle,
} from "../sketch/model";
import { CaptionBox } from "./CaptionBox";
import { NOTATION } from "./typeset";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.getSelection()?.removeAllRanges();
});

const a = createPoint({ x: 0, y: 0 }, "medium");
const b = createPoint({ x: PX_PER_CM * 1.23456, y: 0 }, "medium");
const segment = lineThrough("segment", [a.id, b.id]);
const length = { ...createMeasurement("length", [segment.id], { x: 0, y: 0 }), id: "m" };
const objects = [a, b, segment, length];
const readings = captionReadings(objects, settle(objects).settled);

function props(html: string): ComponentProps<typeof CaptionBox> {
  return {
    caption: {
      ...createCaption({ x: 0, y: 0 }, 220, {
        font: "Arial",
        size: 14,
        colour: "--color-ink-black",
      }),
      html,
    },
    names: new Map(),
    readings,
    view: { x: 0, y: 0, scale: 1 },
    scale: 1,
    selected: false,
    editing: true,
    tool: "text",
    editor: { current: null },
    onEdit: vi.fn(),
    canDoubleEdit: true,
    onDoubleEdit: vi.fn(),
    onSelect: vi.fn(),
    onGrab: vi.fn(),
    onDrag: vi.fn(),
    onDrop: vi.fn(),
    onGestureStart: vi.fn(),
    onGestureEnd: vi.fn(),
    onWidth: vi.fn(),
    onAlign: vi.fn(),
    onCommit: vi.fn(),
    onLit: vi.fn(),
    onMeasure: vi.fn(),
  };
}

it("edits only the clicked link, commits its settings, and keeps trailing text", () => {
  const given = props(`${linkHtml("m", "old")} + ${linkHtml("m", "old")} trailing`);
  const shown = render(<CaptionBox {...given} />);
  const link = shown.container.querySelector("[data-link]");
  if (!link) throw new Error("Missing link");
  fireEvent.pointerDown(link, { button: 0 });
  fireEvent.click(shown.getByRole("button", { name: "Show units" }));
  fireEvent.change(shown.getByRole("combobox", { name: "Link unit" }), { target: { value: "mm" } });
  fireEvent.click(shown.getByRole("button", { name: "One more decimal place" }));
  expect(plainText(given.editor.current?.innerHTML ?? "")).toBe("12.346 + 1.23 cm trailing");
  expect(link.getAttribute("data-show-unit")).toBe("false");
  expect(given.onCommit).toHaveBeenCalled();
  const html = given.editor.current?.innerHTML ?? "";
  shown.rerender(<CaptionBox {...given} editing={false} caption={{ ...given.caption, html }} />);
  expect(shown.container.querySelector(".caption__body")?.textContent).toBe(
    "12.346 + 1.23 cm trailing",
  );
});

it("switches a calculation link between its full equation and final answer", () => {
  const calculation = createCalculation({ kind: "value", of: "m" }, { x: 0, y: 0 });
  const figure = [...objects, calculation];
  const given = {
    ...props(linkHtml(calculation.id, "old")),
    readings: captionReadings(figure, settle(figure).settled),
  };
  const shown = render(<CaptionBox {...given} />);
  const link = shown.container.querySelector("[data-link]");
  if (!link) throw new Error("Missing calculation link");
  fireEvent.pointerDown(link, { button: 0 });
  fireEvent.change(shown.getByRole("combobox", { name: "Calculation display" }), {
    target: { value: "equation" },
  });
  expect(link.textContent).toBe("AB = 1.23 cm");
  expect(link.getAttribute("data-equation")).toBe("true");
  fireEvent.change(shown.getByRole("combobox", { name: "Calculation display" }), {
    target: { value: "answer" },
  });
  expect(link.textContent).toBe("1.23 cm");
  expect(given.onCommit).toHaveBeenCalled();
});

it("clears legacy link colours while preserving other text formatting", () => {
  const given = props(`<span style="color: red; font-weight: bold">${linkHtml("m", "old")}</span>`);
  const shown = render(<CaptionBox {...given} />);
  const link = shown.container.querySelector("[data-link]");
  if (!link) throw new Error("Missing link");
  fireEvent.pointerDown(link, { button: 0 });
  fireEvent.click(shown.getByRole("button", { name: "One more decimal place" }));
  expect(link.parentElement?.style.color).toBe("");
  expect(link.parentElement?.style.fontWeight).toBe("bold");
  expect(link.textContent).toBe("1.235 cm");
});

it("tabs between filled fraction slots after their placeholders are gone", () => {
  const fraction = NOTATION.find((one) => one.id === "fraction");
  if (!fraction) throw new Error("Missing fraction");
  const given = props(fraction.html.replaceAll("?", "12345678901234567890"));
  const shown = render(<CaptionBox {...given} />);
  const editor = shown.getByRole("textbox");
  fireEvent.keyDown(editor, { key: "Tab" });
  expect(window.getSelection()?.anchorNode?.parentElement?.closest(".cap-frac__top")).toBeTruthy();
  fireEvent.keyDown(editor, { key: "Tab" });
  expect(
    window.getSelection()?.anchorNode?.parentElement?.closest(".cap-frac__bottom"),
  ).toBeTruthy();
  fireEvent.keyDown(editor, { key: "Tab" });
  expect(
    editor.querySelector(".cap-frac")?.contains(window.getSelection()?.anchorNode ?? null),
  ).toBe(false);
  const after = window.getSelection()?.getRangeAt(0);
  if (!after) throw new Error("Missing caret after fraction");
  after.insertNode(document.createTextNode(" after"));
  expect(editor.querySelector(".cap-frac")?.textContent).not.toContain("after");
  expect(editor.textContent).toContain(" after");
});

it.each([
  { key: "ArrowRight", selector: ".cap-frac__bottom", end: true },
  { key: "ArrowLeft", selector: ".cap-frac__top", end: false },
  { key: "Tab", selector: ".cap-frac__top", end: false },
])("leaves a fraction at its boundary with $key", ({ key, selector, end }) => {
  const fraction = NOTATION.find((one) => one.id === "fraction");
  if (!fraction) throw new Error("Missing fraction");
  const shown = render(<CaptionBox {...props(fraction.html.replaceAll("?", "12"))} />);
  const editor = shown.getByRole("textbox");
  const part = editor.querySelector(`${selector} .cap-slot`);
  if (!part) throw new Error("Missing fraction part");
  const range = document.createRange();
  range.selectNodeContents(part);
  range.collapse(!end);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent.keyDown(editor, { key, shiftKey: key === "Tab" });
  expect(
    editor.querySelector(".cap-frac")?.contains(window.getSelection()?.anchorNode ?? null),
  ).toBe(false);
});

it.each(["b", "i", "u"])("formats a selected live measurement with Ctrl+%s", (key) => {
  const given = props(linkHtml("m", "old"));
  const shown = render(<CaptionBox {...given} />);
  const link = shown.container.querySelector("[data-link]");
  if (!link) throw new Error("Missing link");
  fireEvent.pointerDown(link, { button: 0 });
  const editor = shown.getByRole("textbox");
  fireEvent.keyDown(editor, { key, ctrlKey: true });
  const mark = key === "b" ? "bold" : key === "i" ? "italic" : "underline";
  expect(htmlMarks(editor.innerHTML)[mark]).toBe(true);
  fireEvent.keyDown(editor, { key, ctrlKey: true });
  expect(htmlMarks(editor.innerHTML)[mark]).toBe(false);
});

it("keeps the link click target intact while selecting the caption", () => {
  const given = { ...props(linkHtml("m", "old")), editing: false, tool: "arrow" };
  const shown = render(<CaptionBox {...given} />);
  const link = shown.container.querySelector("[data-link]");
  const root = shown.container.querySelector<HTMLElement>(".caption");
  if (!link || !root) throw new Error("Missing caption link");
  root.setPointerCapture = vi.fn();
  fireEvent.pointerDown(link, { button: 0, pointerId: 1, clientX: 20, clientY: 20 });
  expect(root.setPointerCapture).not.toHaveBeenCalled();
  shown.rerender(<CaptionBox {...given} selected names={new Map()} readings={new Map(readings)} />);
  expect(shown.container.querySelector("[data-link]")).toBe(link);
  fireEvent.pointerMove(link, { pointerId: 1, clientX: 30, clientY: 20 });
  expect(root.setPointerCapture).toHaveBeenCalledWith(1);
});
