/**
 * The polygon tool on the sheet: clicked out corner by corner, or, armed for
 * the regular one, a single click that asks what shape rather than tracing
 * anything at all.
 */

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { press, put, sheetOf, stubTheSheet, watched } from "../testing/canvas";

stubTheSheet();
afterEach(cleanup);

describe("the polygon tool", () => {
  it("asks what shape a regular one is, where the sheet was clicked", () => {
    const asked: { spot: { x: number; y: number }; at: { x: number; y: number } }[] = [];
    const { container } = put([], "polygon", {
      polygonKind: "regular",
      onRegularAsk: (wanted) => asked.push(wanted),
    });
    act(() => press(sheetOf(container), { x: 240, y: 180 }));
    expect(asked).toHaveLength(1);
    // The spot is in sheet units and the point to ask at is in screen pixels.
    // The view opens at the origin at 100%, so here the two agree.
    expect(asked[0].spot).toMatchObject({ x: 240, y: 180 });
    expect(asked[0].at).toEqual({ x: 240, y: 180 });
  });

  it("lays no corner down when it is the regular one being asked about", () => {
    const { sheet, page } = watched([], "polygon", { polygonKind: "regular" });
    act(() => press(sheet, { x: 240, y: 180 }));
    expect(page().objects).toEqual([]);
  });

  it("traces a corner instead when it is armed for an ordinary polygon", () => {
    const asked: unknown[] = [];
    const { sheet, page } = watched([], "polygon", {
      polygonKind: "interior-edges",
      onRegularAsk: (wanted) => asked.push(wanted),
    });
    act(() => press(sheet, { x: 240, y: 180 }));
    expect(asked).toEqual([]);
    expect(page().objects.map((object) => object.kind)).toEqual(["point"]);
  });

  it("keeps a half-traced polygon when only the fill arming moves", () => {
    // Both of those are clicked out the same way and the arming is read again
    // at the close, so moving between them mid-trace must cost no corners.
    const { sheet, page, rearm } = watched([], "polygon", { polygonKind: "interior-edges" });
    act(() => press(sheet, { x: 100, y: 100 }));
    act(() => press(sheet, { x: 300, y: 100 }));
    act(() => rearm({ polygonKind: "interior" }));
    expect(page().objects).toHaveLength(2);
  });

  it("drops a half-traced polygon when it is armed for the regular one", () => {
    // Two corners down, then the flyout moves to Regular. The trace has to go
    // with it: left in flight its gesture would later roll the page back over
    // whatever the regular one drew.
    const { sheet, page, rearm } = watched([], "polygon", { polygonKind: "interior-edges" });
    act(() => press(sheet, { x: 100, y: 100 }));
    act(() => press(sheet, { x: 300, y: 100 }));
    expect(page().objects).toHaveLength(2);
    act(() => rearm({ polygonKind: "regular" }));
    expect(page().objects).toEqual([]);
  });
});
