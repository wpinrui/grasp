/**
 * What an open dialog is holding on to: a ring around each point it has taken,
 * and a band along each straight object, so what the dialog is about can be
 * seen on the sheet while it is being filled in.
 *
 * The ghosts of what it would make are a different thing and are drawn with the
 * rest of the preview.
 *
 * A held point is found among every point on the page, so one that is hidden
 * still gets its ring; a held line is found among what is drawn, so a hidden
 * one gets no band. That is how it has always behaved, and it is the reason the
 * two are looked up in different places.
 */

import { isLine, radiusOf } from "../../../sketch/model";
import { useSheet } from "../SheetContext";

interface HoldingProps {
  /** The ids a dialog has taken, each with the caption drawn by it. */
  marks: { id: string; label: string }[];
}

export function Holding({ marks }: HoldingProps) {
  const { objects, scale, ends, spanOf } = useSheet();
  return (
    <>
      {marks.map((mark) => {
        const point = ends.get(mark.id);
        if (point) {
          return (
            <circle
              key={mark.id}
              className="canvas__mark"
              cx={point.x}
              cy={point.y}
              r={(radiusOf(point) + 7) / scale}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        const line = objects.find((object) => object.id === mark.id);
        const span = line && isLine(line) ? spanOf(line) : null;
        return span ? (
          <line
            key={mark.id}
            className="canvas__mark-band"
            x1={span[0].x}
            y1={span[0].y}
            x2={span[1].x}
            y2={span[1].y}
            vectorEffect="non-scaling-stroke"
          />
        ) : null;
      })}
    </>
  );
}
