/**
 * The ghosts of what an open dialog would make, drawn in the figure's own place
 * so the answer can be seen before it is taken.
 *
 * The ghosts settle against a page that has them on it, which is not the page
 * that is drawn, so where they land is handed in rather than read off the sheet.
 */

import {
  isArc,
  isCircle,
  isInterior,
  isLine,
  isLocus,
  type Position,
  radiusOf,
  type Settled,
  type SketchLine,
  type SketchObject,
  type SketchPoint,
} from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath, interiorShape } from "../shapes";
import { InteriorGlyph } from "./Interior";
import { Locus } from "./Locus";

interface PreviewProps {
  /** What the dialog would make, lines and all. */
  objects: SketchObject[];
  /** The points among those, which are drawn as ghosts of dots. */
  points: SketchPoint[];
  /** Where they land, worked out against a page that has them on it. */
  settled: Settled;
  /** Where a straight ghost is cut off, against that same page. */
  spanOf: (line: SketchLine, within: Settled) => [Position, Position] | null;
}

export function Preview({ objects, points, settled, spanOf }: PreviewProps) {
  const { scale } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (isArc(object)) {
          const arc = settled.arcs.get(object.id);
          return arc ? (
            <path
              key={object.id}
              className="canvas__circle canvas__circle--preview"
              d={arcPath(arc)}
              vectorEffect="non-scaling-stroke"
            />
          ) : null;
        }
        if (isCircle(object)) {
          const round = settled.circles.get(object.id);
          return round ? (
            <circle
              key={object.id}
              className="canvas__circle canvas__circle--preview"
              cx={round.at.x}
              cy={round.at.y}
              r={round.radius}
              vectorEffect="non-scaling-stroke"
            />
          ) : null;
        }
        if (isLocus(object)) {
          const shape = settled.loci.get(object.id);
          return shape ? <Locus key={object.id} id={object.id} shape={shape} ghost /> : null;
        }
        if (isInterior(object)) {
          const shape = interiorShape(object, settled);
          return shape ? (
            <InteriorGlyph
              key={object.id}
              shape={shape}
              className="canvas__interior canvas__interior--preview"
            />
          ) : null;
        }
        if (!isLine(object)) return null;
        const span = spanOf(object, settled);
        return span ? (
          <line
            key={object.id}
            className="canvas__line canvas__line--preview"
            x1={span[0].x}
            y1={span[0].y}
            x2={span[1].x}
            y2={span[1].y}
            vectorEffect="non-scaling-stroke"
          />
        ) : null;
      })}
      {points.map((point) => (
        <circle
          key={point.id}
          className="canvas__point canvas__point--preview"
          cx={point.x}
          cy={point.y}
          r={radiusOf(point) / scale}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}
