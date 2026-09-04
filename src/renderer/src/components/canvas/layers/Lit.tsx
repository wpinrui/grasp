/**
 * A band along whatever is lit up, because a click would land on it or because
 * a panel is pointing at it.
 *
 * Hidden objects are lit too: that band is the only way to see where one sits
 * before it is shown again, which is why this draws from everything on the page
 * rather than from what is on the sheet.
 */

import {
  filledPath,
  isArc,
  isCircle,
  isInterior,
  isLine,
  isPoint,
  type Position,
  radiusOf,
  type SketchLine,
  type SketchPoint,
  wedgeOf,
} from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath, wedgePath } from "../shapes";

interface LitProps {
  /** What to light, which is what `litWith` worked out for the thing asked for. */
  ids: string[];
  /** Every point on the page by id, since a lit dot is drawn where it settled. */
  ends: Map<string, SketchPoint>;
  spanOf: (line: SketchLine) => [Position, Position] | null;
}

export function Lit({ ids, ends, spanOf }: LitProps) {
  const { everything, settled, scale } = useSheet();

  function bandFor(id: string) {
    const object = everything.find((candidate) => candidate.id === id);
    if (!object) return null;
    if (isArc(object)) {
      const arc = settled.arcs.get(object.id);
      return arc ? (
        <path
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          d={arcPath(arc)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isCircle(object)) {
      const round = settled.circles.get(object.id);
      return round ? (
        <circle
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          cx={round.at.x}
          cy={round.at.y}
          r={round.radius}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isInterior(object)) {
      const inside = filledPath(object);
      if (inside) {
        const wedge = wedgeOf(object);
        const arc = wedge ? settled.arcs.get(inside) : undefined;
        if (arc) {
          return (
            <path
              key={id}
              className="canvas__snap-band canvas__snap-band--round"
              d={wedgePath(arc, wedge as "sector")}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        const round = settled.circles.get(inside);
        return round ? (
          <circle
            key={id}
            className="canvas__snap-band canvas__snap-band--round"
            cx={round.at.x}
            cy={round.at.y}
            r={round.radius}
            vectorEffect="non-scaling-stroke"
          />
        ) : null;
      }
      const corners = settled.shapes.get(object.id);
      return corners ? (
        <polygon
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isPoint(object)) {
      const spot = ends.get(object.id);
      return spot ? (
        <circle
          key={id}
          className="canvas__snap"
          cx={spot.x}
          cy={spot.y}
          r={(radiusOf(spot) + 5.5) / scale}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    const span = isLine(object) ? spanOf(object) : null;
    return span ? (
      <line
        key={id}
        className="canvas__snap-band"
        x1={span[0].x}
        y1={span[0].y}
        x2={span[1].x}
        y2={span[1].y}
        vectorEffect="non-scaling-stroke"
      />
    ) : null;
  }

  return <>{ids.map((id) => bandFor(id))}</>;
}
