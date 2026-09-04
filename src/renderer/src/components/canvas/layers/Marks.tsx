/**
 * The markings on the figure: the ticks on equal sides and the arcs in equal
 * angles, each drawn as the strokes it comes to.
 *
 * A mark is a fixed-length list of stateless paths, redrawn whole every time,
 * so the strokes are keyed by their place in it. Selection reads as a band
 * behind the strokes rather than a change to them, the way it does everywhere
 * else on the sheet.
 */

import { isMark, markShape, markStrokes, type SketchMark, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";

export function Marks() {
  const { objects, settled, selection, scale } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isMark(object)) return null;
        const shape = markShape(object, { settled, objects, scale });
        if (!shape) return null;
        const strokes = markStrokes(shape, scale);
        return (
          <g key={object.id} data-id={object.id}>
            {selection.includes(object.id) &&
              strokes.map((stroke, nth) => (
                <path
                  // biome-ignore lint/suspicious/noArrayIndexKey: stateless paths in a fixed-length list, redrawn whole
                  key={`halo-${object.id}-${nth}`}
                  className="canvas__mark-halo"
                  d={stroke}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {strokes.map((stroke, nth) => (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: stateless paths in a fixed-length list, redrawn whole
                key={`${object.id}-${nth}`}
                className="canvas__mark-stroke"
                style={strokeLook({ ...object, pattern: undefined })}
                d={stroke}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

/**
 * The arcs a click would put on an angle before reading it. An angle has to be
 * marked before it can be read, so they are part of what that click would do.
 */
export function MarkGhost({ mark }: { mark: SketchMark | null }) {
  const { objects, settled, scale } = useSheet();
  if (!mark) return null;
  const shape = markShape(mark, { settled, objects, scale });
  if (!shape) return null;
  return (
    <>
      {markStrokes(shape, scale).map((stroke) => (
        <path
          key={stroke}
          className="canvas__mark-stroke canvas__mark-stroke--preview"
          d={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}
