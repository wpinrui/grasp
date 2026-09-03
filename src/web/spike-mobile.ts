/**
 * SPIKE, not for merge.
 *
 * The sheet already takes touch: the canvas is on pointer events with
 * `setPointerCapture` and sets `touch-action: none`, so a finger drag reaches
 * the drawing code exactly as a mouse drag does, and no pointer handler on it
 * reads a modifier key. What a finger has no way to reach is the three things
 * the sheet takes from the keyboard and the right button:
 *
 *   - panning, which is the right button dragging or Space held down,
 *   - constraining to whole angles, which is Shift held down,
 *   - cancelling a half-drawn construction, which is Escape.
 *
 * So this bar is three keys drawn on the screen. It dispatches the same
 * window-level keyboard events the canvas is already listening for rather than
 * reaching into it, which is what keeps the whole experiment out of
 * `src/renderer`. It is a way to answer the question, not a design: a real
 * answer would put panning on a second finger and would not need a bar at all.
 */

/** Held keys stay down between presses, so each one remembers its own state. */
type Key = { code: string; key: string; label: string; hint: string; held: boolean };

function press(key: Key, down: boolean) {
  const type = down ? "keydown" : "keyup";
  window.dispatchEvent(
    new KeyboardEvent(type, { code: key.code, key: key.key, bubbles: true, cancelable: true }),
  );
}

function build(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "spike-touchbar";

  const keys: Key[] = [
    { code: "Space", key: " ", label: "Pan", hint: "Drag the sheet", held: false },
    { code: "ShiftLeft", key: "Shift", label: "Snap", hint: "Whole angles", held: false },
  ];

  for (const key of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spike-touchbar__key";
    button.textContent = key.label;
    button.title = key.hint;
    button.addEventListener("click", () => {
      key.held = !key.held;
      press(key, key.held);
      button.classList.toggle("spike-touchbar__key--on", key.held);
    });
    bar.append(button);
  }

  // Escape is not held, so it goes down and straight back up.
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "spike-touchbar__key";
  cancel.textContent = "Esc";
  cancel.title = "Cancel what is being drawn";
  cancel.addEventListener("click", () => {
    const key: Key = { code: "Escape", key: "Escape", label: "Esc", hint: "", held: false };
    press(key, true);
    press(key, false);
  });
  bar.append(cancel);

  return bar;
}

/**
 * A coarse pointer is the test rather than a width, because a narrow desktop
 * window is still a mouse and does not want any of this. `?spike=on` forces it
 * so the layout can be looked at on a desktop, and `?spike=off` takes it away
 * on a phone to show what the site does today.
 */
export function installMobileSpike() {
  const asked = new URLSearchParams(window.location.search).get("spike");
  if (asked === "off") return;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (!coarse && asked !== "on") return;

  document.body.classList.add("spike-mobile");
  document.body.append(build());
}
