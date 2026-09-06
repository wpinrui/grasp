import { afterEach, describe, expect, it } from "vitest";
import { captionReadings } from "./captionLinks";
import { linkHtml, plainText, withNames } from "./captions";
import { writeIn } from "./measure";
import {
  createCalculation,
  createMeasurement,
  createPoint,
  lineThrough,
  PX_PER_CM,
  settle,
} from "./model";
import { DEFAULT_PREFS } from "./prefs";

afterEach(() => writeIn(DEFAULT_PREFS.units));

const a = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "a" };
const b = { ...createPoint({ x: PX_PER_CM * 1.23456, y: 0 }, "medium"), id: "b" };
const c = { ...createPoint({ x: 0, y: PX_PER_CM * 2 }, "medium"), id: "c" };
const segment = lineThrough("segment", [a.id, b.id]);
const length = { ...createMeasurement("length", [segment.id], { x: 0, y: 0 }), id: "m" };
const figure = [a, b, c, segment, length];

describe("independent caption measurement formats", () => {
  it("links a calculation as its result or live equation with vertex references", () => {
    const calculation = {
      ...createCalculation({ kind: "value", of: "m" }, { x: 0, y: 0 }),
      id: "calc",
    };
    const objects = [...figure, calculation];
    const html =
      '<span data-link="calc" data-equation="true">old</span> / <span data-link="calc">old</span>';
    const text = (held: typeof objects) =>
      plainText(withNames(html, new Map(), captionReadings(held, settle(held).settled)));
    expect(text(objects)).toBe("AB = 1.23 cm / 1.23 cm");
    expect(
      text(objects.map((object) => (object.id === "b" ? { ...b, x: PX_PER_CM * 2 } : object))),
    ).toBe("AB = 2 cm / 2 cm");
  });
  it("converts and rounds from full precision while leaving other links and the source alone", () => {
    const readings = captionReadings(figure, settle(figure).settled);
    const html =
      '<span data-link="m" data-unit="mm" data-places="3" data-show-unit="false">old</span> + ' +
      linkHtml("m", "old");
    expect(plainText(withNames(html, new Map(), readings))).toBe("12.346 + 1.23 cm");
    expect(length.places).toBeUndefined();
  });

  it("keeps a chosen unit when sketch preferences change", () => {
    writeIn({ ...DEFAULT_PREFS.units, distance: "in" });
    const readings = captionReadings(figure, settle(figure).settled);
    const html = '<span data-link="m" data-unit="mm" data-places="3">old</span>';
    expect(plainText(withNames(html, new Map(), readings))).toBe("12.346 mm");
  });

  it("converts squared units and angular units", () => {
    const fill = { id: "fill", kind: "interior", vertices: [a.id, b.id, c.id] } as const;
    const area = createMeasurement("area", [fill.id], { x: 0, y: 0 });
    const angle = createMeasurement("angle", [b.id, a.id, c.id], { x: 0, y: 0 });
    const objects = [...figure, { ...fill, vertices: [...fill.vertices] }, area, angle];
    const readings = captionReadings(objects, settle(objects).settled);
    const areaHtml = `<span data-link="${area.id}" data-unit="mm" data-places="3">old</span>`;
    const angleHtml = `<span data-link="${angle.id}" data-unit="radians" data-places="3">old</span>`;
    expect(plainText(withNames(areaHtml, new Map(), readings))).toBe("123.456 mm²");
    expect(plainText(withNames(angleHtml, new Map(), readings))).toBe("1.571 rad");
  });

  it("ignores invalid stored format attributes", () => {
    const readings = captionReadings(figure, settle(figure).settled);
    const html = '<span data-link="m" data-unit="radians" data-places="999">old</span>';
    expect(plainText(withNames(html, new Map(), readings))).toBe("1.23 cm");
  });
});
