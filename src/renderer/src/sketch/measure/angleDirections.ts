import { isPoint, type SketchLine, type SketchObject, type SketchPoint } from "../model";

export const ARM_DISTANCE = 1e-6;
export const ARM_TURN = 1e-9;

export const directionId = (line: string, corner: string, sign: number) =>
  `angle-direction:${line}:${corner}:${sign}`;

/** Arm references must follow their straight object, rather than merely coincide with it. */
export function directionPoints(
  corner: string,
  line: SketchLine,
  objects: SketchObject[],
): SketchPoint[] {
  const ends: readonly string[] = line.span.kind === "through" ? line.span.ends : [];
  const points = objects.filter(isPoint);
  const attached = new Set(
    points
      .filter((point) => {
        if (ends.includes(point.id)) return true;
        const from = point.from;
        if (from?.kind === "on") return from.path === line.id;
        if (from?.kind === "cross") return from.of === line.id || from.and === line.id;
        return false;
      })
      .map((point) => point.id),
  );
  return points.filter((point) => {
    if (attached.has(point.id)) return true;
    const from = point.from;
    return (
      from?.kind === "translate" &&
      from.of === corner &&
      from.by?.kind === "points" &&
      attached.has(from.by.from) &&
      attached.has(from.by.to)
    );
  });
}
