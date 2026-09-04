/**
 * What a reading's panel sets. None of it is reached by the sheet's own tests:
 * a panel is open only once a reading has been clicked, and no test clicks one.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createAngleMark,
  createMeasurement,
  createPoint,
  isMark,
  isMeasurement,
  lineThrough,
  type SketchObject,
} from "../../sketch/model";
import { type Sketch, useSketch } from "../../sketch/useSketch";
import { useReading } from "./useReading";

const A = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "A" };
const B = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "B" };
const C = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "C" };
const EAST = { ...lineThrough("segment", ["A", "B"]), id: "east" };
const SOUTH = { ...lineThrough("segment", ["A", "C"]), id: "south" };

/** The angle at A, marked and read the one way round. */
const MARK = {
  ...createAngleMark({
    corner: "A",
    arms: ["B", "C"],
    sides: ["east", "south"],
    strokes: 1,
    reflex: false,
    radius: 24,
  }),
  id: "mark",
};
const READING = {
  ...createMeasurement("angle", ["B", "A", "C"], { x: 30, y: 30 }),
  id: "read",
};
/** The same angle read the other way round, which the first one is not alone with. */
const OTHER = {
  ...createMeasurement("angle", ["B", "A", "C"], { x: -30, y: -30 }),
  id: "read-too",
  reflex: true,
};

const FIGURE: SketchObject[] = [A, B, C, EAST, SOUTH, MARK, READING];

/** The hook over a real page, and the page it is working on. */
function open(objects: SketchObject[]) {
  const sketch = renderHook(() => useSketch()).result;
  act(() => sketch.current.commit({ objects, selection: [] }));
  const reading = renderHook(() => useReading(sketch.current)).result;
  return {
    reading,
    sketch,
    at: (id: string) => sketch.current.state.objects.find((object) => object.id === id),
  };
}

describe("what a reading's panel sets", () => {
  it("draws a length out, and stops drawing it out again", () => {
    const length = { ...createMeasurement("length", ["east"], { x: 50, y: 20 }), id: "len" };
    const { reading, at } = open([...FIGURE, length]);
    act(() => reading.current.setBounds("len", "full"));
    const drawn = at("len");
    expect(drawn && isMeasurement(drawn) ? drawn.bounds : null).toBe("full");
    act(() => reading.current.setBounds("len", undefined));
    const bare = at("len");
    expect(bare && isMeasurement(bare) ? bare.bounds : "still there").toBeUndefined();
  });

  it("pins how far one reading is written out", () => {
    const { reading, at } = open(FIGURE);
    act(() => reading.current.setPlaces("read", 4));
    const found = at("read");
    expect(found && isMeasurement(found) ? found.places : null).toBe(4);
  });

  it("gives a reading its dotted lines, and takes them away", () => {
    const { reading, at } = open(FIGURE);
    act(() => reading.current.setLeaders("read", true));
    const led = at("read");
    expect(led && isMeasurement(led) ? led.leaders : null).toBe(true);
    act(() => reading.current.setLeaders("read", false));
    const bare = at("read");
    expect(bare && isMeasurement(bare) ? bare.leaders : null).toBe(false);
  });
});

/**
 * A number tied to what it reads. The chain is what puts it on the same footing
 * as the arrows and the arcs, which are worked out from the figure every time
 * they are drawn and so were never left behind by it.
 */
