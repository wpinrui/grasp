/**
 * What a tool has between its clicks: the band from where it started to where
 * the pointer is, the shape a polygon would close at, and the midpoint of a
 * path a marking tool would snap to, lit while the pointer is over it. The box
 * a caption is dragged out to belongs here too, being the same kind of thing
 * drawn above the sheet rather than in it.
 *
 * None of it is on the page. It is gone the moment the object lands, or the
 * moment the gesture is dropped.
 */

import { distance, type Position, type Rect, type View } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import type { Pending, Tracing } from "../sheet";
import { screenSpot } from "../sheet";

interface DrawingProps {
  /** The polygon being traced out, its corners in the order they were clicked. */
  tracing: Tracing | null;
  /** A tool waiting for its second click, and where it is aiming. */
  pending: Pending | null;
  /** The midpoint a marking tool would snap to, while the pointer is over it. */
  middle: Position | null;
}

/**
 * What the polygon would be if it closed here: the fill once there are three
 * corners, the edges laid down so far, and a band from the last corner to the
 * pointer, with the closing edge back to the first once there is one.
 */
function Traced({ tracing }: { tracing: Tracing }) {
  const last = tracing.spots[tracing.spots.length - 1];
  return (
    <g>
      {tracing.spots.length >= 2 && (
        <polygon
          className="canvas__interior canvas__interior--preview"
          points={[...tracing.spots, tracing.at].map((spot) => `${spot.x},${spot.y}`).join(" ")}
        />
      )}
      <polyline
        className="canvas__rubber canvas__rubber--laid"
        points={tracing.spots.map((spot) => `${spot.x},${spot.y}`).join(" ")}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="canvas__rubber"
        x1={last.x}
        y1={last.y}
        x2={tracing.at.x}
        y2={tracing.at.y}
        vectorEffect="non-scaling-stroke"
      />
      {tracing.spots.length >= 2 && (
        <line
          className="canvas__rubber"
          x1={tracing.at.x}
          y1={tracing.at.y}
          x2={tracing.spots[0].x}
          y2={tracing.spots[0].y}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

export function Drawing({ tracing, pending, middle }: DrawingProps) {
  const { scale } = useSheet();
  return (
    <>
      {tracing && <Traced tracing={tracing} />}
      {pending &&
        (pending.tool === "compass" ? (
          <circle
            className="canvas__rubber"
            cx={pending.start.x}
            cy={pending.start.y}
            r={distance(pending.start, pending.at)}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            className="canvas__rubber"
            x1={pending.start.x}
            y1={pending.start.y}
            x2={pending.at.x}
            y2={pending.at.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      {middle && (
        <circle
          className="canvas__snap"
          cx={middle.x}
          cy={middle.y}
          r={7 / scale}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  );
}

/**
 * The box a caption is being dragged out to, before there is a caption in it.
 * It rides above the sheet as HTML, the way the caption itself will.
 */
export function Boxing({
  boxing,
  view,
  scale,
}: {
  /** The box being dragged out, or nothing while none is. */
  boxing: Rect | null;
  view: View;
  scale: number;
}) {
  if (!boxing) return null;
  return (
    <div
      className="caption-box"
      style={{
        ...screenSpot(boxing, view, scale),
        width: `${boxing.width * scale}px`,
        height: `${boxing.height * scale}px`,
      }}
    />
  );
}
