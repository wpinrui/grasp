import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { linkHtml } from "../sketch/captions";
import { parse, serialise } from "../sketch/format";
import { createCaption, createMeasurement, isCaption, isMeasurement } from "../sketch/model";
import { DEFAULT_PREFS } from "../sketch/prefs";
import { drawnAs } from "../sketch/text";
import { useSketch } from "../sketch/useSketch";
import { paletteState } from "./palette";

it("changes the size and face of entire selected captions, including old nested link formatting", () => {
  const { result } = renderHook(() => useSketch());
  const captions = [0, 1].map((index) => ({
    ...createCaption({ x: 0, y: index * 50 }, 200, {
      font: "Arial",
      size: 14,
      colour: "--color-ink-black",
    }),
    html: `Area = <font size="2" face="Arial"><b><span style="font-size: 10pt; font-family: Arial">${linkHtml("m", "12 cm")}</span></b></font>`,
  }));
  act(() => result.current.commit({ objects: captions, selection: captions.map((one) => one.id) }));
  const palette = paletteState({
    sketch: result.current,
    objects: captions,
    selected: captions,
    selection: captions.map((one) => one.id),
    editing: null,
    labelPick: [],
    prefs: DEFAULT_PREFS,
    armed: {},
    setArmed: () => {},
    activeTool: "arrow",
    variants: {
      arrow: "all",
      straightedge: "segment",
      polygon: "interior-edges",
      text: "caption",
      measure: "length",
      marker: "equal",
    },
  });
  act(() => palette.styleWriting({ size: 28, font: "Georgia" }));
  for (const caption of result.current.state.objects.filter(isCaption)) {
    expect(caption.size).toBe(28);
    expect(caption.font).toBe("Georgia");
    expect(caption.html).not.toContain("10pt");
    expect(caption.html).not.toContain("Arial");
    expect(caption.html).not.toContain('size="2"');
    expect(caption.html).toContain("<b>");
    expect(caption.html).toContain('data-link="m"');
  }
});

it("styles selected measurements, preserves them on save, and undoes each toggle", () => {
  const { result } = renderHook(() => useSketch());
  const measurement = {
    ...createMeasurement("length", ["segment"], { x: 0, y: 0 }),
    unit: "mm",
    showUnit: false,
  };
  act(() => result.current.commit({ objects: [measurement], selection: [measurement.id] }));
  function palette() {
    return paletteState({
      sketch: result.current,
      objects: result.current.state.objects,
      selected: result.current.state.objects,
      selection: [measurement.id],
      editing: null,
      labelPick: [],
      prefs: DEFAULT_PREFS,
      armed: {},
      setArmed: () => {},
      activeTool: "arrow",
      variants: {
        arrow: "all",
        straightedge: "segment",
        polygon: "interior-edges",
        text: "caption",
        measure: "length",
        marker: "equal",
      },
    });
  }
  for (const mark of ["bold", "italic", "underline"] as const) {
    expect(palette().selectionMarks?.[mark]).toBe(false);
    act(() => palette().styleMark(mark, true));
    expect(palette().selectionMarks?.[mark]).toBe(true);
  }
  const saved = parse(
    serialise([{ name: "Page 1", objects: result.current.state.objects }], DEFAULT_PREFS),
  );
  const reading = saved.pages[0].objects.find(isMeasurement);
  expect(reading).toMatchObject({
    bold: true,
    italic: true,
    underline: true,
    unit: "mm",
    showUnit: false,
  });
  expect(reading && drawnAs(reading)).toMatchObject({
    fontWeight: "bold",
    fontStyle: "italic",
    textDecoration: "underline",
  });
  act(() => result.current.undo());
  expect(palette().selectionMarks).toEqual({ bold: true, italic: true, underline: false });
  act(() => palette().styleMark("bold", false));
  expect(palette().selectionMarks?.bold).toBe(false);
});
