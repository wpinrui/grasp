import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMeasurement, type SketchMeasurement } from "../sketch/model";
import { ReadingPanel } from "./ReadingPanel";

afterEach(cleanup);

const CHAIN = "Move the number with the figure";

/** The panel open on that reading, and the chain's handler. */
function panel(part: Partial<SketchMeasurement>) {
  const reading = {
    ...createMeasurement("length", ["seg"], { x: 0, y: 0 }),
    ...part,
  } as SketchMeasurement;
  const onLink = vi.fn();
  render(
    <ReadingPanel
      reading={reading}
      at={{ x: 0, y: 0 }}
      onBounds={() => {}}
      onLeaders={() => {}}
      onLink={onLink}
      onReflex={() => {}}
      places={2}
      onPlaces={() => {}}
    />,
  );
  return { reading, onLink };
}

/**
 * The chain on a reading's panel. It is offered on what the Measure tool wrote
 * and on nothing else: a reading from the Measure menu lands in a row up in the
 * corner of the view rather than beside a figure, so there is no figure for it
 * to be tied to.
 */
describe("the chain on a reading's panel", () => {
  it("is offered on a reading the Measure tool wrote", () => {
    panel({ bare: true });
    expect(screen.queryByRole("button", { name: CHAIN })).toBeTruthy();
  });

  it("is not offered on a reading from the Measure menu", () => {
    panel({});
    expect(screen.queryByRole("button", { name: CHAIN })).toBeNull();
  });

  it("is offered on every kind of reading the tool wrote", () => {
    for (const measure of ["angle", "area", "radius"] as const) {
      panel({ bare: true, measure, of: ["one", "two", "three"] });
      expect(screen.queryByRole("button", { name: CHAIN })).toBeTruthy();
      cleanup();
    }
  });

  it("ties a loose number and lets a tied one go", () => {
    const loose = panel({ bare: true });
    fireEvent.click(screen.getByRole("button", { name: CHAIN }));
    expect(loose.onLink).toHaveBeenCalledWith(loose.reading.id, true);
    cleanup();
    const tied = panel({ bare: true, linked: { along: 0, across: 20 } });
    fireEvent.click(screen.getByRole("button", { name: CHAIN }));
    expect(tied.onLink).toHaveBeenCalledWith(tied.reading.id, false);
  });
});
