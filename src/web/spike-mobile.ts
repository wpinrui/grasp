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
 * The same off state again, in the shape the stored settings keep it in rather
 * than the shape the sheet reads. Seeded before the first frame, so a phone
 * opens on it whatever the desktop was left set to.
 */
export const SNAP_OFF_SETTINGS = {
  snapObjects: true,
  snapLength: false,
  snapAngle: false,
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
  pan: "M10 2.5 V17.5 M2.5 10 H17.5 M10 2.5 L7.8 5 M10 2.5 L12.2 5 M10 17.5 L7.8 15 M10 17.5 L12.2 15 M2.5 10 L5 7.8 M2.5 10 L5 12.2 M17.5 10 L15 7.8 M17.5 10 L15 12.2",
  // The magnet the Snap panel is marked with, which is the panel this button
  // stands in for now that the panel is not on screen.
  snap: "M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5 M5.4 3.4 L5.4 6.4 M14.6 3.4 L14.6 6.4",
  escape: "M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5",
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
function button(label: string, path: string, onPress: (on: boolean) => void, holds: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "spike-touchbar__key";
  element.title = label;
  element.setAttribute("aria-label", label);
  const name = document.createElement("span");
  name.className = "spike-touchbar__name";
  name.textContent = label;
  element.append(icon(path), name);
  let on = false;
  element.addEventListener("click", () => {
    on = holds ? !on : false;
    if (holds) {
      element.classList.toggle("spike-touchbar__key--on", on);
      element.setAttribute("aria-pressed", String(on));
    }
    onPress(on);
  });
  if (holds) element.setAttribute("aria-pressed", "false");
  return element;
}

function build(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "spike-touchbar";

  bar.append(
    button("Undo", ICONS.undo, () => tap("KeyZ", "z", true), false),
    button("Redo", ICONS.redo, () => tap("KeyR", "r", true), false),
    button("Pan", ICONS.pan, (on) => key("Space", " ", on), true),
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
    ),
    button("Esc", ICONS.escape, () => tap("Escape", "Escape"), false),
  );

  return bar;
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
}
