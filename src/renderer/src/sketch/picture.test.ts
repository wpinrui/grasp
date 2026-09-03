/**
 * What a picture is drawn in, which is the one thing about export that cannot
 * be read off the types: a token left off the ink list still compiles and still
 * exports a figure in the colour the ink was meant to replace.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHEET, stubSheetBox } from "../testing/sheet";
import { DEFAULT_PICTURE, type PictureOptions, pictureSvg } from "./picture";

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
function styleOf(said: Partial<PictureOptions>): string {
  const drawn = pictureSvg({ ...DEFAULT_PICTURE, ...said }, null);
  if (!drawn) throw new Error("There is no picture to read.");
  const opened = drawn.svg.indexOf("<style>");
  const closed = drawn.svg.indexOf("</style>");
  if (opened < 0 || closed < 0) throw new Error("The picture carries no stylesheet.");
  return drawn.svg.slice(opened + "<style>".length, closed);
}

/**
 * Whether the ink is the last word on a token.
 *
 * Every rule that sets one sits on the same `svg` selector, so the later of
 * them wins and text order is the cascade. That only holds while nothing sets
 * the token under a narrower selector, which would win from further up the
 * text, so the count is checked rather than assumed.
 */
function inkWins(css: string, token: string, ink: string): boolean {
  const set = css.split(`${token}:`).length - 1;
  return set === 2 && css.lastIndexOf(`${token}:`) === css.lastIndexOf(`${token}: ${ink}`);
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
    const css = styleOf({ ink: "black" });
    expect(css).toContain("--color-path: var(--color-export-ink-black);");
    expect(inkWins(css, "--color-path", "var(--color-export-ink-black)")).toBe(true);
  });

  it("holds a point to the ink too, on a picture that draws its points", () => {
    const css = styleOf({ ink: "black", points: true });
    expect(css).toContain("--color-point: var(--color-export-ink-black);");
    expect(css).not.toContain(".canvas__point { display: none; }");
    expect(inkWins(css, "--color-point", "var(--color-export-ink-black)")).toBe(true);
  });

  it("leaves every colour alone when the ink is the sketch's own", () => {
    expect(styleOf({ ink: "colour" })).not.toContain("var(--color-export-ink-");
  });

  // A dark sheet turns its palette over to read on black, and that turnover
  // lands on the canvas. A picture is drawn on white paper, so it takes the
  // window's palette and leaves the sheet's where it is.
  it("takes its colours off the window, not off the sheet it sits in", () => {
    expect(styleOf({ ink: "colour" })).toContain("--color-path: rgb(1, 2, 3);");
  });
});
