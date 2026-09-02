/**
 * Page Setup: what a printed sheet is, and how the figure sits on it.
 *
 * One config dialog says all of it, and Print and Print Preview both read it,
 * so what is previewed cannot disagree with what comes out of the printer.
 *
 * Sizes are held in millimetres because that is how paper is sold, and turned
 * into CSS pixels only where something has to be drawn or printed.
 */

import type { PictureFill, PictureInk } from "./picture";

/** The papers Page Setup offers. Every one of them is a size Electron prints. */
export const PAPERS = ["A4", "A3", "Letter", "Legal"] as const;
export type Paper = (typeof PAPERS)[number];

/** Each paper upright, in millimetres. */
export const PAPER_SIZES: Record<Paper, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

/** Whether a figure too big for the page is shrunk onto it or printed as it is. */
export const FITS = ["page", "actual"] as const;
export type Fit = (typeof FITS)[number];

/** What one printed page is, and how what goes on it is drawn. */
export interface PageSetup {
  paper: Paper;
  landscape: boolean;
  /** The room left at all four edges, in centimetres. */
  marginCm: number;
  fit: Fit;
  ink: PictureInk;
  /** Whether the dots are printed. Labels are printed either way. */
  points: boolean;
  fill: PictureFill;
}

export const DEFAULT_PAGE: PageSetup = {
  paper: "A4",
  landscape: false,
  marginCm: 1.5,
  fit: "page",
  ink: "black",
  points: false,
  fill: "colour",
};

/** CSS pixels per centimetre: 96 to the inch, 2.54 centimetres to the inch. */
export const PX_PER_CM = 96 / 2.54;

/** The paper the way round it is set, in millimetres. */
export function paperSize(setup: PageSetup): { width: number; height: number } {
  const size = PAPER_SIZES[setup.paper];
  return setup.landscape ? { width: size.height, height: size.width } : size;
}

/** What is left of the paper once the margins are taken off, in CSS pixels. */
export function printableArea(setup: PageSetup): { width: number; height: number } {
  const size = paperSize(setup);
  const margin = setup.marginCm * PX_PER_CM * 2;
  return {
    width: Math.max(1, (size.width / 10) * PX_PER_CM - margin),
    height: Math.max(1, (size.height / 10) * PX_PER_CM - margin),
  };
}

/**
 * How many sheets a figure needs at its own size, across and down. Scaling to
 * fit is always one; actual size takes as many as it takes, since a figure cut
 * off at the edge of one page is no use to anyone.
 */
export function sheetsFor(
  setup: PageSetup,
  width: number,
  height: number,
): { across: number; down: number } {
  if (setup.fit === "page") return { across: 1, down: 1 };
  const area = printableArea(setup);
  return {
    across: Math.max(1, Math.ceil(width / area.width)),
    down: Math.max(1, Math.ceil(height / area.height)),
  };
}
