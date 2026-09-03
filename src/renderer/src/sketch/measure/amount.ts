import {
  type ArcGeometry,
  type CircleGeometry,
  cornersOf,
  degreesOf,
  distance,
  distanceToLine,
  filledPath,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  type Position,
  type Settled,
  type SketchMeasurement,
  type SketchObject,
  spotOnPath,
  wedgeOf,
} from "../model";
import {
  arcSpread,
  cornerAngle,
  cornerOf,
  find,
  onCircle,
  shoelace,
  stretchOn,
  wholeLine,
} from "./shape";
import { TURN } from "./units";
/**
 * What a measurement comes to, in sheet units, or null when what it reads has
 * gone or has no value to give: a circle of no size, three points that stopped
 * being collinear, an angle with no arms.
 *
 * Lengths come back in sheet pixels and areas in square ones. They are turned
 * into centimetres where the reading is written, which is the one place the
 * units belong.
 */
export function amountOf(
  measurement: SketchMeasurement,
  objects: SketchObject[],
  settled: Settled,
): number | null {
  const parts = measurement.of.map((id) => find(objects, id));
  if (parts.some((part) => part === undefined)) return null;
  const held = parts as SketchObject[];
  const spot = (object: SketchObject) => settled.points.get(object.id) ?? null;

  switch (measurement.measure) {
    case "length": {
      const along = settled.lines.get(held[0].id);
      return along ? distance(along.a, along.b) : null;
    }
    case "distance": {
      if (held.every(isPoint)) {
        const [a, b] = held.map(spot);
        return a && b ? distance(a, b) : null;
      }
      const point = held.find(isPoint);
      const line = held.find(isLine);
      if (!point || !line) return null;
      const at = spot(point);
      const along = settled.lines.get(line.id);
      return at && along ? distanceToLine(wholeLine(along), at) : null;
    }
    case "perimeter": {
      const fill = held[0];
      if (!isInterior(fill)) return null;
      const corners = cornersOf(fill);
      if (corners) {
        const at = settled.shapes.get(fill.id);
        if (!at) return null;
        return at.reduce(
          (sum, corner, index) => sum + distance(corner, at[(index + 1) % at.length]),
          0,
        );
      }
      const arc = settled.arcs.get(filledPath(fill) ?? "");
      if (!arc) return null;
      const { length } = arcSpread(arc);
      if (wedgeOf(fill) === "sector") return length + 2 * arc.radius;
      return length + distance(spotOnPath(arc, 0), spotOnPath(arc, 1));
    }
    case "circumference": {
      const round = circleFor(held[0], settled);
      return round ? TURN * round.radius : null;
    }
    case "angle": {
      const points = held.every(isPoint) ? held : null;
      const three = points ? points.map((point) => point.id) : cornerOf(held[0], held[1]);
      if (!three) return null;
      const at = three.map((id) => settled.points.get(id));
      if (at.some((one) => one === undefined)) return null;
      const [a, b, c] = at as Position[];
      return cornerAngle(a, b, c);
    }
    case "area": {
      const round = circleFor(held[0], settled);
      if (round) return Math.PI * round.radius * round.radius;
      const fill = held[0];
      if (!isInterior(fill)) return null;
      const corners = settled.shapes.get(fill.id);
      if (corners) return shoelace(corners);
      const arc = settled.arcs.get(filledPath(fill) ?? "");
      if (!arc) return null;
      const { angle } = arcSpread(arc);
      const sector = (angle * arc.radius * arc.radius) / 2;
      // The segment is the sector less the triangle back to the centre.
      return wedgeOf(fill) === "sector"
        ? sector
        : sector - (arc.radius * arc.radius * Math.sin(angle)) / 2;
    }
    case "arc-angle":
    case "arc-length": {
      const found = arcSpanOf(held, settled);
      if (!found) return null;
      if (measurement.measure === "arc-length") return found.length;
      return degreesOf(found.angle);
    }
    case "radius": {
      const round = circleFor(held[0], settled);
      if (round) return round.radius;
      const arc = arcFor(held[0], settled);
      return arc ? arc.radius : null;
    }
    case "ratio": {
      if (held.every(isPoint)) {
        const at = held.map(spot);
        if (at.some((one) => one === null)) return null;
        const [a, b, c] = at as Position[];
        const along = { x: b.x - a.x, y: b.y - a.y };
        const reach = along.x * along.x + along.y * along.y;
        if (reach < 1e-9) return null;
        return ((c.x - a.x) * along.x + (c.y - a.y) * along.y) / reach;
      }
      const [one, other] = held.map((object) => settled.lines.get(object.id));
      if (!one || !other) return null;
      const under = distance(other.a, other.b);
      return under < 1e-9 ? null : distance(one.a, one.b) / under;
    }
    default: {
      const point = held[0];
      if (!isPoint(point) || point.from?.kind !== "on") return null;
      return point.from.at;
    }
  }
}

/** The circle an object is or fills, or null when it is neither. */
function circleFor(object: SketchObject, settled: Settled): CircleGeometry | null {
  if (isCircle(object)) return settled.circles.get(object.id) ?? null;
  if (!isInterior(object) || cornersOf(object) || wedgeOf(object)) return null;
  return settled.circles.get(filledPath(object) ?? "") ?? null;
}

/** The arc an object is or fills, or null when it is neither. */
function arcFor(object: SketchObject, settled: Settled): ArcGeometry | null {
  if (isArc(object)) return settled.arcs.get(object.id) ?? null;
  if (!isInterior(object) || !wedgeOf(object)) return null;
  return settled.arcs.get(filledPath(object) ?? "") ?? null;
}

/**
 * How far round an arc angle runs and how long that stretch is: off a selected
 * arc, or off a circle and the two or three points naming a stretch of it. An
 * arc flattened into a straight run turns through nothing but still has a
 * length, which is why the two are carried together.
 */
function arcSpanOf(
  held: SketchObject[],
  settled: Settled,
): { angle: number; length: number } | null {
  const arc = held.length === 1 ? settled.arcs.get(held[0].id) : undefined;
  if (arc) return arcSpread(arc);
  const round = held.find(isCircle);
  const points = held.filter(isPoint);
  if (!round || points.length !== held.length - 1) return null;
  const where = settled.circles.get(round.id);
  if (!where) return null;
  const at = points.map((point) => settled.points.get(point.id));
  if (at.some((one) => one === undefined)) return null;
  const spots = at as Position[];
  if (!spots.every((one) => onCircle(where, one))) return null;
  const angle = stretchOn(where, spots);
  return { angle, length: angle * where.radius };
}
