/**
 * The web app's entry. The same renderer as the desktop app, with the main
 * process swapped for a tab: the surface goes in first, because the renderer
 * reads it on its first frame.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../renderer/src/App";
import "../renderer/src/styles/base.css";
// SPIKE, not for merge: see spike-mobile.ts.
import { PICK_REACH } from "../renderer/src/sketch/model/geometry";
import { installWebApi } from "./api";
import { installMobileSpike, onAPhone, REACH_FACTOR, SNAP_ON_SETTINGS } from "./spike-mobile";
import "./spike-mobile.css";
import "./web.css";

installWebApi();

const asked = new URLSearchParams(window.location.search);

/**
 * `chrome=none` leaves the sheet and takes away everything round it: the menu
 * bar, the rails, the palette and the page bar. A page embedding one figure has
 * no use for them and no room for them either.
 */
if (asked.get("chrome") === "none") document.body.classList.add("bare");

/**
 * `locked` holds the view where the sketch opened. The figure is still live,
 * so a corner drags and the numbers follow; what goes is moving the sheet
 * under it. An embed is framed on its figure and sized to fit, so panning and
 * zooming can only take the reader off it, and a page that scrolls has the
 * wheel spoken for anyway.
 *
 * The gestures are caught here rather than switched off in the canvas: they
 * belong to the window that is showing GRASP, not to GRASP.
 */
if (asked.has("locked")) {
  document.body.classList.add("locked");
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  /**
   * The wheel is taken from GRASP but not from the browser. Stopping the
   * handler keeps the zoom from running; leaving the default alone lets the
   * sheet, which has nothing to scroll, hand the wheel up to the page holding
   * the frame, so a reader scrolls past an embed rather than getting stuck on
   * it.
   */
  window.addEventListener("wheel", (event) => event.stopImmediatePropagation(), {
    capture: true,
    passive: true,
  });
  // Space and the right button are the two ways the sheet is dragged about.
  for (const when of ["keydown", "keyup"] as const) {
    window.addEventListener(
      when,
      (event) => {
        if (event.code === "Space") swallow(event);
      },
      true,
    );
  }
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) swallow(event);
    },
    true,
  );
  window.addEventListener("contextmenu", (event) => event.preventDefault(), true);
}

// SPIKE, not for merge: the sheet reads its snapping on its first frame, so the
// state the phone starts in, which is snapping on, has to be in place before
// the app is rendered.
if (onAPhone()) {
  window.api.settings.write(SNAP_ON_SETTINGS);
  PICK_REACH.factor = REACH_FACTOR;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// SPIKE, not for merge.
installMobileSpike();
