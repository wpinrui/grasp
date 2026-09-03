/**
 * Export: the sheet as a picture, cropped tight to what is being exported.
 *
 * The sheet is already drawn, so the picture is taken off the live sheet
 * rather than drawn a second time: the objects are SVG already, and the boxes
 * that ride above them as HTML go into the picture as they are. What the app
 * draws to say what it is doing, rather than what the sketch holds, is taken
 * out first: the grid, the selection bands, the snap lights, what a tool has
 * between its clicks, and what a dialog is pointing at.
 *
 * The picture is built in the sheet's own screen pixels, so a PNG at twice
 * that size is twice what is on screen and an SVG is a vector of it.
 */

import canvasCss from "../components/Canvas.css?raw";
import captionCss from "../components/CaptionBox.css?raw";
import readingCss from "../components/MeasurementBox.css?raw";
import tokensCss from "../styles/tokens.css?raw";

export type PictureBackground = "white" | "transparent";
export type PictureInk = "colour" | "black" | "white";
export type PictureFill = "hidden" | "colour" | "grey" | "black" | "white";

/** How a picture is drawn, which is what the export dialog says. */
export interface PictureOptions {
  background: PictureBackground;
  ink: PictureInk;
  /** Whether the dots are drawn. Labels stay either way. */
  points: boolean;
  fill: PictureFill;
}

export const DEFAULT_PICTURE: PictureOptions = {
  background: "white",
  ink: "black",
  points: false,
  fill: "colour",
};

/** The room left around the picture, in pixels. */
const MARGIN = 12;

/** How many times its on-screen size a PNG comes out at. */
const PNG_SCALE = 2;

/** Room for the odd sub-pixel, so a box is never clipped by its own edge. */
const SLACK = 2;

/** Never in a picture: what the app draws to say what it is doing. */
const UI_ONLY = [
  ".canvas__halo",
  ".canvas__circle-halo",
  ".canvas__line-halo",
  ".canvas__mark-halo",
  ".canvas__snap",
  ".canvas__snap-band",
  ".canvas__rubber",
  ".canvas__marquee",
  ".canvas__locus-arrow",
  ".canvas__guide",
  ".canvas__guide-arc",
  ".canvas__guide-datum",
  ".canvas__mark",
  ".canvas__mark-band",
  ".canvas__caption",
  ".canvas__label-input",
  ".canvas__zoom",
  ".caption-box",
  ".caption--ghost",
  ".reading--ghost",
  ".mark-panel",
  "[class*='--preview']",
].join(",");

/** The boxes that ride above the sheet as HTML rather than as SVG. */
const BOXES = ".canvas__label, .caption, .reading";

/** Everything that draws something, which is what the crop is measured off. */
const DRAWN = `circle, ellipse, line, path, polygon, polyline, rect, text, ${BOXES}`;

/**
 * The tokens ink is held to, so a figure comes out in one colour.
 *
 * A token tokens.css derives from another with var() has to be named here in
 * its own right. Every token is resolved to a colour before this list is
 * applied, so overriding the one it was derived from reaches it too late.
 */
const INK_TOKENS = [
  "--color-object-edge",
  "--color-point",
  "--color-path",
  "--color-locus",
  "--color-locus-arrow",
  "--color-mark",
  "--color-canvas-text",
  "--color-canvas-text-strong",
  "--color-canvas-divider",
  "--color-ink-black",
  "--color-ink-grey",
  "--color-ink-red",
  "--color-ink-orange",
  "--color-ink-green",
  "--color-ink-blue",
  "--color-ink-purple",
  "--color-ink-magenta",
];

export interface Picture {
  svg: string;
  png: Uint8Array;
}

/** A picture and how big it came out, which is what paper has to be cut to. */
export interface Drawn {
  svg: string;
  width: number;
  height: number;
}

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Whether this element goes in the picture: nothing the app drew about itself,
 * and, where only a selection is being exported, nothing outside it. An
 * element with no object of its own goes wherever its ancestor goes.
 */
function kept(element: Element, sheet: Element, wanted: Set<string> | null): boolean {
  for (let node: Element | null = element; node && node !== sheet; node = node.parentElement) {
    if (node.matches(UI_ONLY)) return false;
    const id = node.getAttribute("data-id");
    if (id !== null && wanted !== null && !wanted.has(id)) return false;
  }
  return true;
}

