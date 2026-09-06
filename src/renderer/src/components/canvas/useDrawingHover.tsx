import { useCallback, useState } from "react";
import {
  isMark,
  markAlong,
  type PointSize,
  type Position,
  radiusOf,
  type SketchMark,
  spotOnPath,
} from "../../sketch/model";
import { Lit } from "./layers/Lit";
import { MarkGhost } from "./layers/Marks";
import { markUnder } from "./marks";
import { useSheet } from "./SheetContext";
import type { Figure, Snap } from "./sheet";
import { pathUnder } from "./steps";
import type { useMarking } from "./useMarking";

interface Hover {
  point: Position | null;
  mark: SketchMark | null;
  id: string | null;
  middle: Position | null;
}
const EMPTY: Hover = { point: null, mark: null, id: null, middle: null };

export function useDrawingHover() {
  const [state, setState] = useState<Hover>(EMPTY);
  const clear = useCallback(() => setState(EMPTY), []);
  const aim = (found: Snap | null, spot: Position) =>
    setState((was) => ({ ...was, point: found?.kind === "point" ? null : spot }));
  function markAt(
    over: Position | null,
    context: Figure & { marking: string; tickFor: ReturnType<typeof useMarking>["tickFor"] },
  ) {
    const { objects, scale, marking, tickFor } = context;
    const under = over && marking !== "angle" ? pathUnder(over, context) : null;
    const existing = under
      ? objects.find(
          (object) =>
            isMark(object) &&
            "path" in object &&
            object.path === under.object.id &&
            object.form === marking,
        )
      : null;
    const mark =
      under && over && !existing && !markUnder(over, context)
        ? tickFor({ path: under.object, along: under.along, spot: over })
        : null;
    const middle =
      under && over && markAlong(under.along, over, scale) === 0.5
        ? spotOnPath(under.along, 0.5)
        : null;
    setState({ point: null, mark, id: existing?.id ?? null, middle });
  }
  return { ...state, clear, aim, markAt };
}

export function DrawingHover({
  hover,
  pointSize,
  plotting,
  marking,
}: {
  hover: ReturnType<typeof useDrawingHover>;
  pointSize: PointSize;
  plotting: boolean;
  marking: boolean;
}) {
  const { scale } = useSheet();
  return (
    <>
      {plotting && hover.point && (
        <circle
          className="canvas__point canvas__point--preview"
          cx={hover.point.x}
          cy={hover.point.y}
          r={radiusOf({ id: "hover", kind: "point", ...hover.point, size: pointSize }) / scale}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {marking && <MarkGhost mark={hover.mark} />}
      {marking && hover.id && <Lit ids={[hover.id]} />}
    </>
  );
}
