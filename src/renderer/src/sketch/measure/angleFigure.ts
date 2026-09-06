import {
  distance,
  distanceToPath,
  isLine,
  isPoint,
  namedAmong,
  namesFor,
  parentsOf,
  pathIn,
  type Settled,
  type SketchObject,
  type SketchPoint,
  settle,
} from "../model";

/** Direction points are previews until an angle actually uses them. Their vector follows the line. */
export function angleFigure(visible: SketchObject[], all: SketchObject[], geometry: Settled) {
  const helpers: SketchPoint[] = [];
  const existing = new Set(all.map((object) => object.id));
  const put = (point: SketchPoint) => {
    if (!existing.has(point.id) && !helpers.some((other) => other.id === point.id))
      helpers.push(point);
    return point.id;
  };
  const point = (id: string, x: number, y: number, from: SketchPoint["from"]): SketchPoint => ({
    id,
    kind: "point",
    x,
    y,
    size: "small",
    hidden: true,
    from,
  });
  const corners = visible.filter(isPoint);
  for (const line of visible.filter(isLine)) {
    const along = geometry.lines.get(line.id);
    const path = pathIn(geometry, line.id);
    if (!along || !path || distance(along.a, along.b) < 1e-6) continue;
    const dx = along.b.x - along.a.x;
    const dy = along.b.y - along.a.y;
    const length2 = dx * dx + dy * dy;
    for (const corner of corners) {
      const at = geometry.points.get(corner.id);
      if (!at || distanceToPath(path, at) > 1e-6) continue;
      const t = ((at.x - along.a.x) * dx + (at.y - along.a.y) * dy) / length2;
      for (const sign of [-1, 1]) {
        if (line.form !== "line" && sign < 0 && t <= 1e-9) continue;
        if (line.form === "segment" && sign > 0 && t >= 1 - 1e-9) continue;
        const hasPoint = all.filter(isPoint).some((candidate) => {
          const spot = geometry.points.get(candidate.id);
          return (
            spot &&
            distanceToPath(path, spot) <= 1e-6 &&
            ((spot.x - at.x) * dx + (spot.y - at.y) * dy) * sign > 1e-6
          );
        });
        if (hasPoint) continue;
        // A segment already has a defining endpoint in each available direction.
        const ends =
          line.span.kind === "through"
            ? line.span.ends
            : [
                put(
                  point(`angle-base:${line.id}:0`, along.a.x, along.a.y, {
                    kind: "on",
                    path: line.id,
                    at: 0,
                  }),
                ),
                put(
                  point(`angle-base:${line.id}:1`, along.b.x, along.b.y, {
                    kind: "on",
                    path: line.id,
                    at: 1,
                  }),
                ),
              ];
        put(
          point(
            `angle-direction:${line.id}:${corner.id}:${sign}`,
            at.x + sign * dx,
            at.y + sign * dy,
            {
              kind: "translate",
              of: corner.id,
              dx: 0,
              dy: 0,
              by: { kind: "points", from: ends[sign > 0 ? 0 : 1], to: ends[sign > 0 ? 1 : 0] },
            },
          ),
        );
      }
    }
  }
  const augmented = [...all, ...helpers];
  const named = namedAmong(
    augmented,
    augmented.filter(isPoint).map((object) => object.id),
  );
  const names = namesFor(named);
  const objects = [
    ...visible,
    ...augmented.filter(
      (object) => isPoint(object) && !visible.some((one) => one.id === object.id),
    ),
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
