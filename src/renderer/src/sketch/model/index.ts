/**
 * What a page holds, and the geometry the canvas needs to hit-test it.
 *
 * Objects are stored in sheet coordinates: pixels on a sheet with no edges, y
 * downward. The canvas is a window onto it, `view` is the sheet point at the
 * window's top left corner and `scale` is screen pixels per sheet pixel, so
 * screen = (sheet - view) * scale.
 *
 * A dot keeps its size on screen at every zoom, so the sheet it covers, and
 * with it the reach of a click, is its drawn radius divided by the scale.
 *
 * A point is either free, and can be dragged, or an image with a `from` saying
 * how its parents place it. A line is never free: its `span` says which points
 * and lines put it where it is. Parents always come earlier in the list than
 * what hangs off them, so one pass down settles the whole page.
 */
export * from "./create";
export * from "./edit";
export * from "./figures";
export * from "./geometry";
export * from "./guards";
export * from "./look";
export * from "./marks";
export * from "./naming";
export * from "./paths";
export * from "./pick";
export * from "./settle";
export * from "./values";
