import type { CSSProperties } from "react";
import { isArc, isCircle, isLine, type SketchObject, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath } from "../shapes";

/** The same path geometry for the object and its selection outline. */
export function PathGlyph({
  object,
  className,
  style,
}: {
  object: SketchObject;
  className?: string;
  style?: CSSProperties;
}) {
  const { settled, spanOf } = useSheet();
  const look = style ?? strokeLook(object);
  if (isArc(object)) {
    const arc = settled.arcs.get(object.id);
    return arc ? (
      <path
        className={className ?? "canvas__circle"}
        style={look}
        d={arcPath(arc)}
        vectorEffect="non-scaling-stroke"
      />
    ) : null;
  }
  if (isCircle(object)) {
    const round = settled.circles.get(object.id);
    return round ? (
      <circle
        className={className ?? "canvas__circle"}
        style={look}
        cx={round.at.x}
        cy={round.at.y}
        r={round.radius}
        vectorEffect="non-scaling-stroke"
      />
    ) : null;
  }
  if (!isLine(object)) return null;
  const span = spanOf(object);
  return span ? (
    <line
      className={className ?? "canvas__line"}
      style={look}
      x1={span[0].x}
      y1={span[0].y}
      x2={span[1].x}
      y2={span[1].y}
      vectorEffect="non-scaling-stroke"
    />
  ) : null;
}

/** Paint arcs, circles, then straight objects in their established order. */
export function Paths() {
  const { objects } = useSheet();
  return [isArc, isCircle, isLine].map((matches) =>
    objects.filter(matches).map((object) => (
      <g key={object.id} data-id={object.id}>
        <PathGlyph object={object} />
      </g>
    )),
  );
}
