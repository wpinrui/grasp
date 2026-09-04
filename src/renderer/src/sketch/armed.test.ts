// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toolDraws } from "./armed";

/**
 * What the palette is set on follows what the tool that is up would draw, so
 * the table saying which is worth pinning: an entry that goes missing leaves
 * the bar arming the wrong kind of thing with nothing to say so.
 */
describe("what a tool draws", () => {
  it("says nothing for the Arrow, which draws nothing", () => {
    expect(toolDraws("arrow", "interior-edges")).toEqual([]);
  });

  it("follows what the polygon tool is armed with", () => {
    expect(toolDraws("polygon", "interior")).toEqual(["interior"]);
    expect(toolDraws("polygon", "interior-edges")).toEqual(["interior", "line"]);
    // The regular one lays its own corners down, so a point is its to arm too.
    expect(toolDraws("polygon", "regular")).toEqual(["point", "interior", "line"]);
  });

  it("gives the drawing tools the one kind each of them draws", () => {
    expect(toolDraws("point", "")).toEqual(["point"]);
    expect(toolDraws("straightedge", "")).toEqual(["line"]);
    expect(toolDraws("compass", "")).toEqual(["circle"]);
    expect(toolDraws("text", "")).toEqual(["caption"]);
    expect(toolDraws("measure", "")).toEqual(["measurement"]);
    expect(toolDraws("marker", "")).toEqual(["mark"]);
  });
});
