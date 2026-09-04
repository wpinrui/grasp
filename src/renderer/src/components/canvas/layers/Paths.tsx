/**
 * Everything a point can be put on and slide along: arcs, circles and straight
 * objects. Each is drawn twice where it is picked, once as the band that says
 * so and once as itself, so selection reads as a ring around the object rather
 * than as a change to it.
 *
 * A straight object runs on past its ends, so where it is cut off is worked out
 * against the viewport rather than off the object.
 *
 * The three passes are in paint order: arcs, then circles, then straight
 * objects. Folding them into one pass over the objects would draw them in the
 * order they were made instead, which is not the same picture.
 */

import { isArc, isCircle, isLine, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath } from "../shapes";

export function Paths() {
  const { objects, settled, selection, spanOf } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isArc(object)) return null;
        const arc = settled.arcs.get(object.id);
        if (!arc) return null;
        return (
          <g key={object.id} data-id={object.id}>
            {selection.includes(object.id) && (
              <path
                className="canvas__circle-halo"
                d={arcPath(arc)}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              className="canvas__circle"
              style={strokeLook(object)}
              d={arcPath(arc)}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {objects.map((object) => {
        if (!isCircle(object)) return null;
        const round = settled.circles.get(object.id);
        if (!round) return null;
        return (
          <g key={object.id} data-id={object.id}>
            {selection.includes(object.id) && (
              <circle
                className="canvas__circle-halo"
                cx={round.at.x}
                cy={round.at.y}
                r={round.radius}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              className="canvas__circle"
              style={strokeLook(object)}
              cx={round.at.x}
              cy={round.at.y}
              r={round.radius}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {objects.map((object) => {
        if (!isLine(object)) return null;
        const span = spanOf(object);
        if (!span) return null;
        return (
          <g key={object.id} data-id={object.id}>
            {selection.includes(object.id) && (
              <line
                className="canvas__line-halo"
                x1={span[0].x}
                y1={span[0].y}
                x2={span[1].x}
                y2={span[1].y}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <line
              className="canvas__line"
              style={strokeLook(object)}
              x1={span[0].x}
              y1={span[0].y}
              x2={span[1].x}
              y2={span[1].y}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </>
  );
}
