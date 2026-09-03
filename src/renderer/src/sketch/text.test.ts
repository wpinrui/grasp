// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTION } from "../components/typeset";
import type {
  SketchButton,
  SketchCaption,
  SketchLine,
  SketchMeasurement,
  SketchTable,
} from "./model";
import { isWritten, labelLook, lookOf, textStyling } from "./text";

const caption = (over: Partial<SketchCaption> = {}): SketchCaption => ({
  id: "c",
  kind: "caption",
  x: 0,
  y: 0,
  width: 200,
  html: "Hello",
  align: "left",
  font: "Arial",
  size: 12,
  colour: "--color-ink-black",
  ...over,
});

const reading = (over: Partial<SketchMeasurement> = {}): SketchMeasurement => ({
  id: "m",
  kind: "measurement",
  measure: "length",
  of: ["a", "b"],
  x: 0,
  y: 0,
  ...over,
});

const table = (over: Partial<SketchTable> = {}): SketchTable => ({
  id: "t",
  kind: "table",
  of: ["m"],
  rows: [],
  x: 0,
  y: 0,
  ...over,
});

const button = (over: Partial<SketchButton> = {}): SketchButton => ({
  id: "b",
  kind: "button",
  name: "Show",
  does: { form: "hide-show", of: ["a"], does: "toggle" },
  x: 0,
  y: 0,
  ...over,
});

const line: SketchLine = {
  id: "l",
  kind: "line",
  form: "segment",
  span: { kind: "through", ends: ["a", "b"] },
};

describe("what counts as writing", () => {
  it("takes every kind that carries a face and a size", () => {
    expect(isWritten(caption())).toBe(true);
    expect(isWritten(reading())).toBe(true);
    expect(isWritten(table())).toBe(true);
    expect(isWritten(button())).toBe(true);
  });

  it("leaves out what is drawn rather than written", () => {
    expect(isWritten(line)).toBe(false);
  });
});

describe("how a piece of writing reads", () => {
  it("says what it holds", () => {
    expect(lookOf(caption())).toEqual({
      font: "Arial",
      size: 12,
      colour: "--color-ink-black",
    });
  });

  it("fills in the default where it holds nothing, since that is what is drawn", () => {
    expect(lookOf(reading())).toEqual(DEFAULT_CAPTION);
    expect(lookOf(table())).toEqual(DEFAULT_CAPTION);
  });

  it("reads a label against the way geometry is set in print", () => {
    expect(labelLook({}, "--color-ink-grey")).toEqual({
      font: "Times New Roman",
      size: 16,
      colour: "--color-ink-grey",
    });
  });
});

describe("what a mixed pick agrees about", () => {
  it("has nothing to say about nothing", () => {
    expect(textStyling([])).toBeNull();
  });

  it("says what one piece of writing holds", () => {
    expect(textStyling([lookOf(caption())])).toEqual({
      font: "Arial",
      size: 12,
      smallest: 12,
      colour: "--color-ink-black",
    });
  });

  it("says what they share", () => {
    const looks = [lookOf(reading()), lookOf(table()), lookOf(button())];
    expect(textStyling(looks)).toEqual({
      font: DEFAULT_CAPTION.font,
      size: DEFAULT_CAPTION.size,
      smallest: DEFAULT_CAPTION.size,
      colour: DEFAULT_CAPTION.colour,
    });
  });

  it("says nothing for a key they differ on, and keeps the smallest size", () => {
    const looks = [lookOf(caption()), lookOf(caption({ font: "Georgia", size: 20 }))];
    expect(textStyling(looks)).toEqual({
      font: null,
      size: null,
      smallest: 12,
      colour: "--color-ink-black",
    });
  });

  it("judges each key on its own, so an agreed size survives a mixed face", () => {
    const looks = [lookOf(caption()), lookOf(caption({ font: "Georgia" }))];
    expect(textStyling(looks)).toMatchObject({ font: null, size: 12 });
  });

  it("reads what is drawn, so a caption and a reading set alike agree", () => {
    const looks = [
      lookOf(caption({ font: DEFAULT_CAPTION.font, size: DEFAULT_CAPTION.size })),
      lookOf(reading()),
    ];
    expect(textStyling(looks)).toMatchObject({
      font: DEFAULT_CAPTION.font,
      size: DEFAULT_CAPTION.size,
    });
  });
});
