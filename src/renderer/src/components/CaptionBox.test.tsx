import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captionReadings } from "../sketch/captionLinks";
import { linkHtml, plainText } from "../sketch/captions";
import {
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
});
