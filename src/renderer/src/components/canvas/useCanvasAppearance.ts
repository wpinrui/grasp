import { useMemo } from "react";
import { angleFigure } from "../../sketch/measure/angleFigure";
import {
  contentBounds,
  isMark,
  isMeasurement,
  type SketchMark,
  type SketchMeasurement,
  type SketchState,
  settle,
} from "../../sketch/model";
import { type HiddenKinds, visibleObjects } from "../../sketch/visibility";
import { useHoverPreview } from "../HoverPreview";

/** Rendering may preview an appearance; actions and floating panels use committed visibility. */
export function useCanvasAppearance({
  state,
  hiddenKinds,
  scale,
}: {
  state: SketchState;
  hiddenKinds: HiddenKinds;
  scale: number;
}) {
  const preview = useHoverPreview();
  const committed = useMemo(
    () => visibleObjects(state.objects, { marks: hiddenKinds.marks, text: hiddenKinds.text }),
    [state.objects, hiddenKinds.marks, hiddenKinds.text],
  );
  const original = useMemo(
    () => angleFigure(committed, state.objects, settle(state.objects).settled),
    [committed, state.objects],
  );
  const everything = preview.objects ?? state.objects;
  const kinds = preview.hiddenKinds ?? hiddenKinds;
  const objects = useMemo(
    () => visibleObjects(everything, { marks: kinds.marks, text: kinds.text }),
    [everything, kinds.marks, kinds.text],
  );
  const anglePage = useMemo(
    () =>
      preview.objects ? angleFigure(objects, everything, settle(everything).settled) : original,
    [preview.objects, objects, everything, original],
  );
  const mark = (id: string, part: Partial<SketchMark>) =>
    preview.show(
      state.objects.map((object) =>
        object.id === id && isMark(object) ? ({ ...object, ...part } as SketchMark) : object,
      ),
    );
  const reading = (id: string, part: Partial<SketchMeasurement>) =>
    preview.show(
      state.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, ...part } : object,
      ),
    );
  return {
    ...preview,
    active: preview.objects !== null,
    everything,
    objects,
    committed,
    anglePage,
    settled: anglePage.settled,
    markingObjects: original.objects,
    drawn: contentBounds(committed, scale),
    mark,
    reading,
  };
}
