// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createLine,
  createMeasurement,
  createPoint,
  isPoint,
  lineThrough,
  type SketchObject,
  settle,
} from "../model";
import { angleFigure, withAnglePoints } from "./angleFigure";
import { angleGesture } from "./angleGesture";
import { quantityOf } from "./quantity";
import { anglesAt, armsAt } from "./shape";

const a = { ...createPoint({ x: 0, y: 0 }, "medium"), id: "a" };
const b = { ...createPoint({ x: 100, y: 0 }, "medium"), id: "b" };
const c = { ...createPoint({ x: 0, y: 100 }, "medium"), id: "c" };
const line = { ...lineThrough("line", ["a", "b"]), id: "line" };
const side = { ...lineThrough("segment", ["a", "c"]), id: "side" };
const page = (objects: SketchObject[]) =>
  angleFigure(
    objects.filter((object) => !object.hidden),
    objects,
    settle(objects).settled,
  );

describe("angle directions", () => {
  it("removes overlapping arms, zero angles and straight angles", () => {
    const mid = { ...createPoint({ x: 50, y: 0 }, "medium"), id: "mid" };
    const duplicate = lineThrough("segment", ["a", "mid"]);
    const figure = page([a, b, c, mid, line, side, duplicate]);
    expect(armsAt("a", figure.objects, figure.settled)).toHaveLength(3);
    expect(anglesAt("a", figure.objects, figure.settled).map((angle) => angle.turn)).toEqual([
      90, 90,
    ]);
    expect([...figure.names.values()]).not.toContain("?");
  });

  it("distinguishes a ray origin from its through point and rejects its backward extension", () => {
    const ray = { ...line, form: "ray" as const };
    const behind = { ...a, id: "behind", x: -100 };
    const figure = page([a, b, behind, ray]);
    expect(armsAt("a", figure.objects, figure.settled)).toHaveLength(1);
    expect(armsAt("b", figure.objects, figure.settled)).toHaveLength(2);
    expect(armsAt("behind", figure.objects, figure.settled)).toHaveLength(0);
  });

  it("supports constructed lines without defining endpoints", () => {
    const parallel = {
      ...createLine("line", { kind: "parallel", at: "c", to: "line" }),
      id: "parallel",
    };
    const figure = page([a, b, c, line, side, parallel]);
    expect(anglesAt("c", figure.objects, figure.settled)).toHaveLength(2);
  });

  it("persists only chosen direction dependencies and keeps the reading live when its line moves", () => {
    const objects = [a, b, c, line, side];
    const figure = page(objects);
    const chosen = angleGesture(
      "line",
      "side",
      [
        { x: -50, y: 0 },
        { x: 0, y: 50 },
      ],
      figure.objects,
      figure.settled,
    );
    expect(chosen).not.toBeNull();
    if (!chosen) return;
    const persisted = withAnglePoints(objects, figure.objects, [chosen.corner, ...chosen.arms]);
    const measurement = createMeasurement(
      "angle",
      [chosen.arms[0], chosen.corner, chosen.arms[1]],
      { x: 0, y: 0 },
    );
    expect(persisted.filter((object) => object.hidden)).toHaveLength(1);
    const moved = [
      ...persisted.map((object) =>
        object.id === "b" && isPoint(object) ? { ...object, y: 100 } : object,
      ),
      measurement,
    ];
    expect(quantityOf(measurement, moved, settle(moved).settled)?.value).toBeCloseTo(135);
    expect(page(persisted).helpers.some((helper) => chosen.arms.includes(helper.id))).toBe(false);
  });

  it("uses the traced path to distinguish 90 degrees from 270 degrees", () => {
    const figure = page([a, b, c, line, side]);
    const short = angleGesture(
      "line",
      "side",
      [
        { x: 50, y: 0 },
        { x: 35, y: 35 },
        { x: 0, y: 50 },
      ],
      figure.objects,
      figure.settled,
    );
    const long = angleGesture(
      "line",
      "side",
      [
        { x: 50, y: 0 },
        { x: 0, y: -50 },
        { x: -50, y: 0 },
        { x: 0, y: 50 },
      ],
      figure.objects,
      figure.settled,
    );
    expect(short?.reflex).toBe(false);
    expect(long?.reflex).toBe(true);
    expect(short?.arms).toEqual(long?.arms);
  });

  it("selects arms at an interior crossing instead of requiring shared defining endpoints", () => {
    const left = { ...a, id: "left", x: -100 };
    const top = { ...a, id: "top", y: -100 };
    const horizontal = { ...lineThrough("line", ["left", "b"]), id: "horizontal" };
    const vertical = { ...lineThrough("ray", ["top", "c"]), id: "vertical" };
    const figure = page([a, b, c, left, top, horizontal, vertical]);
    const chosen = angleGesture(
      "horizontal",
      "vertical",
      [
        { x: -50, y: 0 },
        { x: 0, y: 50 },
      ],
      figure.objects,
      figure.settled,
    );
    expect(chosen?.corner).toBe("a");
    expect(anglesAt("a", figure.objects, figure.settled)).toHaveLength(4);
  });
});
