/**
 * SPIKE, not for merge.
 *
 * The sheet already takes touch: the canvas is on pointer events with
 * `setPointerCapture` and sets `touch-action: none`, so a finger drag reaches
 * the drawing code exactly as a mouse drag does. What a finger has no way to
 * reach is what the sheet takes from hardware a phone does not have, which is
 * what this bar stands in for.
 *
 * Four of the five buttons are keys the app is already listening for on the
 * window, so they need nothing from the renderer and are dispatched straight at
 * it. Snap is the exception: it is a setting rather than a key, so it goes out
 * as an event App picks up. That one hook is the only place the experiment
 * reaches into `src/renderer`.
 */

/**
 * The on state again, in the shape the stored settings keep it in rather than
 * the shape the sheet reads. Seeded before the first frame, so a phone opens
 * snapping whatever the desktop was left set to.
 */
/**
 * How much wider a finger's aim is than a pointer's. Five sheet pixels of slack
 * is what a mouse needs; a fingertip covers several millimetres of glass and
 * cannot see what is under it, so everything it lands on has to be found from
 * further away.
 */
export const REACH_FACTOR = 2.5;

export const SNAP_ON_SETTINGS = {
  snapObjects: true,
  snapLength: true,
  snapAngle: true,
  snapMoving: false,
};

/**
 * The keyboard's half of the screen.
 *
 * A phone keyboard does not resize the window, it covers it: the layout
 * viewport stays the height it was and `dvh` with it, so a dialog centred in
 * the window ends up behind the keyboard the moment a field in it is tapped.
 * What does move is the visual viewport, so its height and its offset are
 * published as custom properties and the dialogs are laid out in those instead.
 */
function installViewportTracking() {
  const view = window.visualViewport;
  if (!view) return;
  function measure() {
    if (!view) return;
    const root = document.documentElement;
    root.style.setProperty("--spike-seen-height", `${view.height}px`);
    root.style.setProperty("--spike-seen-top", `${view.offsetTop}px`);
  }
  measure();
  view.addEventListener("resize", measure);
  view.addEventListener("scroll", measure);
}

/**
 * A coarse pointer is the test rather than a width, because a narrow desktop
 * window is still a mouse and does not want any of this. `?spike=on` forces it
 * so the layout can be looked at on a desktop, and `?spike=off` takes it away
 * on a phone to show what the site does today.
 */
export function onAPhone(): boolean {
  const asked = new URLSearchParams(window.location.search).get("spike");
  if (asked === "off") return false;
  return window.matchMedia("(pointer: coarse)").matches || asked === "on";
}

export function installMobileSpike() {
  if (!onAPhone()) return;
  document.body.classList.add("spike-mobile");
  installViewportTracking();
}
