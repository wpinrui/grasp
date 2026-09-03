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

/** Held keys stay down between presses, so each one remembers its own state. */
interface Held {
  code: string;
  key: string;
  held: boolean;
}

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

function button(label: string, hint: string, onPress: (on: boolean) => void, holds: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "spike-touchbar__key";
  element.textContent = label;
  element.title = hint;
  let on = false;
  element.addEventListener("click", () => {
    on = holds ? !on : false;
    if (holds) element.classList.toggle("spike-touchbar__key--on", on);
    onPress(on);
  });
  return element;
}

function build(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "spike-touchbar";

  const pan: Held = { code: "Space", key: " ", held: false };

  bar.append(
    button("Undo", "Undo", () => tap("KeyZ", "z", true), false),
    button("Redo", "Redo", () => tap("KeyR", "r", true), false),
    button("Pan", "Drag the sheet", (on) => key(pan.code, pan.key, on), true),
    // Off snaps to what is on the sheet and nothing else. On adds the length
    // and angle steps, which is the state the Snap panel would have been opened
    // to set, and that panel is not on a phone.
    button(
      "Snap",
      "Snap to length and angle",
      (on) => {
        window.dispatchEvent(new CustomEvent("spike:snap", { detail: on ? SNAP_ON : SNAP_OFF }));
      },
      true,
    ),
    button("Esc", "Cancel what is being drawn", () => tap("Escape", "Escape"), false),
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
