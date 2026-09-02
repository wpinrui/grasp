/**
 * The page the printer is given: the figure laid out on the paper Page Setup
 * says, as one HTML document.
 *
 * Both hosts print the same sheets. The desktop app loads this into a window
 * nobody sees and hands that to the printer; the web app loads it into a frame
 * nobody sees and hands that to the browser's own print dialog. Either way the
 * chrome, the rails and the palette bar are never on the paper.
 */

/** What the renderer says a printed page is. Kept loose: the shape is its own. */
export interface PrintJob {
  svg: string;
  paper: "A4" | "A3" | "Letter" | "Legal";
  landscape: boolean;
  /** The room left at all four edges, in CSS pixels. */
  margin: number;
  /** Whether a figure too big for the page is shrunk onto it. */
  toPage: boolean;
  /** How big the picture came out, in CSS pixels. */
  width: number;
  height: number;
  /** What is left of the paper once the margins are off, in CSS pixels. */
  area: { width: number; height: number };
}

/**
 * The document the printer is given: one page per sheet the figure needs.
 *
 * The margins are the printer's, set from the job, so the body is exactly the
 * printable area. Scaled to fit that is one page and the picture shrinks onto
 * it. At its own size the picture is laid out once per sheet, slid so that
 * sheet's part of it shows and the rest is clipped away, which is what makes a
 * figure wider than the paper come out across several of them.
 */
export function pageHtml(job: PrintJob): string {
  const style = [
    "html, body { margin: 0; padding: 0; background: transparent; }",
    ".sheet { width: 100%; height: 100%; overflow: hidden; page-break-after: always; }",
    ".sheet:last-child { page-break-after: auto; }",
    ".fit { display: flex; align-items: center; justify-content: center; }",
    ".fit svg { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; }",
    ".tile { position: relative; }",
    ".tile svg { display: block; position: absolute; }",
  ].join("");

  if (job.toPage) {
    return [
      '<!doctype html><html><head><meta charset="utf-8"><style>',
      style,
      '</style></head><body><div class="sheet fit">',
      job.svg,
      "</div></body></html>",
    ].join("");
  }

  const across = Math.max(1, Math.ceil(job.width / job.area.width));
  const down = Math.max(1, Math.ceil(job.height / job.area.height));
  const sheets: string[] = [];
  for (let row = 0; row < down; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const left = -column * job.area.width;
      const top = -row * job.area.height;
      sheets.push(
        `<div class="sheet tile"><div style="position:absolute;left:${left}px;top:${top}px">${job.svg}</div></div>`,
      );
    }
  }
  return [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    style,
    "</style></head><body>",
    sheets.join(""),
    "</body></html>",
  ].join("");
}
