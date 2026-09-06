/**
 * What a dark sheet turns over, which is the one thing about the palette that
 * cannot be checked by reading the types: a colour left off the turned-over
 * list still compiles and still comes out unreadable on a black sheet, and one
 * named there without a `-on-dark` of its own resolves to nothing at all.
 */

import { describe, expect, it } from "vitest";
import tokensCss from "../styles/tokens.css?raw";
import { canvasTokens, DEFAULT_PREFS, isDarkSheet, SHEETS } from "./prefs";

/** Every custom property tokens.css declares. */
const DECLARED = new Set([...tokensCss.matchAll(/^\s*(--[\w-]+):/gm)].map((hit) => hit[1]));

/** The names turned over on a dark sheet, read back off what canvasTokens did. */
function turnedOver(): string[] {
  const dark = SHEETS.find((sheet) => isDarkSheet(sheet.token));
  if (!dark) throw new Error("No dark sheet to check.");
  const tokens = canvasTokens({ ...DEFAULT_PREFS.colours, sheet: dark.token });
  return Object.entries(tokens)
    .filter(([, value]) => value.endsWith("-on-dark)"))
    .map(([name]) => name);
}

describe("what a dark sheet turns over", () => {
  it("gives every turned-over colour a dark counterpart to turn to", () => {
    const missing = turnedOver().filter((name) => !DECLARED.has(`${name}-on-dark`));
    expect(missing).toEqual([]);
  });

  it("turns over the shading a selection is drawn with, which is black on white", () => {
    // The stripes over a selected fill are the sheet colour inverted, so on a
    // dark sheet they have to come out light or a selected fill reads as unheld.
    expect(turnedOver()).toContain("--color-selection-shade");
  });

  it("leaves a light sheet every colour as it stands", () => {
    const light = SHEETS.find((sheet) => !isDarkSheet(sheet.token));
    if (!light) throw new Error("No light sheet to check.");
    const tokens = canvasTokens({ ...DEFAULT_PREFS.colours, sheet: light.token });
    expect(Object.values(tokens).filter((value) => value.endsWith("-on-dark)"))).toEqual([]);
  });
});
