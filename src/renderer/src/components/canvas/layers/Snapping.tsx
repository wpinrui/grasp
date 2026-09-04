/**
 * Where a click would land, said before it is made: the arrowheads a locus is
 * dragged by, the ring at the spot a click would take, and the band a marquee
 * is being dragged out as.
 *
 * None of it is on the page. It is what the sheet says about what the pointer
 * is over.
 */

import type { Rect } from "../../../sketch/model";
import { handlesOn } from "../handles";
import { useSheet } from "../SheetContext";
import { arrowPoints } from "../shapes";
import { type Snap, snapRadius } from "../sheet";
import { Lit } from "./Lit";

/** Every arrowhead on the page, each keeping its size on screen. */
export function Handles() {
  const { objects, settled, scale } = useSheet();
  return (
    <>
      {handlesOn({ objects, settled }).map((handle) => (
        <polygon
          key={`${handle.locus}-${handle.end}`}
          className="canvas__locus-arrow"
          points={arrowPoints(handle, scale)}
        />
      ))}
    </>
  );
}

/** The ring where a click would land, and a band along what it would use. */
export function Snapped({ snap }: { snap: Snap | null }) {
  const { scale, ends } = useSheet();
  if (!snap) return null;
  return (
    <g>
      {/* The paths a click would attach to, or whose crossing it would build,
        lit the whole way along. */}
      {snap.kind !== "point" && <Lit ids={snap.ids} />}
      <circle
        className="canvas__snap"
        cx={snap.at.x}
        cy={snap.at.y}
        r={snapRadius(snap, { scale, ends })}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** The rectangle a marquee is being dragged out as, its corners rounded the
 * same amount at any zoom. */
export function Marquee({ rect }: { rect: Rect | null }) {
  const { scale } = useSheet();
  if (!rect) return null;
  return (
    <rect
      className="canvas__marquee"
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      rx={2 / scale}
      vectorEffect="non-scaling-stroke"
    />
  );
}
