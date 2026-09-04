/**
 * The dots. They keep their size on screen, so their radii are divided by the
 * scale and their strokes are left unscaled, and a picked one gets a ring
 * around it rather than a colour of its own.
 */

import { fillLook, pointsOf, radiusOf } from "../../../sketch/model";
import { useSheet } from "../SheetContext";

export function Points() {
  const { objects, selection, scale } = useSheet();
  return (
    <>
      {pointsOf(objects).map((object) => (
        <g key={object.id} data-id={object.id}>
          {selection.includes(object.id) && (
            <circle
              className="canvas__halo"
              cx={object.x}
              cy={object.y}
              r={(radiusOf(object) + 4.5) / scale}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle
            className="canvas__point"
            style={fillLook(object, false)}
            cx={object.x}
            cy={object.y}
            r={radiusOf(object) / scale}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </>
  );
}
