/**
 * What a half-drawn object says about itself while it is being placed, drawn on
 * the sheet rather than beside the pointer: the run it has covered so far, the
 * horizontal it is being read against where there is one, an arc in every angle
 * it makes, and the numbers those come to.
 *
 * The text keeps its size on screen, so it is scaled back by the zoom.
 */

import { useSheet } from "../SheetContext";
import type { Guide } from "../sheet";
import { GUIDE_OFF, GUIDE_RADIUS } from "../sheet";

interface GuidesProps {
  /** What is being placed, or nothing while nothing is. */
  guide: Guide | null;
}

export function Guides({ guide }: GuidesProps) {
  const { scale } = useSheet();
  if (!guide) return null;
  return (
    <g>
      {guide.travel && (
        <line
          className="canvas__guide-travel"
          x1={guide.travel.from.x}
          y1={guide.travel.from.y}
          x2={guide.travel.to.x}
          y2={guide.travel.to.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {guide.datum && (
        <line
          className="canvas__guide-datum"
          x1={guide.datum.x}
          y1={guide.datum.y}
          x2={guide.datum.x + (GUIDE_RADIUS + GUIDE_OFF) / scale}
          y2={guide.datum.y}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {guide.corners.map((corner) => (
        <path
          key={corner.arc}
          className="canvas__guide-arc"
          d={corner.arc}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {[
        guide.length,
        ...guide.corners.map((corner) => corner.text),
        ...(guide.area ? [guide.area] : []),
      ].map((part, nth) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: two corners of a figure can read the same
          key={nth}
          className="canvas__guide"
          textAnchor="middle"
          transform={`translate(${part.at.x} ${part.at.y}) rotate(${part.turn}) scale(${1 / scale})`}
          dy={part.dy}
        >
          {part.text}
        </text>
      ))}
    </g>
  );
}
