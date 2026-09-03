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
 * Two fingers pan the sheet.
 *
 * The sheet is panned by its two scrollbars rather than by anything the canvas
 * exposes, so the gesture drives their scroll positions and the canvas follows
 * the way it does for a mouse. The scrollbars are still there for that reason;
 * they are only drawn at no width.
 *
 * The first finger is left alone, so drawing starts the instant it lands and
 * feels no different for the gesture existing. It is the second finger that
 * changes what is happening, and the canvas is told about that with the
 * `pointercancel` it already handles: the half-drawn construction is abandoned
 * and the tool that was up stays up. Everything from then until the last finger
 * leaves is swallowed, so the finger still down when the other lifts does not
 * start drawing again.
 */
const PAN_FINGERS = 2;

function scrollers(sheet: Element) {
  const canvas = sheet.closest(".canvas");
  return {
    across: canvas?.querySelector<HTMLElement>(".canvas__scroll--horizontal") ?? null,
    down: canvas?.querySelector<HTMLElement>(".canvas__scroll--vertical") ?? null,
  };
}

function installTwoFingerPan() {
  /** Where each finger on the sheet is now, by the id the browser gave it. */
  const fingers = new Map<number, { x: number; y: number }>();
  /** The point between the fingers last time it was looked at. */
  let midpoint: { x: number; y: number } | null = null;
  let panning = false;

  function middle() {
    const places = [...fingers.values()];
    const sum = places.reduce((total, at) => ({ x: total.x + at.x, y: total.y + at.y }), {
      x: 0,
      y: 0,
    });
    return { x: sum.x / places.length, y: sum.y / places.length };
  }

  function swallow(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function sheetOf(event: PointerEvent): Element | null {
    const target = event.target;
    return target instanceof Element ? target.closest(".canvas__sheet") : null;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") return;
      const sheet = sheetOf(event);
      if (!sheet) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size < PAN_FINGERS) return;
      if (!panning) {
        panning = true;
        // What the first finger had started is dropped rather than landed.
        sheet.dispatchEvent(
          new PointerEvent("pointercancel", { bubbles: true, pointerId: event.pointerId }),
        );
      }
      midpoint = middle();
      swallow(event);
    },
    true,
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "touch" || !fingers.has(event.pointerId)) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!panning) return;
      swallow(event);
      const sheet = sheetOf(event) ?? document.querySelector(".canvas__sheet");
      if (!sheet || !midpoint) return;
      const now = middle();
      const { across, down } = scrollers(sheet);
      // The sheet goes the way the fingers go, so the scroll goes the other
      // way: dragging right shows what is to the left.
      if (across) across.scrollLeft -= now.x - midpoint.x;
      if (down) down.scrollTop -= now.y - midpoint.y;
      midpoint = now;
    },
    true,
  );

  for (const when of ["pointerup", "pointercancel"] as const) {
    document.addEventListener(
      when,
      (event) => {
        if (event.pointerType !== "touch" || !fingers.has(event.pointerId)) return;
        fingers.delete(event.pointerId);
        if (!panning) return;
        swallow(event);
        midpoint = fingers.size > 0 ? middle() : null;
        // The pan is over only when the sheet is let go of altogether.
        if (fingers.size === 0) panning = false;
      },
      true,
    );
  }
}

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
  installTwoFingerPan();
  installViewportTracking();
}
