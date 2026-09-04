import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegularPolygonDialog } from "./RegularPolygonDialog";

// The dialog asks whether this is a touch screen, which jsdom cannot answer.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function box() {
  const asked: { sides: number; locked: boolean }[] = [];
  render(
    <RegularPolygonDialog
      at={{ x: 100, y: 100 }}
      onApply={(wanted) => asked.push(wanted)}
      onCancel={() => {}}
    />,
  );
  return {
    asked,
    key: (name: string) =>
      screen.getByRole("button", { name: new RegExp(name) }) as HTMLButtonElement,
    sides: () => screen.getByLabelText("Sides"),
    lock: () => screen.getByRole("switch", { name: "Lock" }),
    draw: () => screen.getByRole("button", { name: "Draw" }) as HTMLButtonElement,
  };
}

/**
 * One box asks the whole question: which shape, or how many sides if it is not
 * one of the shapes offered, and whether the answer is held.
 */
describe("what regular polygon to draw", () => {
  it("starts on the triangle, held", () => {
    const { asked, draw } = box();
    fireEvent.click(draw());
    expect(asked).toEqual([{ sides: 3, locked: true }]);
  });

  it("takes the shape off a key", () => {
    const { asked, key, draw } = box();
    fireEvent.click(key("Hexagon"));
    fireEvent.click(draw());
    expect(asked).toEqual([{ sides: 6, locked: true }]);
  });

  it("lets the keys go once a number is typed", () => {
    const { asked, key, sides, draw } = box();
    fireEvent.click(key("Square"));
    fireEvent.change(sides(), { target: { value: "9" } });
    // The keys are out of the running, and the number is what is drawn.
    expect(key("Square").disabled).toBe(true);
    // And it stops looking pressed, since the number is the answer now.
    expect(key("Square").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(draw());
    expect(asked).toEqual([{ sides: 9, locked: true }]);
  });

  it("hands the keys back when the number is cleared", () => {
    const { asked, key, sides, draw } = box();
    fireEvent.click(key("Pentagon"));
    fireEvent.change(sides(), { target: { value: "9" } });
    fireEvent.change(sides(), { target: { value: "" } });
    expect(key("Pentagon").disabled).toBe(false);
    fireEvent.click(draw());
    expect(asked).toEqual([{ sides: 5, locked: true }]);
  });

  it("will not draw a number that is not a polygon", () => {
    const { asked, sides, draw } = box();
    for (const typed of ["2", "3.5", "abc", "-4", "0x10", "1e1"]) {
      fireEvent.change(sides(), { target: { value: typed } });
      // "0x10" and "1e1" are numbers to `Number` but not to anyone typing a
      // count of sides, so neither draws a 16-gon nor a 10-gon by surprise.
      expect(draw().disabled).toBe(true);
      fireEvent.click(draw());
    }
    expect(asked).toEqual([]);
  });

  it("lets the shape loose when the lock is turned off", () => {
    const { asked, lock, draw } = box();
    fireEvent.click(lock());
    fireEvent.click(draw());
    expect(asked).toEqual([{ sides: 3, locked: false }]);
  });
});
