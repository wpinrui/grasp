/**
 * What a picture is drawn in, which is the one thing about export that cannot
 * be read off the types: a token left off the ink list, or read off the wrong
 * element, still compiles and still exports a figure in the wrong colour.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PICTURE, pictureSvg } from "./picture";

/** The size the sheet reports, since jsdom lays nothing out. */
const SHEET = { width: 800, height: 600 };

const rect = Element.prototype.getBoundingClientRect;

/**
 * A sheet with one line on it, under a canvas holding the colours Preferences
 * sets. The canvas is what carries them in the app, so a picture that reads
 * its tokens off the window rather than off the sheet misses them.
 */
function put(path: string) {
  document.body.innerHTML = [
    `<div class="app__canvas" style="--color-path: ${path}">`,
    '<div class="canvas__sheet">',
    '<svg class="canvas__objects"><line class="canvas__line" x1="0" y1="0" x2="9" y2="9"/></svg>',
    "</div></div>",
  ].join("");
}

/** The stylesheet the picture carries, which is what settles its colours. */
function styleOf(ink: "colour" | "black"): string {
  const drawn = pictureSvg({ ...DEFAULT_PICTURE, ink }, null);
  if (!drawn) throw new Error("There is no picture to read.");
  return drawn.svg;
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: SHEET.width,
      bottom: SHEET.height,
      ...SHEET,
    }) as DOMRect;
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = rect;
  document.body.innerHTML = "";
});

describe("the colours a picture comes out in", () => {
  it("holds a path to the ink, the way it holds everything else drawn", () => {
    put("rgb(1, 2, 3)");
    expect(styleOf("black")).toContain("--color-path: var(--color-export-ink-black);");
  });

  it("holds a point to the ink too, since a shown point is drawn", () => {
    put("rgb(1, 2, 3)");
    expect(styleOf("black")).toContain("--color-point: var(--color-export-ink-black);");
  });

  it("takes the colours off the sheet, which is where Preferences puts them", () => {
    put("rgb(1, 2, 3)");
    expect(styleOf("colour")).toContain("--color-path: rgb(1, 2, 3);");
  });
});
