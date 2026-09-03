/**
 * The sheet's size, told to a test rather than laid out.
 *
 * jsdom lays nothing out, so every box on the sheet measures nothing and
 * anything that reads a rectangle sees an empty one. A test that draws the
 * sheet says how big it is instead.
 */

/** The size the sheet reports, since jsdom lays nothing out. */
export const SHEET = { width: 800, height: 600 };

/** Say how big every box is, and hand back the way to stop saying it. */
export function stubSheetBox(): () => void {
  const was = Element.prototype.getBoundingClientRect;
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
  return () => {
    Element.prototype.getBoundingClientRect = was;
  };
}
