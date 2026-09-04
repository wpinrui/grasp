/**
 * A filled interior, drawn as whatever shape it turned out to be.
 *
 * Three things draw the same interior: the fill itself, the band when it is lit
 * up, and the ghost of one a dialog would make. They differ only in what they
 * are painted with, so the shape is worked out in one place and the switch from
 * shape to element is made in one place, and each caller says only how its own
 * looks.
 */

import type { CSSProperties } from "react";
import type { Interior } from "../shapes";

interface InteriorGlyphProps {
  shape: Interior;
  className: string;
  style?: CSSProperties;
  /** Set where the interior is pickable, which is the fill but not the ghosts. */
  dataId?: string;
  /** Set where the stroke should keep its width on screen at any zoom. */
  fixedStroke?: boolean;
}

export function InteriorGlyph({
  shape,
  className,
  style,
  dataId,
  fixedStroke,
}: InteriorGlyphProps) {
  const stroke = fixedStroke ? ("non-scaling-stroke" as const) : undefined;
  if (shape.kind === "path") {
    return (
      <path
        data-id={dataId}
        className={className}
        style={style}
        d={shape.d}
        vectorEffect={stroke}
      />
    );
  }
  if (shape.kind === "circle") {
    return (
      <circle
        data-id={dataId}
        className={className}
        style={style}
        cx={shape.at.x}
        cy={shape.at.y}
        r={shape.radius}
        vectorEffect={stroke}
      />
    );
  }
  return (
    <polygon
      data-id={dataId}
      className={className}
      style={style}
      points={shape.points}
      vectorEffect={stroke}
    />
  );
}
