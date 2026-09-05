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
 * of its own. The canvas is what carries the colours Preferences sets, so a
 * picture that reads the window instead comes out in the stock palette.
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

/** A box of its own, which beats the prototype stub every element shares. */
function boxed(element: Element, at: { x: number; y: number; size: number }) {
  const rect = {
    x: at.x,
    y: at.y,
    left: at.x,
    top: at.y,
    right: at.x + at.size,
    bottom: at.y + at.size,
    width: at.size,
    height: at.size,
  } as DOMRect;
  Object.defineProperty(element, "getBoundingClientRect", { value: () => rect });
}

/** A sheet with one short line on it, and the drawn cursor far away or absent. */
function withCursor(cursor: boolean) {
  document.body.innerHTML = [
    '<div class="app__canvas"><div class="canvas__sheet">',
    `<svg class="canvas__objects" width="${SHEET.width}" height="${SHEET.height}">`,
    '<line class="canvas__line" x1="0" y1="0" x2="20" y2="20"/>',
    "</svg>",
    cursor
      ? '<svg class="tool-cursor tool-cursor--outline"><path d="M11 1 L11 7"/></svg>' +
        '<svg class="tool-cursor"><path d="M11 1 L11 7"/></svg>'
      : "",
    "</div></div>",
  ].join("");
  const sheet = document.querySelector(".canvas__sheet") as HTMLElement;
  boxed(document.querySelector(".canvas__line") as Element, { x: 0, y: 0, size: 20 });
  for (const mark of document.querySelectorAll(".tool-cursor path")) {
    boxed(mark, { x: 400, y: 300, size: 46 });
  }
  return sheet;
}

describe("what a picture leaves out", () => {
  it("comes out the same size whether or not the cursor is on the sheet", () => {
    // The cursor's marks are paths on the sheet like any other, so without the
    // app's own list to keep them out they would widen the crop to reach them.
    withCursor(false);
    const alone = pictureSvg(DEFAULT_PICTURE, null);
    withCursor(true);
    const over = pictureSvg(DEFAULT_PICTURE, null);
    expect(alone).not.toBe(null);
    expect(over?.width).toBe(alone?.width);
    expect(over?.height).toBe(alone?.height);
    // And the crop really was the short line rather than the whole sheet, or
    // the two would agree by both being everything.
    expect(alone?.width).toBeLessThan(SHEET.width / 2);
  });

  it("leaves the cursor out of the drawing itself", () => {
    withCursor(true);
    const drawn = pictureSvg(DEFAULT_PICTURE, null);
    expect(drawn?.svg).not.toContain("tool-cursor");
    expect(drawn?.svg).toContain("canvas__line");
  });
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

  // As Coloured means the colours the sketch is drawn in, which sit on the
  // canvas rather than on the window.
  it("takes its colours off the sheet, not off the window around it", () => {
    expect(styleOf({ ink: "colour" })).toContain("--color-path: rgb(9, 9, 9);");
  });
});
