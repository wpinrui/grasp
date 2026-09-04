/**
 * Everything a point can be put on and slide along: arcs, circles and straight
 * objects. Each is drawn twice where it is picked, once as the band that says
 * so and once as itself, so selection reads as a ring around the object rather
 * than as a change to it.
 *
 * A straight object runs on past its ends, so where it is cut off is worked out
 * against the sheet rather than off the object, and is handed in.
 */

import {
  isArc,
  isCircle,
  isLine,
  type Position,
  type SketchLine,
  strokeLook,
} from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath } from "../shapes";

interface PathsProps {
  /** Where a straight object is cut off by the sheet it is drawn on. */
  spanOf: (line: SketchLine) => [Position, Position] | null;
}

export function Paths({ spanOf }: PathsProps) {
  const { objects, settled, selection } = useSheet();
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
