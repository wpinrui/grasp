/**
 * A band along whatever is lit up, because a click would land on it or because
 * a panel is pointing at it.
 *
 * Hidden objects are lit too: that band is the only way to see where one sits
 * before it is shown again, which is why this draws from everything on the page
 * rather than from what is on the sheet.
 */

import { isArc, isCircle, isInterior, isLine, isPoint, radiusOf } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath, interiorShape } from "../shapes";

interface LitProps {
  /** The ids to draw a band along. */
  ids: string[];
}

const ROUND = "canvas__snap-band canvas__snap-band--round";

export function Lit({ ids }: LitProps) {
  const { everything, settled, scale, ends, spanOf } = useSheet();

  function bandFor(id: string) {
    const object = everything.find((candidate) => candidate.id === id);
    if (!object) return null;
    if (isArc(object)) {
      const arc = settled.arcs.get(object.id);
      return arc ? (
        <path key={id} className={ROUND} d={arcPath(arc)} vectorEffect="non-scaling-stroke" />
      ) : null;
    }
    if (isCircle(object)) {
      const round = settled.circles.get(object.id);
      return round ? (
        <circle
          key={id}
          className={ROUND}
          cx={round.at.x}
          cy={round.at.y}
          r={round.radius}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isInterior(object)) {
      const shape = interiorShape(object, settled);
      if (!shape) return null;
      if (shape.kind === "path") {
        return <path key={id} className={ROUND} d={shape.d} vectorEffect="non-scaling-stroke" />;
      }
      if (shape.kind === "circle") {
        return (
          <circle
            key={id}
            className={ROUND}
            cx={shape.at.x}
            cy={shape.at.y}
            r={shape.radius}
            vectorEffect="non-scaling-stroke"
          />
        );
      }
      return (
        <polygon
          key={id}
          className={ROUND}
          points={shape.points}
          vectorEffect="non-scaling-stroke"
        />
      );
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
