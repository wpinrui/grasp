// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTION } from "../components/typeset";
import type {
  SketchCalculation,
  SketchCaption,
  SketchFunction,
  SketchLine,
  SketchMeasurement,
  SketchParameter,
  SketchTable,
} from "./model";
import {
  drawnAs,
  inkAgreed,
  isWritten,
  lookOf,
  lookOfLabel,
  marksOfLabels,
  textBoxes,
  textStyling,
  VARIOUS,
} from "./text";

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

const parameter = (over: Partial<SketchParameter> = {}): SketchParameter => ({
  id: "p",
  kind: "parameter",
  value: 1,
  unit: "none",
  places: 2,
  x: 0,
  y: 0,
  ...over,
});

const calculation = (over: Partial<SketchCalculation> = {}): SketchCalculation => ({
  id: "k",
  kind: "calculation",
  expression: { kind: "number", value: 1 },
  x: 0,
  y: 0,
  ...over,
});

const graph = (over: Partial<SketchFunction> = {}): SketchFunction => ({
  id: "f",
  kind: "function",
  body: { kind: "number", value: 1 },
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

const inked = (colour?: string): SketchLine => ({ ...line, colour });

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
    expect(isWritten(parameter())).toBe(true);
    expect(isWritten(calculation())).toBe(true);
    expect(isWritten(graph())).toBe(true);
    expect(isWritten(table())).toBe(true);
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
    expect(lookOfLabel({}, "--color-ink-grey")).toEqual({
      font: "Times New Roman",
      size: 16,
      colour: "--color-ink-grey",
    });
  });

  it("lets what a label holds beat both the default and the ink it is handed", () => {
    const held = { font: "Arial", size: 9, colour: "--color-ink-red" };
    expect(lookOfLabel(held, "--color-ink-grey")).toEqual(held);
  });

  it("sets a box the way the sheet draws it", () => {
    expect(drawnAs(caption({ font: "Georgia", size: 20, colour: "--color-ink-red" }))).toEqual({
      fontFamily: '"Georgia", serif',
      fontSize: "20pt",
      color: "var(--color-ink-red)",
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
    const looks = [lookOf(reading()), lookOf(table())];
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

  it("finds the smallest wherever it falls, since nothing orders a selection", () => {
    const looks = [lookOf(caption({ size: 20 })), lookOf(caption({ size: 8 })), lookOf(caption())];
    expect(textStyling(looks)).toMatchObject({ size: null, smallest: 8 });
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

describe("what the two boxes read", () => {
  const set = (font: string, size: number) =>
    textStyling([lookOf(caption({ font, size })), lookOf(caption({ font, size }))]);

  it("says what the writing shares", () => {
    expect(textBoxes({}, set("Georgia", 20))).toEqual({
      font: "Georgia",
      size: "20",
      face: "Georgia",
    });
  });

  it("names a mixed face rather than picking one of them", () => {
    const mixed = textStyling([lookOf(caption()), lookOf(caption({ font: "Georgia" }))]);
    expect(textBoxes({}, mixed)).toEqual({ font: VARIOUS, size: "12", face: null });
  });

  it("writes a mixed size as the smallest with a plus after it", () => {
    const mixed = textStyling([lookOf(caption({ size: 16 })), lookOf(caption())]);
    expect(textBoxes({}, mixed)).toMatchObject({ size: "12+" });
  });

  it("leaves the Font box no face to be a specimen of where they differ", () => {
    const mixed = textStyling([lookOf(caption()), lookOf(caption({ font: "Courier New" }))]);
    expect(textBoxes({}, mixed).face).toBeNull();
  });

  it("lets the caret beat the writing, since a run can say something else", () => {
    expect(textBoxes({ font: "Arial", size: 9 }, set("Georgia", 20))).toEqual({
      font: "Arial",
      size: "9",
      face: "Arial",
    });
  });

  it("lets the caret settle one box while the other still reads a disagreement", () => {
    const mixed = textStyling([lookOf(caption()), lookOf(caption({ font: "Georgia", size: 20 }))]);
    expect(textBoxes({ size: 9 }, mixed)).toMatchObject({ font: VARIOUS, size: "9" });
  });

  it("falls back to what a caption starts in when there is nothing to set", () => {
    expect(textBoxes({}, null)).toEqual({
      font: DEFAULT_CAPTION.font,
      size: `${DEFAULT_CAPTION.size}`,
      face: null,
    });
  });
});

describe("the three style keys over the picked labels", () => {
  it("reads a key on where every one of them agrees it is on", () => {
    expect(marksOfLabels([{ bold: true }, { bold: true, italic: false }])).toMatchObject({
      bold: true,
      italic: false,
    });
  });

  it("reads a key off where they disagree, so pressing it turns it on for all", () => {
    expect(marksOfLabels([{ bold: true }, { bold: false }]).bold).toBe(false);
  });

  it("falls back to the way a label starts where it holds nothing", () => {
    expect(marksOfLabels([{}])).toEqual({ bold: true, italic: true, underline: false });
  });
});

describe("the ink a pick reads at", () => {
  it("has nothing to say about nothing", () => {
    expect(inkAgreed([])).toBeNull();
  });

  it("says the ink where they share one", () => {
    expect(inkAgreed([inked("--color-ink-red"), inked("--color-ink-red")])).toBe("--color-ink-red");
  });

  it("says nothing where they differ, so the bar lights no swatch", () => {
    expect(inkAgreed([inked("--color-ink-red"), caption()])).toBeNull();
  });

  it("reads writing that holds no ink at the ink it is drawn in", () => {
    expect(inkAgreed([reading()])).toBe(DEFAULT_CAPTION.colour);
    expect(inkAgreed([inked(DEFAULT_CAPTION.colour), reading()])).toBe(DEFAULT_CAPTION.colour);
  });

  it("says nothing for anything else that holds no ink, since it says nothing", () => {
    expect(inkAgreed([inked()])).toBeNull();
    expect(inkAgreed([inked(), inked()])).toBeNull();
  });

  it("says nothing where writing that holds none is picked with a colour it is not drawn in", () => {
    expect(inkAgreed([reading(), inked("--color-ink-red")])).toBeNull();
  });
});
