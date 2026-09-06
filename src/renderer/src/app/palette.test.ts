import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { linkHtml } from "../sketch/captions";
import { createCaption, isCaption } from "../sketch/model";
import { DEFAULT_PREFS } from "../sketch/prefs";
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
