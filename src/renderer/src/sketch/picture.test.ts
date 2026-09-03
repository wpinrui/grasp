/**
 * What a picture is drawn in, which is the one thing about export that cannot
 * be read off the types: a token left off the ink list still compiles and still
 * exports a figure in the colour the ink was meant to replace.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHEET, stubSheetBox } from "../testing/sheet";
import { DEFAULT_PICTURE, type PictureInk, pictureSvg } from "./picture";

let unstub: () => void;

/**
 * A sheet with one line and one point on it, under a canvas holding a colour
 * of its own. The canvas is what carries a dark sheet's turned-over palette in
 * the app, which is why the picture reads the window rather than the sheet.
 */
function put() {
  document.body.innerHTML = [
    '<div class="app__canvas" style="--color-path: rgb(9, 9, 9)">',
    '<div class="canvas__sheet">',
    `<svg class="canvas__objects" width="${SHEET.width}" height="${SHEET.height}">`,
    '<line class="canvas__line" x1="0" y1="0" x2="9" y2="9"/>',
    '<circle class="canvas__point" cx="4" cy="4" r="3"/>',
    "</svg></div></div>",
  ].join("");
  document.documentElement.style.setProperty("--color-path", "rgb(1, 2, 3)");
}

/** The stylesheet the picture carries, which is what settles its colours. */
function styleOf(ink: PictureInk): string {
  const drawn = pictureSvg({ ...DEFAULT_PICTURE, ink }, null);
  if (!drawn) throw new Error("There is no picture to read.");
  const opened = drawn.svg.indexOf("<style>");
  const closed = drawn.svg.indexOf("</style>");
  if (opened < 0 || closed < 0) throw new Error("The picture carries no stylesheet.");
  return drawn.svg.slice(opened + "<style>".length, closed);
}

/**
 * Where a token is last set, since the whole stylesheet sits on one selector
 * and the last word on a token is the one the picture is drawn in.
 */
function lastSet(css: string, token: string): number {
  return css.lastIndexOf(`${token}:`);
}

beforeEach(() => {
  unstub = stubSheetBox();
  put();
});

afterEach(() => {
  unstub();
  document.documentElement.style.removeProperty("--color-path");
  document.body.innerHTML = "";
});

describe("the colours a picture comes out in", () => {
  it("holds a path to the ink, the way it holds everything else drawn", () => {
    const css = styleOf("black");
    expect(css).toContain("--color-path: var(--color-export-ink-black);");
    expect(lastSet(css, "--color-path")).toBe(
      css.lastIndexOf("--color-path: var(--color-export-ink-black);"),
    );
  });

  it("holds a point to the ink too, since a shown point is drawn", () => {
    const css = styleOf("black");
    expect(css).toContain("--color-point: var(--color-export-ink-black);");
    expect(lastSet(css, "--color-point")).toBe(
      css.lastIndexOf("--color-point: var(--color-export-ink-black);"),
    );
  });

  it("leaves every colour alone when the ink is the sketch's own", () => {
    expect(styleOf("colour")).not.toContain("var(--color-export-ink-");
  });

  // A dark sheet turns its palette over to read on black, and that turnover
  // lands on the canvas. A picture is drawn on white paper, so it takes the
  // window's palette and leaves the sheet's where it is.
  it("takes its colours off the window, not off the sheet it sits in", () => {
    expect(styleOf("colour")).toContain("--color-path: rgb(1, 2, 3);");
  });
});
