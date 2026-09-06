import {
  distance,
  distanceToPath,
  isLine,
  isPoint,
  type LineGeometry,
  namedAmong,
  namesFor,
  parentsOf,
  type Settled,
  type SketchLine,
  type SketchObject,
  type SketchPoint,
  settle,
} from "../model";
import { ARM_DISTANCE, ARM_TURN, directionId, directionPoints } from "./angleDirections";

const helperPoint = (point: Pick<SketchPoint, "id" | "x" | "y" | "from">): SketchPoint => ({
  ...point,
  kind: "point",
  size: "small",
  hidden: true,
});

/** Constructed straight objects need a pair of dependent points to carry their vector. */
function lineVector(line: SketchLine, along: LineGeometry) {
  if (line.span.kind === "through") return { ends: line.span.ends, helpers: [] as SketchPoint[] };
  const helpers = [along.a, along.b].map((at, index) =>
    helperPoint({
      id: `angle-base:${line.id}:${index}`,
      x: at.x,
      y: at.y,
      from: { kind: "on", path: line.id, at: index },
    }),
  );
  return { ends: helpers.map((point) => point.id), helpers };
}

interface DirectionRequest {
  line: SketchLine;
  corner: SketchPoint;
  objects: SketchObject[];
  geometry: Settled;
}

/** Fill only directions that have no existing point constrained to this line. */
function missingDirections({ line, corner, objects, geometry }: DirectionRequest): SketchPoint[] {
  const along = geometry.lines.get(line.id);
  const at = geometry.points.get(corner.id);
  if (!along || !at || distance(along.a, along.b) < ARM_DISTANCE) return [];
  if (distanceToPath(along, at) > ARM_DISTANCE) return [];
  const dx = along.b.x - along.a.x;
  const dy = along.b.y - along.a.y;
  const length2 = dx * dx + dy * dy;
  const t = ((at.x - along.a.x) * dx + (at.y - along.a.y) * dy) / length2;
  const points = directionPoints(corner.id, line, objects);
  const signs = [-1, 1].filter((sign) => {
    if (line.form !== "line" && sign < 0 && t <= ARM_TURN) return false;
    if (line.form === "segment" && sign > 0 && t >= 1 - ARM_TURN) return false;
    return !points.some((point) => {
      const spot = geometry.points.get(point.id);
      return (
        spot &&
        distanceToPath(along, spot) <= ARM_DISTANCE &&
        ((spot.x - at.x) * dx + (spot.y - at.y) * dy) * sign > ARM_DISTANCE
      );
    });
  });
  if (signs.length === 0) return [];
  const { ends, helpers } = lineVector(line, along);
  return [
    ...helpers,
    ...signs.map((sign) =>
      helperPoint({
        id: directionId(line.id, corner.id, sign),
        x: at.x + sign * dx,
        y: at.y + sign * dy,
        from: {
          kind: "translate",
          of: corner.id,
          dx: 0,
          dy: 0,
          by: { kind: "points", from: ends[sign > 0 ? 0 : 1], to: ends[sign > 0 ? 1 : 0] },
        },
      }),
    ),
  ];
}

/** Direction points are previews until an angle actually uses them. Their vector follows the line. */
export function angleFigure(visible: SketchObject[], all: SketchObject[], geometry: Settled) {
  const existing = new Set(all.map((object) => object.id));
  const fresh = new Map<string, SketchPoint>();
  for (const line of visible.filter(isLine)) {
    for (const corner of visible.filter(isPoint)) {
      for (const point of missingDirections({ line, corner, objects: all, geometry })) {
        if (!existing.has(point.id)) fresh.set(point.id, point);
      }
    }
  }
  const helpers = [...fresh.values()];
  const augmented = [...all, ...helpers];
  const named = namedAmong(
    augmented,
    augmented.filter(isPoint).map((object) => object.id),
  );
  const names = namesFor(named);
  const visibleIds = new Set(visible.map((object) => object.id));
  const objects = [
    ...visible,
    ...augmented.filter((object) => isPoint(object) && !visibleIds.has(object.id)),
  ];
  return {
    objects: objects.map((object) =>
      isPoint(object) && !object.label?.name
        ? { ...object, label: { ...object.label, name: names.get(object.id) } }
        : object,
    ),
    settled: helpers.length ? settle(augmented).settled : geometry,
    names,
    helpers,
  };
}

/** Commit only the preview dependencies used by this angle, in the same undo step. */
export function withAnglePoints(
  before: SketchObject[],
  candidates: SketchObject[],
  ids: string[],
): SketchObject[] {
  const held = new Set(before.map((object) => object.id));
  const extra: SketchObject[] = [];
  const add = (id: string) => {
    if (held.has(id)) return;
    const object = candidates.find((one) => one.id === id);
    if (!object || !isPoint(object)) return;
    held.add(id);
    if (object.from) for (const parent of parentsOf(object.from)) add(parent);
    extra.push(object);
  };
  for (const id of ids) add(id);
  return [
    ...before.map((object) =>
      ids.includes(object.id) && !object.label?.name
        ? (candidates.find((one) => one.id === object.id) ?? object)
        : object,
    ),
    ...extra,
  ];
}