/** The picture's bounds in the sheet's own pixels, or nothing to draw. */
function cropOf(sheet: HTMLElement, wanted: Set<string> | null, points: boolean): Crop | null {
  const box = sheet.getBoundingClientRect();
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const element of sheet.querySelectorAll(DRAWN)) {
    if (!kept(element, sheet, wanted)) continue;
    if (!points && element.classList.contains("canvas__point")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (left === Number.POSITIVE_INFINITY) return null;
  return {
    x: Math.round(left - box.left) - MARGIN,
    y: Math.round(top - box.top) - MARGIN,
    width: Math.round(right - left) + MARGIN * 2,
    height: Math.round(bottom - top) + MARGIN * 2,
  };
}

/**
 * Every token, resolved off the sheet, so var() still means something.
 *
 * Off the sheet rather than off the window, since the colours Preferences sets
 * are put on the canvas, which the sheet sits inside and inherits from. As
 * Coloured means the colours the sketch is drawn in, and the sheet is the one
 * element every one of them has reached.
 */
function resolvedTokens(sheet: Element): string {
  const onSheet = getComputedStyle(sheet);
  const names = new Set([...tokensCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((found) => found[1]));
  return [...names].map((name) => `${name}: ${onSheet.getPropertyValue(name).trim()};`).join("\n");
}

/** What the dialog's four settings change about the way the picture is drawn. */
function overrides(options: PictureOptions): string {
  const rules: string[] = [];
  if (options.ink !== "colour") {
    const ink = `var(--color-export-ink-${options.ink})`;
    rules.push(`svg { ${INK_TOKENS.map((name) => `${name}: ${ink};`).join(" ")} }`);
  }
  if (options.fill === "hidden") {
    rules.push(".canvas__interior, .canvas__locus-fill { display: none; }");
  } else if (options.fill !== "colour") {
    const paint = `var(--color-export-fill-${options.fill})`;
    rules.push(`svg { --color-interior: ${paint}; --color-locus-fill: ${paint}; }`);
  }
  if (!options.points) rules.push(".canvas__point { display: none; }");
  return rules.join("\n");
}

/** Take out what the app drew about itself, and anything outside a selection. */
function prune(root: Element, wanted: Set<string> | null): void {
  for (const gone of [...root.querySelectorAll(UI_ONLY)]) gone.remove();
  if (wanted !== null) {
    for (const node of [...root.querySelectorAll("[data-id]")]) {
      const id = node.getAttribute("data-id");
      if (id !== null && !wanted.has(id)) node.remove();
    }
  }
  // Selection is a thing the window says, not a thing the sketch holds.
  for (const node of [root, ...root.querySelectorAll("[class]")]) {
    for (const name of [...node.classList]) {
      if (name.endsWith("--selected")) node.classList.remove(name);
    }
  }
}

/** One HTML box, put back where it sat, in a picture that is otherwise SVG. */
function boxAt(live: HTMLElement, box: DOMRect, wanted: Set<string> | null): string | null {
  const rect = live.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const clone = live.cloneNode(true) as HTMLElement;
  prune(clone, wanted);
  // The box is placed by the foreignObject now, so whatever placed it on the
  // sheet has to stop.
  clone.style.position = "static";
  clone.style.left = "auto";
  clone.style.top = "auto";
  clone.style.transform = "none";
  const inside = new XMLSerializer().serializeToString(clone);
  return [
    `<foreignObject x="${rect.left - box.left}" y="${rect.top - box.top}"`,
    ` width="${rect.width + SLACK}" height="${rect.height + SLACK}">`,
    inside,
    "</foreignObject>",
  ].join("");
}

/** The sheet as an SVG document, cropped tight, or nothing to draw. */
export function pictureSvg(options: PictureOptions, wanted: Set<string> | null): Drawn | null {
  const sheet = document.querySelector<HTMLElement>(".canvas__sheet");
  if (!sheet) return null;
  const crop = cropOf(sheet, wanted, options.points);
  if (!crop) return null;
  const box = sheet.getBoundingClientRect();

  const live = sheet.querySelector<SVGSVGElement>("svg.canvas__objects");
  let objects = "";
  if (live) {
    const clone = live.cloneNode(true) as SVGSVGElement;
    prune(clone, wanted);
    // The class placed it on the sheet with CSS; inside the picture it is a
    // nested drawing at the sheet's own origin, so it is placed by attribute.
    clone.removeAttribute("class");
    clone.setAttribute("x", "0");
    clone.setAttribute("y", "0");
    clone.setAttribute("width", `${box.width}`);
    clone.setAttribute("height", `${box.height}`);
    objects = new XMLSerializer().serializeToString(clone);
  }

  const boxes: string[] = [];
  for (const element of sheet.querySelectorAll<HTMLElement>(BOXES)) {
    if (!kept(element, sheet, wanted)) continue;
    const drawn = boxAt(element, box, wanted);
    if (drawn) boxes.push(drawn);
  }

  const css = [
    `svg { ${resolvedTokens(sheet)} font-family: var(--font-family); }`,
    ".export__paper { fill: var(--color-export-paper); }",
    canvasCss,
    captionCss,
    readingCss,
    overrides(options),
  ].join("\n");

  const paper =
    options.background === "white"
      ? `<rect class="export__paper" x="${crop.x}" y="${crop.y}" width="${crop.width}" height="${crop.height}"/>`
      : "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${crop.height}"`,
    ` viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}">`,
    `<style>${css}</style>`,
    paper,
    objects,
    ...boxes,
    "</svg>",
  ].join("");
  return { svg, width: crop.width, height: crop.height };
}

/** The same picture as pixels, at twice the size it is on the sheet. */
async function toPng(svg: string): Promise<Uint8Array> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The picture could not be drawn."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * PNG_SCALE));
  canvas.height = Math.max(1, Math.round(image.height * PNG_SCALE));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The picture could not be drawn.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The picture could not be drawn.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * The picture in both forms, since which one is wanted is only settled by the
 * file the save dialog comes back with. Nothing on the sheet gives nothing.
 */
export async function drawPicture(
  options: PictureOptions,
  wanted: Set<string> | null,
): Promise<Picture | null> {
  const drawn = pictureSvg(options, wanted);
  if (!drawn) return null;
  return { svg: drawn.svg, png: await toPng(drawn.svg) };
}
