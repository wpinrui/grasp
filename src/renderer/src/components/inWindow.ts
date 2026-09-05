/**
 * Keeping a floating box on screen.
 *
 * A tooltip and a dialog are both hung off the window rather than inside
 * anything on the page, so both have to answer the same question: given where
 * the box would go, where is the nearest spot to it that leaves all of the box
 * visible? Their margins differ and nothing else does, so the answer is here
 * rather than written out once each.
 */

/**
 * The nearest spot to `wanted` that leaves all of a box of `size` inside the
 * window, `edge` pixels clear of every side, in screen pixels from the top
 * left. Where the window is smaller than the box, the top and left edges win:
 * the near corner of a box is where its title and its first line are, so that
 * is the corner worth keeping.
 */
export function inWindow(
  wanted: { x: number; y: number },
  size: { width: number; height: number },
  edge: number,
): { x: number; y: number } {
  return {
    x: Math.max(edge, Math.min(wanted.x, window.innerWidth - size.width - edge)),
    y: Math.max(edge, Math.min(wanted.y, window.innerHeight - size.height - edge)),
  };
}
