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

function key(code: string, name: string, down: boolean, modified = false) {
  window.dispatchEvent(
    new KeyboardEvent(down ? "keydown" : "keyup", {
      code,
      key: name,
      ctrlKey: modified,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** A press and its release, for the keys that are not held down. */
function tap(code: string, name: string, modified = false) {
  key(code, name, true, modified);
  key(code, name, false, modified);
}

/**
 * What the sheet snaps to on a phone, in the two states the button switches
 * between. Objects are snapped to either way. Snapping a move is off in both:
 * a finger is nowhere near accurate enough for the steps to help while dragging
 * something that is already drawn.
 */
export const SNAP_OFF = { objects: true, length: false, angle: false, moving: false };
export const SNAP_ON = { objects: true, length: true, angle: true, moving: false };

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
 * The icons, drawn on the same 20 by 20 box and in the same stroked line the
 * toolbox icons use, so the bar does not read as something bolted on from
 * somewhere else. Each one is the path data only; the box round it is shared.
 */
const ICONS = {
  undo: "M7.5 5.5 L4 9 L7.5 12.5 M4 9 h7.5 a4 4 0 1 1 0 8 h-2.5",
  redo: "M12.5 5.5 L16 9 L12.5 12.5 M16 9 h-7.5 a4 4 0 1 0 0 8 h2.5",
  // The magnet the Snap panel is marked with, which is the panel this button
  // stands in for now that the panel is not on screen.
  snap: "M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5 M5.4 3.4 L5.4 6.4 M14.6 3.4 L14.6 6.4",
  escape: "M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5",
  share:
    "M10 2.8 V12 M6.6 6.2 L10 2.8 L13.4 6.2 M4.6 11 V16.2 A1 1 0 0 0 5.6 17.2 H14.4 A1 1 0 0 0 15.4 16.2 V11",
};

function icon(path: string): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  // An inline SVG with no size given fills whatever holds it, which in a flex
  // row is the whole key.
  svg.setAttribute("width", "17");
  svg.setAttribute("height", "17");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

/**
 * One key on the bar. `holds` is the difference between a key that stays down
 * until it is pressed again, which lights up, and one that fires and is done.
 */
function button(
  label: string,
  path: string,
  onPress: (on: boolean) => void,
  holds: boolean,
  starts = false,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "spike-touchbar__key";
  element.title = label;
  element.setAttribute("aria-label", label);
  const name = document.createElement("span");
  name.className = "spike-touchbar__name";
  name.textContent = label;
  element.append(icon(path), name);
  let on = starts;
  element.addEventListener("click", () => {
    on = holds ? !on : false;
    if (holds) {
      element.classList.toggle("spike-touchbar__key--on", on);
      element.setAttribute("aria-pressed", String(on));
    }
    onPress(on);
  });
  if (holds) {
    element.classList.toggle("spike-touchbar__key--on", on);
    element.setAttribute("aria-pressed", String(on));
  }
  return element;
}

function build(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "spike-touchbar";

  bar.append(
    button("Undo", ICONS.undo, () => tap("KeyZ", "z", true), false),
    button("Redo", ICONS.redo, () => tap("KeyR", "r", true), false),
    // Off snaps to what is on the sheet and nothing else. On adds the length
    // and angle steps, which is the state the Snap panel would have been opened
    // to set, and that panel is not on a phone.
    button(
      "Snap",
      ICONS.snap,
      (on) => {
        window.dispatchEvent(new CustomEvent("spike:snap", { detail: on ? SNAP_ON : SNAP_OFF }));
      },
      true,
      true,
    ),
    button("Esc", ICONS.escape, () => tap("Escape", "Escape"), false),
  );

  return bar;
}

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
 * A long press on a tool opens its variants.
 *
 * The toolbox opens them on hover, which a finger does not have. Rather than
 * teach it a second way in, the press is turned into the hover it is already
 * listening for: React works its enter and leave events out from `mouseover`
 * and `mouseout`, so those are what go in. Tapping anywhere else puts the
 * flyout away again, which is the leave.
 */
const HOLD_MS = 450;
/** How far a finger can wander and still be holding still rather than dragging. */
const HOLD_SLOP = 8;

function hover(element: Element, over: boolean) {
  element.dispatchEvent(
    new MouseEvent(over ? "mouseover" : "mouseout", { bubbles: true, relatedTarget: null }),
  );
}

function installLongPressFlyouts() {
  let held: { tool: Element; x: number; y: number; timer: number } | null = null;
  let open: Element | null = null;

  function drop() {
    if (held) window.clearTimeout(held.timer);
    held = null;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch") return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      // A press anywhere that is not the flyout itself puts an open one away.
      if (open && !target.closest(".variants")) {
        hover(open, false);
        open = null;
      }

      const tool = target.closest(".toolbox .tool");
      if (!tool) return;
      held = {
        tool,
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          hover(tool, true);
          open = tool;
          held = null;
        }, HOLD_MS),
      };
    },
    true,
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      if (!held) return;
      const gone = Math.hypot(event.clientX - held.x, event.clientY - held.y);
      if (gone > HOLD_SLOP) drop();
    },
    true,
  );

  for (const when of ["pointerup", "pointercancel"] as const) {
    document.addEventListener(when, drop, true);
  }
}

/**
 * A share button on the tool rail, handing the sketch to whatever the device
 * shares with.
 *
 * The document only exists inside the app, so the file is got the way the app
 * already makes one: Save is asked for, and the call it makes to write the
 * sketch out is answered here instead of on disk. That keeps the sketch's own
 * serialising in one place rather than a second copy of it living here.
 */
const SHARE_ICON_SIZE = 22;

function installShare() {
  let wanted = false;

  async function hand(text: string, name: string): Promise<boolean> {
    const file = new File([text], `${name}.grasp`, { type: "application/json" });
    // Not every device will take an unknown extension, and one that will not
    // says so before anything is shown to the reader.
    if (!navigator.canShare?.({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], title: name });
    } catch {
      // A share the reader backed out of is not a failure worth falling back on.
    }
    return true;
  }

  // Save is left doing exactly what it did unless the share button asked for it.
  const saveAs = window.api.file.saveAs;
  window.api.file.saveAs = async (text: string, suggested: string) => {
    if (!wanted) return saveAs(text, suggested);
    wanted = false;
    return (await hand(text, suggested)) ? null : saveAs(text, suggested);
  };

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool spike-share";
  button.title = "Share this sketch";
  button.setAttribute("aria-label", "Share this sketch");
  const mark = icon(ICONS.share);
  mark.setAttribute("width", String(SHARE_ICON_SIZE));
  mark.setAttribute("height", String(SHARE_ICON_SIZE));
  button.append(mark);
  button.addEventListener("click", () => {
    wanted = true;
    tap("KeyS", "s", true);
  });

  /** The rail is React's, so the button is put back if a render takes it out. */
  function attach() {
    const rail = document.querySelector(".toolbox");
    if (rail && button.parentElement !== rail) rail.append(button);
  }
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
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
  document.body.append(build());
  installTwoFingerPan();
  installLongPressFlyouts();
  installShare();
}
