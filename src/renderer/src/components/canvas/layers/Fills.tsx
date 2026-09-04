/**
 * The filled shapes, which go down first so that what sits on them stays
 * visible. A fill is a polygon's inside, a whole circle's, or the wedge cut out
 * of an arc.
 */

import { fillLook, isInterior } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { interiorShape } from "../shapes";

export function Fills() {
  const { objects, settled, selection } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isInterior(object)) return null;
        const shape = interiorShape(object, settled);
        if (!shape) return null;
        const kind = `canvas__interior${
          selection.includes(object.id) ? " canvas__interior--selected" : ""
        }`;
        const look = fillLook(object, true);
        if (shape.kind === "path") {
          return (
            <path key={object.id} data-id={object.id} className={kind} style={look} d={shape.d} />
          );
        }
        if (shape.kind === "circle") {
          return (
            <circle
              key={object.id}
              data-id={object.id}
              className={kind}
              style={look}
              cx={shape.at.x}
              cy={shape.at.y}
              r={shape.radius}
            />
          );
        }
        return (
          <polygon
            key={object.id}
            data-id={object.id}
            className={kind}
            style={look}
            points={shape.points}
          />
        );
      })}
    </>
  );
}