describe("tying a number to its figure", () => {
  /** A length hung 20 above the middle of the segment from A to B. */
  const LENGTH = {
    ...createMeasurement("length", ["east"], { x: 50, y: -20 }),
    id: "len",
    bare: true,
  };

  /** The page with B dragged out to there, which stretches the segment. */
  function stretched(sketch: { current: Sketch }, x: number) {
    act(() =>
      sketch.current.commit({
        objects: sketch.current.state.objects.map((object) =>
          object.id === "B" ? { ...object, x } : object,
        ),
        selection: [],
      }),
    );
  }

  function spot(found: SketchObject | undefined) {
    return found && "x" in found ? { x: found.x, y: found.y } : null;
  }

  it("takes the spot the number is at already, so nothing jumps", () => {
    const { reading, at } = open([...FIGURE, LENGTH]);
    act(() => reading.current.setLinked("len", true));
    const tied = at("len");
    const held = tied && isMeasurement(tied) ? tied.linked : null;
    // Over the middle of the segment, which is no way along it, and 20 clear.
    expect(held?.along).toBeCloseTo(0);
    expect(held?.across).toBeCloseTo(20);
    expect(spot(tied)).toEqual({ x: 50, y: -20 });
  });

  it("carries the number as the figure moves under it", () => {
    const { reading, at, sketch } = open([...FIGURE, LENGTH]);
    act(() => reading.current.setLinked("len", true));
    stretched(sketch, 300);
    // Over the middle of the longer segment, and the same 20 clear of it.
    expect(spot(at("len"))?.x).toBeCloseTo(150);
    expect(spot(at("len"))?.y).toBeCloseTo(-20);
  });

  it("leaves the number behind while it is not tied", () => {
    const { at, sketch } = open([...FIGURE, LENGTH]);
    stretched(sketch, 300);
    expect(spot(at("len"))).toEqual({ x: 50, y: -20 });
  });

  it("lets the number loose where the figure had carried it to", () => {
    const { reading, at, sketch } = open([...FIGURE, LENGTH]);
    act(() => reading.current.setLinked("len", true));
    stretched(sketch, 300);
    act(() => reading.current.setLinked("len", false));
    const loose = at("len");
    expect(loose && isMeasurement(loose) ? loose.linked : "still tied").toBeUndefined();
    // Left where the figure had brought it, and it goes no further.
    stretched(sketch, 500);
    expect(spot(at("len"))?.x).toBeCloseTo(150);
  });
});

/**
 * An angle read the long way round. The mark on that angle is what says which
 * of the angles at that corner the number is about, so the two cannot say
 * different things.
 */
describe("reading an angle the other way round", () => {
  it("turns the mark round with the number, where that number is the only one", () => {
    const { reading, at } = open(FIGURE);
    act(() => reading.current.setReflex("read", true));
    const turned = at("read");
    const mark = at("mark");
    expect(turned && isMeasurement(turned) ? turned.reflex : null).toBe(true);
    expect(mark && isMark(mark) && !("path" in mark) ? mark.reflex : null).toBe(true);
  });

  it("leaves the mark alone where both sizes of the angle are written", () => {
    const { reading, at } = open([...FIGURE, OTHER]);
    act(() => reading.current.setReflex("read", true));
    const mark = at("mark");
    expect(mark && isMark(mark) && !("path" in mark) ? mark.reflex : "gone").toBe(false);
  });
});

/**
 * What the Measure tool is offering is one thing with two faces, and never
 * both at once: a ghost of a number that is not there, or a number that is.
 */
describe("what the Measure tool is offering", () => {
  const ghost = { reading: READING, mark: null };

  it("offers a ghost where there is no number there already", () => {
    const { reading } = open(FIGURE);
    act(() => reading.current.offer(ghost, null));
    expect(reading.current.offering.ghost).toBe(ghost);
    expect(reading.current.offering.held).toBe(null);
  });

  it("lights the number already there instead of ghosting over it", () => {
    const { reading } = open(FIGURE);
    act(() => reading.current.offer(ghost, "read"));
    expect(reading.current.offering.ghost).toBe(null);
    expect(reading.current.offering.held).toBe("read");
  });

  it("offers nothing where nothing can be taken", () => {
    const { reading } = open(FIGURE);
    act(() => reading.current.offer(ghost, null));
    act(() => reading.current.offerNothing());
    expect(reading.current.offering).toEqual({ ghost: null, held: null });
  });

  /**
   * A reading is minted fresh on every move of the pointer, so what makes two
   * offers the same is what they say and where, not which object they are.
   */
  it("keeps the same offer rather than making it again", () => {
    const { reading } = open(FIGURE);
    act(() => reading.current.offer(ghost, null));
    const was = reading.current.offering;
    const minted = { ...READING, id: "minted-again" };
    act(() => reading.current.offer({ reading: minted, mark: null }, null));
    expect(reading.current.offering).toBe(was);
  });

  it("stops offering nothing over and over while the pointer is on bare sheet", () => {
    const { reading } = open(FIGURE);
    act(() => reading.current.offerNothing());
    const was = reading.current.offering;
    act(() => reading.current.offerNothing());
    expect(reading.current.offering).toBe(was);
  });
});

describe("the panel the window holds", () => {
  it("opens on one reading at a time, and closes again", () => {
    const { reading } = open(FIGURE);
    expect(reading.current.panel).toBe(null);
    act(() => reading.current.setPanel("read"));
    expect(reading.current.panel).toBe("read");
    act(() => reading.current.setPanel(null));
    expect(reading.current.panel).toBe(null);
  });
});
