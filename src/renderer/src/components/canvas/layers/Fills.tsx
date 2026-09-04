/**
 * The filled shapes, which go down first so that what sits on them stays
 * visible. A fill is a polygon's inside, a whole circle's, or the wedge cut out
 * of an arc.
 */

import { filledPath, fillLook, isInterior, wedgeOf } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { wedgePath } from "../shapes";

export function Fills() {
  const { objects, settled, selection } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isInterior(object)) return null;
        const kind = `canvas__interior${
          selection.includes(object.id) ? " canvas__interior--selected" : ""
        }`;
        const inside = filledPath(object);
        if (inside) {
          const wedge = wedgeOf(object);
          const arc = wedge ? settled.arcs.get(inside) : undefined;
          if (arc) {
            return (
              <path
                key={object.id}
                data-id={object.id}
                className={kind}
                style={fillLook(object, true)}
                d={wedgePath(arc, wedge as "sector")}
              />
            );
          }
          const where = settled.circles.get(inside);
          return where ? (
            <circle
              key={object.id}
              data-id={object.id}
              className={kind}
              style={fillLook(object, true)}
              cx={where.at.x}
              cy={where.at.y}
              r={where.radius}
            />
          ) : null;
        }
        const corners = settled.shapes.get(object.id);
        if (!corners) return null;
        return (
          <polygon
            key={object.id}
            data-id={object.id}
            className={kind}
            style={fillLook(object, true)}
            points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
          />
        );
      })}
    </>
  );
}
