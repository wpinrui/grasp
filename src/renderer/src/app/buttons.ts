/**
 * The buttons on the sheet: what a new one takes with it, and what pressing one
 * does. A Presentation button presses the others, which is why pressing is one
 * function that reaches back into itself.
 */

import type { ButtonForm } from "../components/ButtonDialog";
import type { Building } from "../sketch/builds";
import { type ButtonAction, createButton, isButton, type Position } from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";

/** How long a presentation waits between the buttons it presses, in milliseconds. */
const IN_TURN = 600;

export interface ButtonContext {
  sketch: Sketch;
  building: Building;
  selection: string[];
  setButtonDialog: (next: ButtonForm | null) => void;
  /** Where a new button lands. */
  spot: () => Position;
  /** Put objects away, or bring them back, which is what a toggle does. */
  hideObjects: (ids: string[], hidden: boolean) => void;
}

export function buttonActions(context: ButtonContext) {
  const { sketch, building, selection, setButtonDialog, spot, hideObjects } = context;
  const { objects, selected, chosenPoints, geometry, viewport } = building;

  /** What a button of this kind holds on to, taken from what is selected. */
  function buttonWants(form: ButtonForm): string[] {
    if (form === "hide-show") return selection;
    if (form === "scroll") return chosenPoints.length === 1 ? [chosenPoints[0].id] : [];
    if (form === "present") return selected.filter(isButton).map((one) => one.id);
    return [];
  }

  /** A new button, holding what was selected when it was made. */
  function landButton(name: string, does: ButtonAction) {
    const form = does.form;
    setButtonDialog(null);
    const wants = buttonWants(form);
    if (form !== "link" && wants.length === 0) return;
    const filled: ButtonAction =
      does.form === "scroll"
        ? { ...does, point: wants[0] }
        : does.form === "link"
          ? does
          : { ...does, of: wants };
    sketch.addObjects([createButton(name, filled, spot())]);
  }

  /**
   * Pressing one. A Presentation button presses the others, so this reaches
   * back into itself; the ids it holds cannot include itself, since it was made
   * after them, so it always comes to a stop.
   */
  function pressButton(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found || !isButton(found)) return;
    const does = found.does;
    if (does.form === "hide-show") {
      // A toggle reads the sheet rather than remembering: everything away means
      // bring it back, and anything showing means put it away.
      const away = does.of.every(
        (one) => objects.find((object) => object.id === one)?.hidden === true,
      );
      const hiding = does.does === "toggle" ? !away : does.does === "hide";
      hideObjects(does.of, hiding);
      return;
    }
    if (does.form === "link") {
      sketch.selectPage(does.page);
      return;
    }
    if (does.form === "scroll") {
      const at = geometry.points.get(does.point);
      if (!at) return;
      const { scale } = sketch.view;
      const across = does.to === "centre" ? viewport.width / scale / 2 : 0;
      const down = does.to === "centre" ? viewport.height / scale / 2 : 0;
      sketch.setView({ ...sketch.view, x: at.x - across, y: at.y - down });
      return;
    }
    if (does.order === "together") {
      for (const one of does.of) pressButton(one);
      return;
    }
    // One after another, with a pause between, so a presentation can be
    // followed rather than happening all at once.
    does.of.forEach((one, nth) => {
      window.setTimeout(() => pressButton(one), nth * IN_TURN);
    });
  }

  return { buttonWants, landButton, pressButton };
}
