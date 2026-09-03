/**
 * Printing: the page as it will come out on paper, and sending it there.
 *
 * A selection is not what is printed; the page is, drawn on nothing so the
 * paper shows through.
 */

import { type PageSetup, PX_PER_CM, printableArea } from "../sketch/paper";
import { type Drawn, pictureSvg } from "../sketch/picture";

/**
 * The whole page as it will print: the sheet's own picture, drawn the way
 * Page Setup says, on nothing so the paper shows through. A selection is not
 * what is printed; the page is.
 */
export function pagePicture(setup: PageSetup): Drawn | null {
  return pictureSvg(
    {
      background: "transparent",
      ink: setup.ink,
      points: setup.points,
      fill: setup.fill,
    },
    null,
  );
}

/**
 * Print: the picture goes to the printer on the paper Page Setup says. `close`
 * shuts whatever asked for it, since printing is the end of that dialog.
 */
export async function printPage(setup: PageSetup, close: () => void) {
  const drawn = pagePicture(setup);
  if (!drawn) return;
  close();
  const area = printableArea(setup);
  await window.api.print.page({
    svg: drawn.svg,
    paper: setup.paper,
    landscape: setup.landscape,
    margin: Math.round(setup.marginCm * PX_PER_CM),
    toPage: setup.fit === "page",
    width: drawn.width,
    height: drawn.height,
    area,
  });
}
